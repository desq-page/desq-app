import { geminiAPIError } from './gemini-errors.mjs';
import { relayProviderResponse, validateProviderPayload } from './proxy.mjs';
import { createRouter } from './router.mjs';
import { randomBytes } from 'node:crypto';
import { DECK_AUTHORING_VERSION } from '../../../editor-vuejs/src/lib/agent/deck-authoring.mjs';

const BASE = '/api/agent/gemini';
const API = 'https://generativelanguage.googleapis.com/v1beta';

export function createGeminiProvider({ apiKey, fetchImpl = fetch, router = createRouter, trustedRequest, sessions = new Map(), imageModel = 'gemini-2.5-flash-image',
  origins = ['https://localhost:6173', 'https://127.0.0.1:6173', 'http://localhost:6173', 'http://127.0.0.1:6173'] } = {}) {
  const app = router();
  app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store'); res.set('Referrer-Policy', 'no-referrer');
    res.set('X-Content-Type-Options', 'nosniff');
    let origin = req.headers.origin;
    try { origin ||= new URL(req.headers.referer).origin; } catch { /* Missing trusted origin. */ }
    if ((trustedRequest ? !trustedRequest(req) : req.headers.host !== `127.0.0.1:${req.socket.localPort}`) || !origins.includes(origin) || req.headers['x-editor-agent'] !== '1')
      return res.status(403).json({ error: 'Only the trusted local editor can use this Gemini companion.' });
    for (const [id, session] of sessions) if (session.expiresAt < Date.now()) {
      session.controller?.abort(); session.key = undefined; sessions.delete(id);
    }
    const cookie = req.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith('savanna_gemini='));
    let session = sessions.get(cookie?.slice('savanna_gemini='.length));
    if (!session) {
      if (sessions.size >= 100) return res.status(429).json({ error: 'Too many local Gemini sessions.' });
      const id = randomBytes(32).toString('base64url');
      session = { id, expiresAt: Date.now() + 8 * 3600_000 }; sessions.set(id, session);
      res.set('Set-Cookie', `savanna_gemini=${id}; HttpOnly; SameSite=Strict; Path=${BASE}; Max-Age=28800${origin.startsWith('https:') ? '; Secure' : ''}`);
    }
    req.gemini = session; next();
  });
  app.use(BASE, router.json({ limit: '1mb' }));
  const route = handler => (req, res, next) => Promise.resolve(handler(req, res)).catch(next);
  async function google(path, key, signal, body, raw = false) {
    const response = await fetchImpl(`${API}/${path}`, { method: body === undefined ? 'GET' : 'POST', signal,
      headers: { 'x-goog-api-key': key, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    if (!response.ok) throw await geminiAPIError(response, path.startsWith('models?') ? 'models' : 'generation');
    if (raw) return response;
    // Bound the response even when a provider ignores its generation budget.
    const reader = response.body.getReader(), chunks = []; let bytes = 0;
    try {
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        bytes += value.byteLength;
        if (bytes > 2_000_000) throw new Error('Gemini response exceeded the allowed size.');
        chunks.push(value);
      }
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  }
  async function work(req, res, handler, timeoutMs = 120_000) {
    const session = req.gemini;
    if (session.controller) return res.status(409).json({ error: 'Gemini is already working.' });
    const controller = new AbortController(); session.controller = controller;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const cancel = () => { if (!res.writableEnded) controller.abort(); };
    res.on('close', cancel);
    try { await handler(session, controller.signal); }
    finally { clearTimeout(timer); res.off('close', cancel); if (session.controller === controller) session.controller = undefined; }
  }
  app.post(`${BASE}/connect`, route((req, res) => work(req, res, async (session, signal) => {
    const supplied = req.body?.apiKey;
    if (supplied !== undefined && (typeof supplied !== 'string' || supplied.length > 512 || /[\r\n]/.test(supplied)))
      return res.status(400).json({ error: 'Enter a valid Gemini API key.' });
    const key = supplied?.trim() || session.key || apiKey;
    if (!key) return res.status(400).json({ error: 'Enter a Google AI Studio API key or set GEMINI_API_KEY on the companion.' });
    if (typeof key !== 'string' || key.length > 512 || /[\r\n]/.test(key)) throw new Error('The Gemini API key is invalid.');
    const data = await google('models?pageSize=100', key, signal);
    signal.throwIfAborted();
    session.key = key;
    session.models = new Set((data.models || []).map(model => model.name).filter(name => /^models\/gemini-[a-zA-Z0-9._-]+$/.test(name)));
    res.json({ catalog: data.models || [], nextPageToken: data.nextPageToken, imageModel });
  })));
  app.get(`${BASE}/models`, route((req, res) => work(req, res, async (session, signal) => {
    if (!session.key) return res.status(401).json({ error: 'Connect Gemini before loading models.' });
    const pageToken = req.query.pageToken;
    if (pageToken !== undefined && (typeof pageToken !== 'string' || pageToken.length > 2048))
      return res.status(400).json({ error: 'Invalid model catalog page.' });
    const query = new URLSearchParams({ pageSize: '100', ...(pageToken ? { pageToken } : {}) });
    const data = await google(`models?${query}`, session.key, signal);
    for (const model of data.models || []) if (/^models\/gemini-[a-zA-Z0-9._-]+$/.test(model.name)) session.models.add(model.name);
    res.json({ catalog: data.models || [], nextPageToken: data.nextPageToken });
  })));
  app.post(`${BASE}/disconnect`, (req, res) => {
    const session = req.gemini;
    session.controller?.abort(); session.key = undefined; sessions.delete(session.id);
    res.json({ disconnected: true });
  });
  for (const kind of ['plan', 'image']) app.post(`${BASE}/${kind}`, route((req, res) => work(req, res, async (session, signal) => {
    if (!session.key) return res.status(401).json({ error: 'Connect Gemini before sending a command.' });
    const model = kind === 'image' ? `models/${imageModel.replace(/^models\//, '')}` : req.body?.model;
    if (!/^models\/gemini-[a-zA-Z0-9._-]+$/.test(model) || (kind === 'plan' && !session.models?.has(model)))
      return res.status(400).json({ error: 'Choose an available Gemini model.' });
    const payload = validateProviderPayload(req.body, 'gemini', kind === 'image');
    const response = await google(`${model}:generateContent`, session.key, signal, payload, true);
    signal.throwIfAborted();
    if (!session.key) throw new Error('Gemini disconnected. No edits applied.');
    await relayProviderResponse(response, res, { maxBytes: kind === 'image' ? 16_000_000 : 2_000_000,
      version: DECK_AUTHORING_VERSION, ...(kind === 'image' ? { imageModel: model.replace(/^models\//, '') } : {}) });
  }, kind === 'image' ? 180_000 : 120_000)));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    res.status(400).json({ error: error.name === 'AbortError' ? 'Gemini request cancelled or timed out.'
      : error instanceof SyntaxError ? 'Gemini returned an invalid response. No edits applied.' : error.message });
  });
  return app;
}
