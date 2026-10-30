import { inferenceError } from '../../../editor-vuejs/src/lib/agent/provider-errors.mjs';
import { relayProviderResponse, validateProviderPayload } from './proxy.mjs';
// Shared provider: local plan OAuth, approved hosted OAuth, or hosted API keys.
import { createRouter } from './router.mjs';
import jwt from 'jsonwebtoken';
import { createHash, createPublicKey, randomBytes } from 'node:crypto';
import { DECK_AUTHORING_VERSION } from '../../../editor-vuejs/src/lib/agent/deck-authoring.mjs';

const ISSUER = 'https://auth.openai.com';
const RESOURCE = 'https://api.openai.com/v1';
const BASE = '/api/agent/chatgpt';
const random = () => randomBytes(32).toString('base64url');

export async function connectionError(response, stage = 'connection') {
  // OAuth diagnostics must never echo codes, tokens, or upstream descriptions.
  let payload;
  try { payload = await response.json(); } catch { /* Non-JSON upstream error. */ }
  const rawCode = typeof payload?.error === 'string' ? payload.error : payload?.error?.code;
  const code = typeof rawCode === 'string' && /^[a-z][a-z0-9_]{0,79}$/.test(rawCode) ? rawCode : undefined;
  const requestId = response.headers.get('x-request-id');
  const safeRequestId = requestId && /^[a-zA-Z0-9_-]{1,128}$/.test(requestId) ? requestId : undefined;
  const recovery = {
    invalid_grant: 'The authorization code expired, was already used, or did not match this sign-in attempt. Start a fresh sign-in from the Agent panel; do not refresh the callback tab.',
    invalid_client: 'OpenAI rejected the registered client. Start a fresh sign-in and check the client registration.',
    invalid_request: 'OpenAI rejected the OAuth request parameters. The integration needs to be checked.',
    invalid_scope: 'OpenAI rejected the requested permissions. Check whether ChatGPT plan usage is enabled for this integration.',
    unauthorized_client: 'This client is not authorized for the requested sign-in flow.',
    unsupported_grant_type: 'OpenAI did not accept the requested OAuth grant type.',
  }[code];
  const error = new Error(`ChatGPT ${stage} failed (HTTP ${response.status}${code ? `, ${code}` : ''}).${recovery ? ` ${recovery}` : ''}${safeRequestId ? ` Request ID: ${safeRequestId}.` : ''}`);
  error.upstreamCode = code;
  error.upstreamStatus = response.status;
  return error;
}

export function verifyIdentity(token, keys, clientId, nonce) {
  const header = jwt.decode(token, { complete: true })?.header;
  if (!header || header.alg !== 'RS256') throw new Error('Invalid ChatGPT identity signature.');
  const key = keys.find(key => key.kid === header.kid && key.kty === 'RSA' && (!key.use || key.use === 'sig'));
  if (!key) throw new Error('Unknown ChatGPT identity signing key.');
  const identity = jwt.verify(token, createPublicKey({ key, format: 'jwk' }), {
    algorithms: ['RS256'], issuer: ISSUER, audience: clientId, clockTolerance: 5,
  });
  if (!identity.sub || !Number.isFinite(identity.exp) || !Number.isFinite(identity.iat) || identity.iat > Date.now() / 1000 + 5 || identity.nonce !== nonce)
    throw new Error('Invalid ChatGPT identity claims.');
  return identity;
}

export function createChatGPTProvider({ hostId, port = 1455, fetchImpl = fetch, router = createRouter, trustedRequest, getRedirectUri, authMode = 'oauth', hostedOAuth, sessions = new Map(), attempts = new Map(), onCredentialsChanged = () => {}, sessionMaxAgeMs = 8 * 3600_000,
  origins = ['https://localhost:6173', 'https://127.0.0.1:6173', 'http://localhost:6173', 'http://127.0.0.1:6173'] } = {}) {
  if (!hostId) throw new Error('A persistent agent host ID is required.');
  const app = router();
  const redirectUri = `http://127.0.0.1:${port}/auth/callback`;
  const callbackPath = hostedOAuth ? new URL(hostedOAuth.redirectUri).pathname : '/auth/callback';
  const cookieSession = req => req.headers.cookie?.split(';').map(part => part.trim())
    .find(part => part.startsWith('desq_chatgpt='))?.slice('desq_chatgpt='.length);
  const cookieSameSite = hostedOAuth ? 'Lax' : 'Strict';
  const clientAuthentication = () => {
    if (!hostedOAuth?.clientSecret) return {};
    const encode = value => new URLSearchParams({ value }).toString().slice(6);
    return { Authorization: `Basic ${Buffer.from(`${encode(hostedOAuth.clientId)}:${encode(hostedOAuth.clientSecret)}`).toString('base64')}` };
  };
  let discovery, jwks;
  async function json(url, options = {}, stage = 'connection') {
    const response = await fetchImpl(url, { ...options, signal: options.signal || AbortSignal.timeout(30_000) });
    if (!response.ok) throw await connectionError(response, stage);
    return response.json();
  }
  async function configuration() {
    if (!discovery) {
      const value = await json(`${ISSUER}/.well-known/openid-configuration`);
      if (value.issuer !== ISSUER || ['authorization_endpoint', 'token_endpoint', 'jwks_uri', 'revocation_endpoint']
        .some(key => value[key] && new URL(value[key]).origin !== ISSUER)) throw new Error('Invalid OpenAI discovery configuration.');
      discovery = value;
    }
    return discovery;
  }
  async function exchange(params) {
    const config = await configuration();
    return json(config.token_endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...clientAuthentication() },
      body: new URLSearchParams({ ...params, resource: RESOURCE }) }, params.grant_type === 'refresh_token' ? 'token refresh' : 'token exchange');
  }
  function credentials(tokens, previous = {}) {
    const scope = tokens.scope ?? previous.scope;
    if (!scope?.split(' ').includes('chatgpt.tokens.use.direct') || typeof tokens.access_token !== 'string' ||
      tokens.token_type?.toLowerCase() !== 'bearer' || !Number.isFinite(tokens.expires_in) || tokens.expires_in <= 0)
      throw new Error('ChatGPT plan usage was not authorized. Sign in and allow plan access.');
    return { ...previous, ...tokens, scope, expiresAt: Date.now() + tokens.expires_in * 1000 };
  }
  async function access(session) {
    if (authMode === 'api-key') { if (!session.key) throw new Error('Connect an OpenAI API key first.'); return session.key; }
    if (!session.tokens) throw new Error('Continue with ChatGPT to connect your account.');
    if (session.tokens.expiresAt > Date.now() + 60_000) return session.tokens.access_token;
    if (!session.refreshing) session.refreshing = (async () => {
      try {
        if (!session.tokens.refresh_token) throw new Error('ChatGPT session expired. Sign in again.');
        const next = await exchange({ grant_type: 'refresh_token', client_id: session.clientId, refresh_token: session.tokens.refresh_token });
        session.tokens = credentials(next, session.tokens);
        await onCredentialsChanged(); // Save the latest rotating token before use.
      } catch (error) {
        // Keep refresh credentials on network/5xx failures so the next request
        // can retry. A rejected grant requires reauthorization of the saved client.
        if (!session.tokens?.refresh_token || ['invalid_grant', 'invalid_client', 'unauthorized_client'].includes(error.upstreamCode) || [401, 403].includes(error.upstreamStatus)) {
          session.tokens = undefined;
          await onCredentialsChanged();
        }
        throw error;
      }
      finally { session.refreshing = undefined; }
    })();
    await session.refreshing;
    return session.tokens.access_token;
  }
  const route = handler => (req, res, next) => Promise.resolve(handler(req, res)).catch(next);
  app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.set('Referrer-Policy', 'no-referrer');
    res.set('X-Content-Type-Options', 'nosniff');
    if (trustedRequest ? !trustedRequest(req) : req.headers.host !== `127.0.0.1:${req.socket.localPort}`) return res.status(403).json({ error: 'Only the local ChatGPT companion is supported.' });
    next();
  });
  const callback = route(async (req, res) => {
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const attempt = attempts.get(state);
    if (hostedOAuth && (!attempt || cookieSession(req) !== attempt.sessionId))
      return res.status(400).type('text').send('Sign-in could not be verified in this browser. Start again from the editor.');
    attempts.delete(state); // One-time consumption, including failed callbacks.
    if (!attempt || attempt.expiresAt < Date.now() || !sessions.has(attempt.sessionId)) throw new Error('Sign-in expired or invalid. Try again.');
    const session = sessions.get(attempt.sessionId);
    try {
      if (req.query.iss && req.query.iss !== ISSUER) throw new Error('Invalid ChatGPT authorization issuer.');
      if (req.query.error) throw new Error('ChatGPT sign-in was declined.');
      const clientId = req.query.client_id || attempt.clientId;
      if (typeof clientId !== 'string' || clientId === 'dynamic_agent_client' ||
        (attempt.clientId !== 'dynamic_agent_client' && clientId !== attempt.clientId) || typeof req.query.code !== 'string')
        throw new Error('ChatGPT registration did not return the expected client ID.');
      // The callback has already registered this client even if exchange fails.
      // Keep it separate from the active, identity-verified account until success.
      session.registrationClientId = clientId;
      await onCredentialsChanged();
      const tokens = await exchange({ grant_type: 'authorization_code', client_id: clientId,
        code: req.query.code, code_verifier: attempt.verifier, redirect_uri: attempt.redirectUri || redirectUri });
      const config = await configuration();
      if (!jwks || jwks.expiresAt < Date.now() || !jwks.keys.some(key => key.kid === jwt.decode(tokens.id_token, { complete: true })?.header.kid))
        jwks = { ...await json(config.jwks_uri), expiresAt: Date.now() + 3600_000 };
      const identity = verifyIdentity(tokens.id_token, jwks.keys, clientId, attempt.nonce);
      if (!sessions.has(session.id) || session.loginState !== state) throw new Error('This ChatGPT sign-in attempt was cancelled or replaced.');
      if (session.subject && session.subject !== identity.sub) throw new Error('The signed-in account changed. Disconnect before switching accounts.');
      session.tokens = credentials(tokens);
      session.subject = identity.sub; session.email = identity.email; session.clientId = clientId;
      session.error = ''; session.pending = false;
      await onCredentialsChanged();
      res.type('text').send('ChatGPT connected. Return to the editor and close this tab.');
    } catch (error) { session.pending = false; session.error = error.message; throw error; }
  });
  app.get(callbackPath, callback);
  app.use(BASE, (req, res, next) => {
    let origin = req.headers.origin;
    try { origin ||= new URL(req.headers.referer).origin; } catch { /* No trusted origin. */ }
    if (!origins.includes(origin) || req.headers['x-editor-agent'] !== '1') return res.status(403).json({ error: 'Untrusted editor origin.' });
    for (const [id, session] of sessions) if (session.expiresAt < Date.now()) sessions.delete(id);
    for (const [state, attempt] of attempts) if (attempt.expiresAt < Date.now()) attempts.delete(state);
    const id = cookieSession(req);
    let session = sessions.get(id);
    if (!session) {
      if (sessions.size >= 100) return res.status(429).json({ error: 'Too many local sessions.' });
      const newId = random(); session = { id: newId, expiresAt: Date.now() + sessionMaxAgeMs }; sessions.set(newId, session);
      res.set('Set-Cookie', `desq_chatgpt=${newId}; HttpOnly; SameSite=${cookieSameSite}; Path=${BASE}; Max-Age=${Math.floor(sessionMaxAgeMs / 1000)}${origin.startsWith('https:') ? '; Secure' : ''}`);
    }
    if (authMode === 'oauth' && session.expiresAt < Date.now() + sessionMaxAgeMs / 2) {
      session.expiresAt = Date.now() + sessionMaxAgeMs;
      res.set('Set-Cookie', `desq_chatgpt=${session.id}; HttpOnly; SameSite=${cookieSameSite}; Path=${BASE}; Max-Age=${Math.floor(sessionMaxAgeMs / 1000)}${origin.startsWith('https:') ? '; Secure' : ''}`);
      onCredentialsChanged();
    }
    req.chatgpt = session; next();
  }, router.json({ limit: '1mb' }));
  app.get(`${BASE}/status`, (req, res) => res.json({ authMode, connected: !!(req.chatgpt.tokens || req.chatgpt.key), pending: !!req.chatgpt.pending,
    registered: !!(req.chatgpt.clientId || req.chatgpt.registrationClientId), email: req.chatgpt.email || '', error: req.chatgpt.error || '' }));
  app.post(`${BASE}/login`, route(async (req, res) => {
    if (authMode !== 'oauth') return res.status(400).json({ error: 'Hosted ChatGPT sign-in is not configured. An OpenAI OAuth client approved for ChatGPT plan usage is required.' });
    if (req.body?.newAccount === true) {
      if (req.chatgpt.tokens) throw new Error('Disconnect ChatGPT before adding another account.');
      for (const field of ['clientId', 'registrationClientId', 'subject', 'email']) delete req.chatgpt[field];
      await onCredentialsChanged();
    }
    const attemptRedirectUri = hostedOAuth?.redirectUri || (getRedirectUri ? await getRedirectUri() : redirectUri);
    const config = await configuration(), session = req.chatgpt;
    for (const [state, attempt] of attempts) if (attempt.sessionId === session.id) attempts.delete(state);
    const state = random(), nonce = random(), verifier = random();
    const clientId = hostedOAuth?.clientId || session.clientId || session.registrationClientId || 'dynamic_agent_client';
    attempts.set(state, { redirectUri: attemptRedirectUri, sessionId: session.id, verifier, nonce, clientId, expiresAt: Date.now() + 5 * 60_000 });
    session.loginState = state;
    session.pending = true; session.error = '';
    const url = new URL(config.authorization_endpoint);
    url.search = new URLSearchParams({ client_id: clientId, ext_agent_host_id: hostId,
      ...(clientId === 'dynamic_agent_client' ? { agent_name_hint: 'Desq Editor Agent' } : {}),
      ...(session.tokens?.id_token ? { id_token_hint: session.tokens.id_token } : {}),
      ...(session.email ? { login_hint: session.email } : {}),
      redirect_uri: attemptRedirectUri, response_type: 'code', scope: 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct',
      resource: RESOURCE, state, nonce, code_challenge_method: 'S256', code_challenge: createHash('sha256').update(verifier).digest('base64url') }).toString();
    res.json({ url: url.href });
  }));
  app.post(`${BASE}/logout`, route(async (req, res) => {
    const session = req.chatgpt;
    session.key = undefined; session.loginState = undefined;
    session.imageController?.abort();
    for (const [state, attempt] of attempts) if (attempt.sessionId === session.id) attempts.delete(state);
    // Wait for an in-flight rotating refresh before revoking the latest token.
    await session.refreshing?.catch(() => {});
    const token = session.tokens?.refresh_token; session.tokens = undefined; session.pending = false;
    session.models = undefined;
    if (authMode === 'oauth') await onCredentialsChanged(); // Never restore signed-out tokens after a restart.
    let revoked = !token;
    try {
      if (token) {
        const config = await configuration();
        if (config.revocation_endpoint) {
          const response = await fetchImpl(config.revocation_endpoint, { method: 'POST', signal: AbortSignal.timeout(10_000),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...clientAuthentication() },
            body: new URLSearchParams({ token, token_type_hint: 'refresh_token', client_id: session.clientId }) });
          revoked = response.ok;
        }
      }
    } catch { /* Always disconnect locally. */ }
    if (authMode !== 'oauth') sessions.delete(session.id);
    res.json({ revoked });
  }));
  app.post(`${BASE}/connect`, route(async (req, res) => {
    if (authMode !== 'api-key') return res.status(400).json({ error: 'Use ChatGPT sign-in on this editor.' });
    if (req.chatgpt.busy) return res.status(409).json({ error: 'ChatGPT is already working.' });
    const key = req.body?.apiKey;
    if (typeof key !== 'string' || !key.trim() || key.length > 512 || /[\r\n]/.test(key)) return res.status(400).json({ error: 'Enter a valid OpenAI API key.' });
    const data = await json(`${RESOURCE}/models`, {headers:{Authorization:`Bearer ${key.trim()}`}});
    if (!Array.isArray(data.models || data.data)) throw new Error('Invalid OpenAI model catalog.');
    req.chatgpt.key = key.trim();
    res.json({connected:true});
  }));
  app.get(`${BASE}/models`, route(async (req, res) => {
    const token = await access(req.chatgpt);
    const data = await json(`${RESOURCE}/models`, { headers: { Authorization: `Bearer ${token}` } });
    const catalog = data.models || data.data || [];
    req.chatgpt.models = new Set(catalog.filter(model => authMode === 'api-key' || model.visibility === 'list').map(model => authMode === 'api-key' ? model.id : model.slug).filter(id => typeof id === 'string'));
    res.json({ catalog, authMode });
  }));
  for (const kind of ['plan', 'image']) app.post(`${BASE}/${kind}`, route(async (req, res) => {
    const session = req.chatgpt, { model } = req.body || {};
    if (!session.models?.has(model)) return res.status(400).json({ error: 'Choose an available ChatGPT model.' });
    const payload = validateProviderPayload(req.body, 'chatgpt', kind === 'image');
    if (session.busy) return res.status(409).json({ error: 'ChatGPT is already working.' });
    session.busy = true;
    const controller = new AbortController(); session.imageController = controller;
    const timeoutMs = kind === 'image' ? 180_000 : 600_000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const cancel = () => { if (!res.writableEnded) controller.abort(); };
    res.on('close', cancel);
    try {
      const token = await access(session);
      const response = await fetchImpl(`${RESOURCE}/responses`, { method: 'POST', signal: controller.signal,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!response.ok) throw await inferenceError(response);
      controller.signal.throwIfAborted();
      if (!session.tokens && !session.key) throw new Error('ChatGPT disconnected. No edits applied.');
      await relayProviderResponse(response, res, { maxBytes: kind === 'image' ? 32_000_000 : 4_000_000,
        version: DECK_AUTHORING_VERSION, ...(kind === 'image' ? { imageModel: model } : {}) });
    } finally { clearTimeout(timer); res.off('close', cancel); session.busy = false; session.imageController = undefined; }
  }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    // Do not expose upstream response bodies or credentials.
    res.status(400).json({ error: error.name === 'AbortError' ? 'ChatGPT request cancelled or timed out.' : error.message });
  });
  return app;
}
