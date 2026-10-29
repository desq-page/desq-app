import { preparedBody, browserResult } from './provider-test-client.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createServer as createHTTP2Server, connect as connectHTTP2 } from 'node:http2';
import { generateKeyPairSync } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { createAgentService, snapshotAgentState, restoreAgentState } from '../cloudflare-publisher/src/agent/service.mjs';
import { createNodeAgentHost } from '../cloudflare-publisher/src/agent/node.mjs';
import worker, { AgentSession } from '../cloudflare-publisher/src/worker.js';

const origin = 'https://savanna.example';
const context = { document: { fileId: 'f' }, page: { pageId: 'p' } };
const plan = JSON.stringify({ message: 'Ready', calls: [] });
const image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9iUAAAAASUVORK5CYII=';
const googleModels = { models: [{ name: 'models/gemini-test', supportedGenerationMethods: ['generateContent'] }] };
const completed = { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: plan }] }] };
function providerFetch(url, options) {
  if (url.includes('googleapis.com')) {
    assert.equal(options.headers['x-goog-api-key'], 'google-secret');
    if (url.includes('/models?')) return Promise.resolve(Response.json(googleModels));
    if (url.includes('flash-image')) return Promise.resolve(Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ inlineData: { mimeType: 'image/png', data: image } }] } }] }));
    return Promise.resolve(Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: plan }] } }] }));
  }
  assert.equal(options.headers.Authorization, 'Bearer openai-secret');
  if (url.endsWith('/models')) return Promise.resolve(Response.json({ data: [{ id: 'gpt-test' }, { id: 'text-embedding-3-small' }, { id: 'gpt-image-test' }] }));
  const body = JSON.parse(options.body);
  return Promise.resolve(body.tools ? Response.json({ status: 'completed', output: [{ type: 'image_generation_call', status: 'completed', result: image }] })
    : new Response(`data: ${JSON.stringify({ type: 'response.completed', response: completed })}\n\n`, { headers: { 'Content-Type': 'text/event-stream' } }));
}
function client(fetcher, host = origin) {
  const cookies = new Map();
  return async (provider, path, body, extra = {}) => {
    const headers = { Origin: host, 'X-Editor-Agent': '1', Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join(';'), ...extra };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetcher(new Request(`${host}/api/agent/${provider}/${path}`, {
      method: body === undefined ? 'GET' : 'POST', headers, ...(body !== undefined ? { body: JSON.stringify(preparedBody(provider, path, body)) } : {}),
    }));
    for (const cookie of response.headers.getSetCookie()) { const [name, ...parts] = cookie.split(';')[0].split('='); cookies.set(name, parts.join('=')); }
    return { status: response.status, data: await browserResult(provider, path, response) };
  };
}
const serviceOptions = { origins: [origin], hostId: 'urn:uuid:test', fetchImpl: providerFetch };

test('service worker leaves agent authentication and inference requests to the network', async () => {
  let handleFetch, networkCalls = 0;
  const source = readFileSync(new URL('../editor-vuejs/service-worker.js', import.meta.url), 'utf8').replace(/^import[^\n]*\n/gm, '');
  const self = { location: { origin }, addEventListener(type, handler) { if (type === 'fetch') handleFetch = handler; } };
  new Function('self', 'setupDB', 'isPublishedPath', 'fetch', source)(self, () => {}, () => false,
    async () => { networkCalls++; return new Response('network'); });
  for (const path of ['/api/agent', '/api/agent/chatgpt/status', '/api/agent/chatgpt/login', '/api/agent/gemini/connect']) {
    handleFetch({ request: new Request(`${origin}${path}`), respondWith() { assert.fail('Agent requests must bypass the resource handler.'); } });
  }
  handleFetch({ request: new Request(`${origin}/other-resource`), respondWith() { assert.fail('Ordinary network resources must bypass the resource handler.'); } });
  assert.equal(networkCalls, 0);
});

test('one Fetch host serves both providers, inference and images, with isolated browser credentials', async () => {
  const service = createAgentService(serviceOptions), api = client(r => service.fetch(r)), other = client(r => service.fetch(r));
  assert.equal((await api('chatgpt', 'status')).data.authMode, 'api-key');
  assert.equal((await api('chatgpt', 'login', {})).status, 400);
  assert.equal((await api('chatgpt', 'connect', { apiKey: 'openai-secret' })).status, 200);
  const models = await api('chatgpt', 'models');
  assert.deepEqual(models.data.models, [{ id: 'gpt-test', label: 'gpt-test' }]);
  assert.equal((await api('chatgpt', 'plan', { model: 'gpt-test', command: 'Hello', context })).data.text, plan);
  assert.ok((await api('chatgpt', 'image', { model: 'gpt-test', query: 'Sunrise', alt: 'Sunrise' })).data.data);
  assert.equal((await other('chatgpt', 'status')).data.connected, false);
  assert.equal((await other('chatgpt', 'models')).status, 400);
  assert.equal((await api('gemini', 'connect', { apiKey: 'google-secret' })).status, 200);
  assert.equal((await api('gemini', 'plan', { model: 'models/gemini-test', command: 'Hello', context })).data.text, plan);
  assert.ok((await api('gemini', 'image', { query: 'Sunrise', alt: 'Sunrise' })).data.data);
  assert.equal((await other('gemini', 'plan', { model: 'models/gemini-test', command: 'Hello', context })).status, 401);
  assert.equal((await api('chatgpt', 'logout', {})).status, 200);
  assert.equal((await api('chatgpt', 'status')).data.connected, false);
  assert.equal((await api('gemini', 'disconnect', {})).status, 200);
});

test('shared host validates origin, Host, JSON size and endpoint boundaries before upstream access', async () => {
  const service = createAgentService({ ...serviceOptions, fetchImpl: () => { throw Error('Unexpected upstream request'); } });
  const api = client(r => service.fetch(r));
  assert.equal((await api('gemini', 'connect', {}, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await api('chatgpt', 'status', undefined, { 'X-Editor-Agent': '' })).status, 403);
  assert.equal((await service.fetch(new Request('https://evil.example/api/agent/chatgpt/status', { headers: { Origin: origin, 'X-Editor-Agent': '1' } }))).status, 403);
  assert.equal((await api('gemini', 'connect', { apiKey: 'a'.repeat(1_100_000) })).status, 413);
  assert.equal((await service.fetch(new Request(`${origin}/api/agent/gemini/connect`, { method: 'POST', headers: { Origin: origin, 'X-Editor-Agent': '1', 'Content-Type': 'application/json' }, body: '{bad' }))).status, 400);
  assert.equal((await api('gemini', 'unknown')).status, 404);
});

test('credential snapshots restore model sets, omit in-flight work and discard expired sessions', async () => {
  const service = createAgentService(serviceOptions), api = client(r => service.fetch(r));
  await api('gemini', 'connect', { apiKey: 'google-secret' });
  const session = [...service.state.gemini.values()][0];
  session.controller = new AbortController(); session.busy = true; session.refreshing = Promise.resolve();
  service.state.chatgpt.set('expired', { expiresAt: 1, key: 'expired-secret' });
  const snapshot = structuredClone(snapshotAgentState(service.state));
  const restored = restoreAgentState(snapshot);
  assert.equal(restored.chatgpt.size, 0);
  assert.deepEqual([...restored.gemini.values()][0].models, new Set(['models/gemini-test']));
  assert.equal([...restored.gemini.values()][0].controller, undefined);
  const revived = createAgentService({ ...serviceOptions, state: restored });
  const oldId = [...restored.gemini.keys()][0];
  const response = await revived.fetch(new Request(`${origin}/api/agent/gemini/plan`, { method: 'POST', headers: { Origin: origin, 'X-Editor-Agent': '1', 'Content-Type': 'application/json', Cookie: `savanna_gemini=${oldId}` }, body: JSON.stringify(preparedBody('gemini', 'plan', { model: 'models/gemini-test', command: 'Hi', context })) }));
  assert.equal(response.status, 200);
});

test('Fetch cancellation aborts provider inference and clears its busy controller', async () => {
  let started;
  const pending = new Promise(resolve => { started = resolve; });
  const service = createAgentService({ ...serviceOptions, fetchImpl: (url, options) => {
    if (url.includes('/models?')) return providerFetch(url, options);
    started();
    return new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true }));
  } });
  const api = client(r => service.fetch(r));
  await api('gemini', 'connect', { apiKey: 'google-secret' });
  const id = [...service.state.gemini.keys()][0], controller = new AbortController();
  const response = service.fetch(new Request(`${origin}/api/agent/gemini/plan`, { method: 'POST', signal: controller.signal,
    headers: { Origin: origin, 'X-Editor-Agent': '1', 'Content-Type': 'application/json', Cookie: `savanna_gemini=${id}` },
    body: JSON.stringify(preparedBody('gemini', 'plan', { model: 'models/gemini-test', command: 'Hi', context })),
  }));
  await pending; controller.abort();
  assert.equal((await response).status, 400);
  assert.equal(service.state.gemini.get(id).controller, undefined);
});

test('Vite/Node host runs OAuth on an automatic loopback port and preserves exact callback URI', async t => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const key = { ...publicKey.export({ format: 'jwk' }), kid: 'test' };
  let nonce, redirect;
  const host = createNodeAgentHost({ origins: ['http://localhost:6173'], localOAuth: true, persistOAuth: false, hostId: 'urn:uuid:test', fetchImpl: async (url, options) => {
    if (url.endsWith('openid-configuration')) return Response.json({ issuer: 'https://auth.openai.com', authorization_endpoint: 'https://auth.openai.com/authorize', token_endpoint: 'https://auth.openai.com/token', jwks_uri: 'https://auth.openai.com/jwks' });
    if (url.endsWith('/jwks')) return Response.json({ keys: [key] });
    assert.equal(url, 'https://auth.openai.com/token');
    assert.equal(options.body.get('redirect_uri'), redirect);
    return Response.json({ access_token: 'secret', token_type: 'Bearer', expires_in: 3600, scope: 'chatgpt.tokens.use.direct',
      id_token: jwt.sign({ sub: 'user', nonce }, privateKey, { algorithm: 'RS256', keyid: 'test', issuer: 'https://auth.openai.com', audience: 'oaiapp_test', expiresIn: '1h' }) });
  } });
  t.after(() => host.close());
  const api = client(r => host.service.fetch(r), 'http://localhost:6173');
  const login = await api('chatgpt', 'login', {}), url = new URL(login.data.url);
  redirect = url.searchParams.get('redirect_uri'); nonce = url.searchParams.get('nonce');
  assert.equal(new URL(redirect).hostname, '127.0.0.1'); assert.notEqual(new URL(redirect).port, '0');
  const callback = `${redirect}?${new URLSearchParams({ state: url.searchParams.get('state'), code: 'test-code', client_id: 'oaiapp_test' })}`;
  assert.equal((await fetch(callback)).status, 200);
  assert.equal((await api('chatgpt', 'status')).data.connected, true);
  assert.equal((await fetch(callback)).status, 400); // One-time consumption.
});

test('Node middleware serves both providers on the editor HTTP listener', async t => {
  const host = createNodeAgentHost(serviceOptions);
  const server = createServer(host.middleware).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => { host.close(); server.closeAllConnections(); server.close(); });
  // Configure the actual HTTP listener origin rather than trusting forwarded headers.
  const local = `http://127.0.0.1:${server.address().port}`;
  const real = createNodeAgentHost({ ...serviceOptions, origins: [local] });
  server.removeAllListeners('request'); server.on('request', real.middleware);
  const api = client(r => fetch(r), local);
  assert.equal((await api('gemini', 'connect', { apiKey: 'google-secret' })).status, 200);
  assert.equal((await api('chatgpt', 'status')).status, 200);
});

test('HTTP/2 editor requests normalize pseudo-headers for status, OAuth login and API-key POST bodies', async t => {
  const origin = 'http://localhost:6173';
  const host = createNodeAgentHost({ origins: [origin], localOAuth: true, persistOAuth: false, hostId: 'urn:uuid:test', fetchImpl: async (url, options) => {
    if (url.endsWith('openid-configuration')) return Response.json({ issuer: 'https://auth.openai.com', authorization_endpoint: 'https://auth.openai.com/authorize', token_endpoint: 'https://auth.openai.com/token', jwks_uri: 'https://auth.openai.com/jwks' });
    return providerFetch(url, options);
  } });
  const server = createHTTP2Server(host.middleware).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const session = connectHTTP2(`http://127.0.0.1:${server.address().port}`);
  t.after(() => { session.destroy(); host.close(); server.close(); });
  const cookies = new Map();
  async function api(path, body) {
    const stream = session.request({ ':method': body === undefined ? 'GET' : 'POST', ':path': `/api/agent/${path}`, ':authority': 'localhost:6173',
      origin, 'x-editor-agent': '1', cookie: [...cookies.values()].join('; '), ...(body === undefined ? {} : { 'content-type': 'application/json' }) });
    let status, result = '';
    stream.setEncoding('utf8');
    stream.on('response', headers => {
      status = headers[':status'];
      for (const cookie of headers['set-cookie'] || []) { const pair = cookie.split(';')[0]; cookies.set(pair.split('=')[0], pair); }
    });
    stream.on('data', chunk => { result += chunk; });
    stream.end(body === undefined ? undefined : JSON.stringify(body));
    await new Promise((resolve, reject) => { stream.on('end', resolve); stream.on('error', reject); });
    return { status, data: JSON.parse(result) };
  }
  const status = await api('chatgpt/status');
  assert.equal(status.status, 200); assert.equal(status.data.authMode, 'oauth');
  const login = await api('chatgpt/login', {});
  assert.equal(login.status, 200, login.data.error);
  assert.equal(new URL(login.data.url).origin, 'https://auth.openai.com');
  assert.equal((await api('chatgpt/status')).data.pending, true);
  const gemini = await api('gemini/connect', { apiKey: 'google-secret' });
  assert.equal(gemini.status, 200, gemini.data.error);
  assert.equal(gemini.data.catalog[0].name, 'models/gemini-test');
});

test('Cloudflare routes agent APIs on the editor origin and restores isolated Durable Object sessions', async t => {
  const previous = globalThis.fetch; globalThis.fetch = providerFetch; t.after(() => { globalThis.fetch = previous; });
  const stores = new Map();
  const env = { PUBLIC_ORIGIN: origin, API_ORIGIN: 'https://api.example', AGENT_SESSIONS: {
    idFromName: name => name,
    get(id) { return { async fetch(request) {
      if (!stores.has(id)) stores.set(id, new Map());
      const store = stores.get(id);
      const ctx = { blockConcurrencyWhile: fn => fn(), storage: {
        get: async key => structuredClone(store.get(key)), put: async (key, value) => store.set(key, structuredClone(value)),
        setAlarm: async () => {}, deleteAll: async () => store.clear(),
      } };
      // Recreate the object for every request to exercise cold-start hydration.
      return new AgentSession(ctx, env).fetch(request);
    } }; },
  } };
  const api = client(r => worker.fetch(r, env, {})), other = client(r => worker.fetch(r, env, {}));
  assert.equal((await api('gemini', 'connect', { apiKey: 'google-secret' })).status, 200);
  assert.equal((await api('gemini', 'plan', { model: 'models/gemini-test', command: 'Hi', context })).data.text, plan);
  assert.equal((await other('gemini', 'plan', { model: 'models/gemini-test', command: 'Hi', context })).status, 401);
  assert.equal((await api('chatgpt', 'connect', { apiKey: 'openai-secret' })).status, 200);
  assert.equal((await api('chatgpt', 'models')).status, 200);
  assert.equal((await api('chatgpt', 'plan', { model: 'gpt-test', command: 'Hi', context })).data.text, plan);
  assert.equal((await api('gemini', 'connect', {}, { Origin: 'https://evil.example' })).status, 403);
});
