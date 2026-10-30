import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { hostedOAuthConfiguration } from '../cloudflare-publisher/src/agent/hosted-oauth.mjs';
import { createAgentService } from '../cloudflare-publisher/src/agent/service.mjs';
import { agentRequest } from '../cloudflare-publisher/src/agent.js';
const origin = 'https://desq.example';
const env = { OPENAI_OAUTH_CLIENT_ID: 'oaiapp_hosted', OPENAI_OAUTH_PLAN_ENABLED: 'true' };

test('hosted OAuth requires an approved plan client and exact same-origin HTTPS callback', () => {
  assert.equal(hostedOAuthConfiguration({}, [origin]), undefined);
  assert.throws(() => hostedOAuthConfiguration({ OPENAI_OAUTH_CLIENT_ID: 'client' }, [origin]), /approval/);
  for (const redirect of ['http://desq.example/api/agent/chatgpt/callback', 'https://evil.example/api/agent/chatgpt/callback', `${origin}/auth/callback`, `${origin}/api/agent/chatgpt/callback?bad=1`])
    assert.throws(() => hostedOAuthConfiguration({ ...env, OPENAI_OAUTH_REDIRECT_URI: redirect }, [origin]), /registered HTTPS/);
});

test('registered hosted OAuth binds the browser, verifies identity, refreshes and rejects replay or identity-only scopes', async () => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const key = { ...publicKey.export({ format: 'jwk' }), kid: 'hosted' };
  const hostedOAuth = hostedOAuthConfiguration({ ...env, OPENAI_OAUTH_CLIENT_SECRET: 'private:secret' }, [origin]);
  let nonce, scope = 'chatgpt.tokens.use.direct', exchanges = 0;
  const service = createAgentService({ origins: [origin], hostId: 'urn:uuid:test', hostedOAuth, fetchImpl: async (url, options) => {
    if (url.endsWith('openid-configuration')) return Response.json({ issuer: 'https://auth.openai.com', authorization_endpoint: 'https://auth.openai.com/authorize', token_endpoint: 'https://auth.openai.com/token', jwks_uri: 'https://auth.openai.com/jwks' });
    if (url.endsWith('/jwks')) return Response.json({ keys: [key] });
    assert.equal(url, 'https://auth.openai.com/token');
    assert.equal(options.headers.Authorization, `Basic ${Buffer.from('oaiapp_hosted:private%3Asecret').toString('base64')}`);
    assert.equal(options.body.has('client_secret'), false);
    assert.equal(options.body.get('client_id'), 'oaiapp_hosted');
    if (options.body.get('grant_type') === 'authorization_code') {
      assert.equal(options.body.get('redirect_uri'), hostedOAuth.redirectUri);
      assert.ok(options.body.get('code_verifier'));
    }
    exchanges++;
    return Response.json({ access_token: 'private-access', refresh_token: 'private-refresh', token_type: 'Bearer', expires_in: 3600, scope,
      id_token: jwt.sign({ sub: 'user', nonce }, privateKey, { algorithm: 'RS256', keyid: key.kid, issuer: 'https://auth.openai.com', audience: 'oaiapp_hosted', expiresIn: '1h' }) });
  } });
  let cookie = '';
  const request = async (path, body) => {
    const result = await service.fetch(new Request(`${origin}/api/agent/chatgpt/${path}`, {
      method: body ? 'POST' : 'GET', headers: { Origin: origin, 'X-Editor-Agent': '1', Cookie: cookie, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }));
    if (result.headers.get('set-cookie')) cookie = result.headers.get('set-cookie').split(';')[0];
    return result;
  };
  const status = await request('status');
  assert.match(status.headers.get('set-cookie'), /SameSite=Lax/);
  assert.equal((await status.json()).authMode, 'oauth');
  const login = new URL((await (await request('login', {})).json()).url);
  assert.equal(login.searchParams.get('client_id'), env.OPENAI_OAUTH_CLIENT_ID);
  assert.equal(login.searchParams.get('redirect_uri'), hostedOAuth.redirectUri);
  assert.ok(!login.href.includes('private'));
  nonce = login.searchParams.get('nonce');
  const callback = `${hostedOAuth.redirectUri}?${new URLSearchParams({ state: login.searchParams.get('state'), code: 'authorization-code' })}`;
  assert.equal((await service.fetch(new Request(callback))).status, 400);
  assert.equal(exchanges, 0);
  const connected = await service.fetch(new Request(callback, { headers: { Cookie: cookie } }));
  assert.equal(connected.status, 200);
  assert.equal((await (await request('status')).json()).connected, true);
  assert.equal((await service.fetch(new Request(callback, { headers: { Cookie: cookie } }))).status, 400);
  const session = [...service.state.chatgpt.values()][0];
  session.tokens.expiresAt = 0;
  // Catalog request reaches the refresh exchange first; the mock then rejects
  // /models. Confirm renewal authenticated with the registered confidential client.
  await request('models');
  assert.equal(exchanges, 2);
  assert.ok(session.tokens.expiresAt > Date.now());
  await request('logout', {});
  scope = 'openid profile email';
  const second = new URL((await (await request('login', {})).json()).url);
  nonce = second.searchParams.get('nonce');
  const denied = await service.fetch(new Request(`${hostedOAuth.redirectUri}?state=${second.searchParams.get('state')}&code=identity-only`, { headers: { Cookie: cookie } }));
  assert.equal(denied.status, 400);
  assert.equal((await (await request('status')).json()).connected, false);
});

test('Cloudflare accepts only configured callbacks with an existing browser session', async () => {
  let forwarded = 0;
  const config = { ...env, PUBLIC_ORIGIN: origin, AGENT_SESSIONS: {
    idFromName: id => id,
    get: () => ({ fetch: async () => { forwarded++; return new Response('callback'); } }),
  } };
  const callback = new Request(`${origin}/api/agent/chatgpt/callback?state=test`);
  assert.equal((await agentRequest(callback, config)).status, 400);
  assert.equal(forwarded, 0);
  const cookie = `__Host-desq_agent=${'a'.repeat(64)}`;
  assert.equal((await agentRequest(new Request(callback, { headers: { Cookie: cookie } }), config)).status, 200);
  assert.equal(forwarded, 1);
  assert.equal((await agentRequest(new Request(`${origin}/api/agent/chatgpt/login`, { headers: { Cookie: cookie } }), config)).status, 403);
  assert.equal((await agentRequest(new Request(callback, { headers: { Cookie: cookie } }), { ...config, OPENAI_OAUTH_CLIENT_ID: undefined })).status, 403);
});
