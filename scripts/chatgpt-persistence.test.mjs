import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateKeyPairSync } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { localOAuthStore } from '../cloudflare-publisher/src/agent/oauth-store.mjs';
import { createNodeAgentHost } from '../cloudflare-publisher/src/agent/node.mjs';
const origin = 'http://localhost:6173';
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const key = { ...publicKey.export({ format: 'jwk' }), kid: 'saved-key' };

function temporary(t) {
  const directory = mkdtempSync(join(tmpdir(), 'savanna-oauth-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

test('OAuth store preserves only connection data with private atomic files and origin isolation', t => {
  const directory = temporary(t), options = { directory, hostId: 'host', origins: [origin] };
  const store = localOAuthStore(options);
  const token = { access_token: 'test-access', refresh_token: 'test-refresh', expiresAt: Date.now() + 3600000, scope: 'chatgpt.tokens.use.direct', irrelevant: 'omit' };
  store.save(new Map([['session', { id: 'session', expiresAt: Date.now() + 3600000, clientId: 'oaiapp_test', tokens: token,
    key: 'never-save-api-key', loginState: 'never-save-pkce-state', models: new Set(['model']), controller: new AbortController() }]]));
  const text = readFileSync(store.path, 'utf8');
  for (const value of ['never-save-api-key', 'never-save-pkce-state', 'irrelevant', 'controller', 'models']) assert.ok(!text.includes(value));
  assert.equal(store.load().get('session').tokens.refresh_token, 'test-refresh');
  if (process.platform !== 'win32') {
    assert.equal(statSync(directory).mode & 0o777, 0o700);
    assert.equal(statSync(store.path).mode & 0o777, 0o600);
  }
  assert.equal(localOAuthStore({ ...options, origins: ['http://localhost:7000'] }).load().size, 0);
  store.save(new Map([['session', { id: 'session', expiresAt: Date.now() + 3600000, clientId: 'oaiapp_test' }]]));
  assert.equal(store.load().get('session').tokens, undefined);
  writeFileSync(store.path, '{broken');
  assert.throws(() => store.load(), /saved ChatGPT connection is invalid/);
});

function runtime(t) {
  const directory = temporary(t);
  let nonce, redirect, mode = 'ok', refreshes = 0, refreshToken = 'refresh-1', revoked;
  const fetchImpl = async (url, options = {}) => {
    if (url.endsWith('openid-configuration')) return Response.json({ issuer: 'https://auth.openai.com', authorization_endpoint: 'https://auth.openai.com/authorize',
      token_endpoint: 'https://auth.openai.com/token', jwks_uri: 'https://auth.openai.com/jwks', revocation_endpoint: 'https://auth.openai.com/revoke' });
    if (url.endsWith('/jwks')) return Response.json({ keys: [key] });
    if (url.endsWith('/token')) {
      assert.equal(options.body.get('client_id'), 'oaiapp_saved');
      if (options.body.get('grant_type') === 'refresh_token') {
        assert.equal(options.body.get('refresh_token'), refreshToken);
        if (mode === 'network') throw new TypeError('Temporary network failure');
        if (mode === 'rejected') return Response.json({ error: 'invalid_grant' }, { status: 400 });
        refreshes++; refreshToken = `refresh-${refreshes + 1}`;
        return Response.json({ access_token: `refreshed-${refreshes}`, refresh_token: refreshToken, token_type: 'Bearer', expires_in: 3600 });
      }
      assert.equal(options.body.get('redirect_uri'), redirect);
      return Response.json({ access_token: 'access-1', refresh_token: refreshToken, token_type: 'Bearer', expires_in: 3600, scope: 'chatgpt.tokens.use.direct',
        id_token: jwt.sign({ sub: 'account', email: 'user@example.test', nonce }, privateKey,
          { algorithm: 'RS256', keyid: 'saved-key', issuer: 'https://auth.openai.com', audience: 'oaiapp_saved', expiresIn: '1h' }) });
    }
    if (url.endsWith('/models')) return Response.json({ models: [{ slug: 'model', visibility: 'list', display_name: 'Model' }] });
    if (url.endsWith('/revoke')) { revoked = options.body.get('token'); return new Response(''); }
    throw new Error('Unexpected endpoint');
  };
  let host;
  const start = () => host = createNodeAgentHost({ origins: [origin], localOAuth: true, credentialDirectory: directory, fetchImpl });
  start(); t.after(() => host.close());
  let cookie;
  const api = async (path, body) => {
    const response = await host.service.fetch(new Request(`${origin}/api/agent/chatgpt/${path}`, { method: body === undefined ? 'GET' : 'POST',
      headers: { Origin: origin, 'X-Editor-Agent': '1', 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) }));
    cookie = response.headers.get('set-cookie')?.split(';')[0] || cookie;
    return { response, data: await response.json() };
  };
  return { api, get host() { return host; }, setMode(value) { mode = value; }, get refreshes() { return refreshes; }, get revoked() { return revoked; },
    async signIn() {
      const { data } = await api('login', {}), url = new URL(data.url);
      nonce = url.searchParams.get('nonce'); redirect = url.searchParams.get('redirect_uri');
      const response = await host.service.callback(new Request(`${redirect}?${new URLSearchParams({ state: url.searchParams.get('state'), code: 'code', client_id: 'oaiapp_saved' })}`));
      assert.equal(response.status, 200, await response.text());
      return url;
    },
    restart() { host.close(); start(); },
    async newBrowserStatus() {
      const saved = cookie; cookie = undefined;
      const result = await api('status'); cookie = saved; return result;
    },
  };
}

test('local OAuth survives restarts, persists rotating refresh tokens and retains registration after sign-out', async t => {
  const f = runtime(t);
  const anonymous = await f.api('status');
  assert.match(anonymous.response.headers.get('set-cookie'), /Max-Age=2592000/);
  assert.match(anonymous.response.headers.get('set-cookie'), /HttpOnly/);
  const first = await f.signIn();
  assert.equal(first.searchParams.get('client_id'), 'dynamic_agent_client');
  f.restart();
  assert.equal((await f.api('status')).data.connected, true);
  assert.equal((await f.newBrowserStatus()).data.connected, false);
  let session = [...f.host.service.state.chatgpt.values()].find(session => session.clientId);
  session.tokens.expiresAt = 0;
  assert.equal((await f.api('models')).response.status, 200);
  assert.equal(f.refreshes, 1);
  f.restart();
  session = [...f.host.service.state.chatgpt.values()].find(session => session.clientId);
  assert.equal(session.tokens.refresh_token, 'refresh-2');
  assert.equal((await f.api('logout', {})).data.revoked, true);
  assert.equal(f.revoked, 'refresh-2');
  f.restart();
  const status = (await f.api('status')).data;
  assert.equal(status.connected, false); assert.equal(status.registered, true);
  assert.ok(!JSON.stringify(status).includes('refresh-'));
  const returning = new URL((await f.api('login', {})).data.url);
  assert.equal(returning.searchParams.get('client_id'), 'oaiapp_saved');
  assert.equal(returning.searchParams.has('agent_name_hint'), false);
  assert.equal(returning.searchParams.get('login_hint'), 'user@example.test');
  const another = new URL((await f.api('login', { newAccount: true })).data.url);
  assert.equal(another.searchParams.get('client_id'), 'dynamic_agent_client');
  assert.equal(another.searchParams.get('agent_name_hint'), 'Savanna Editor Agent');
});

test('temporary refresh failure retains credentials; rejected grants clear tokens but preserve registration', async t => {
  const f = runtime(t); await f.signIn();
  const session = [...f.host.service.state.chatgpt.values()][0];
  session.tokens.expiresAt = 0;
  f.setMode('network'); assert.equal((await f.api('models')).response.status, 400);
  assert.equal(session.tokens.refresh_token, 'refresh-1');
  f.setMode('ok'); assert.equal((await f.api('models')).response.status, 200);
  session.tokens.expiresAt = 0;
  f.setMode('rejected'); assert.equal((await f.api('models')).response.status, 400);
  assert.equal(session.tokens, undefined);
  f.restart();
  const status = (await f.api('status')).data;
  assert.equal(status.connected, false); assert.equal(status.registered, true);
});
