import { preparedBody, browserResult } from './provider-test-client.mjs';
import { readCompletedResponse } from '../editor-vuejs/src/lib/agent/openai-response.mjs';
import { inferenceError } from '../editor-vuejs/src/lib/agent/provider-errors.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import jwt from 'jsonwebtoken';
import express from 'express';
import { createChatGPTProvider, verifyIdentity, connectionError } from '../cloudflare-publisher/src/agent/chatgpt.mjs';
import { chatgptRequest, createChatGPTAgent } from '../editor-vuejs/src/lib/agent/chatgpt-agent.mjs';
import { createEditorTools } from '../editor-vuejs/src/lib/agent/editor-tools.mjs';

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const key = { ...publicKey.export({ format: 'jwk' }), kid: 'test-key' };
const sign = (claims = {}, options = {}) => jwt.sign({ sub: 'user', nonce: 'nonce', ...claims }, privateKey,
  { algorithm: 'RS256', keyid: key.kid, issuer: 'https://auth.openai.com', audience: 'oaiapp_test', expiresIn: '1h', ...options });
const origin = 'https://localhost:6173';
const context = { document: { fileId: 'file', selectedShapeIds: ['shape'], pages: [] }, page: { pageId: 'page', shapes: [], shapeCount: 0 } };
const plan = JSON.stringify({ message: '', calls: [{ name: 'savanna_rename_document', arguments: { name: 'Budget' } }] });
function streamResponse(events) {
  return new Response(events.map(event => `data: ${JSON.stringify(event)}\n\n`).join(''), { headers: { 'Content-Type': 'text/event-stream' } });
}
const completed = text => ({ type: 'response.completed', response: { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text }] }], usage: { input_tokens: 42 } } });

test('OAuth diagnostics identify the failing stage without exposing upstream secrets', async () => {
  const error = await connectionError(Response.json({ error: 'invalid_grant', error_description: 'code=secret-code access_token=secret-token' },
    { status: 400, headers: { 'x-request-id': 'req_123' } }), 'token exchange');
  assert.match(error.message, /token exchange failed \(HTTP 400, invalid_grant\)/);
  assert.match(error.message, /fresh sign-in/);
  assert.match(error.message, /req_123/);
  assert.ok(!error.message.includes('secret'));
  const unknown = await connectionError(Response.json({ error: { code: 'secret-token.with-dots', message: 'secret' } }, { status: 400 }));
  assert.equal(unknown.message, 'ChatGPT connection failed (HTTP 400).');
});

test('identity verification rejects wrong signature, audience, nonce and expired identity', () => {
  assert.equal(verifyIdentity(sign(), [key], 'oaiapp_test', 'nonce').sub, 'user');
  assert.throws(() => verifyIdentity(sign(), [key], 'other-client', 'nonce'));
  assert.throws(() => verifyIdentity(sign(), [key], 'oaiapp_test', 'wrong'));
  assert.throws(() => verifyIdentity(sign({}, { expiresIn: -30 }), [key], 'oaiapp_test', 'nonce'));
  const other = generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey.export({ format: 'jwk' });
  assert.throws(() => verifyIdentity(sign(), [{ ...other, kid: key.kid }], 'oaiapp_test', 'nonce'));
});

test('inference errors distinguish rejected parameters from quota and never echo upstream secrets', async () => {
  const error = await inferenceError(Response.json({ error: { code: 'unsupported_parameter', param: 'max_output_tokens', message: 'Bearer secret-token' } },
    { status: 400, headers: { 'x-request-id': 'req_safe' } }));
  assert.match(error.message, /request parameters/); assert.match(error.message, /parameter: max_output_tokens/);
  assert.match(error.message, /unsupported_parameter/); assert.match(error.message, /req_safe/);
  assert.doesNotMatch(error.message, /secret-token/);
  const unknown = await inferenceError(Response.json({ error: { code: 'secret_token', param: 'secret_param', message: 'secret' } }, { status: 400 }));
  assert.doesNotMatch(unknown.message, /secret/);
  const quota = await inferenceError(Response.json({ error: { code: 'insufficient_quota' } }, { status: 429 }));
  assert.match(quota.message, /rate and usage limits/);
  await assert.rejects(readCompletedResponse(Response.json({ error: { code: 'unsupported_value', param: 'text.format' } }, { status: 400 })), /parameter: text.format/);
});

test('only a completed stream returns a plan, including split CRLF frames', async () => {
  assert.equal((await readCompletedResponse(streamResponse([completed(plan)]))).text, plan);
  await assert.rejects(readCompletedResponse(streamResponse([{ type: 'response.output_text.delta', delta: plan }])), /before completion/);
  await assert.rejects(readCompletedResponse(streamResponse([{ type: 'response.failed', response: { error: { code: 'usage_limit' } } }])), /usage_limit/);
  await assert.rejects(readCompletedResponse(streamResponse([{ type: 'response.incomplete' }])), /incomplete/);
  const frame = `data: ${JSON.stringify(completed(plan))}\r\n\r\n`;
  const chunks = [frame.slice(0, -3), frame.slice(-3)];
  const response = new Response(new ReadableStream({ start(controller) { chunks.forEach(chunk => controller.enqueue(new TextEncoder().encode(chunk))); controller.close(); } }));
  assert.equal((await readCompletedResponse(response)).text, plan);
});

test('client binds captured context, rejects invalid tools and cancels requests', async () => {
  const tools = createEditorTools({}).listTools();
  let signal;
  const agent = createChatGPTAgent('test-model', async (path, options) => { signal = options.signal; return { text: plan }; });
  const result = await agent.plan('Rename to Budget', tools, context);
  assert.deepEqual(result.calls[0].arguments, { fileId: 'file', name: 'Budget' });
  assert.equal(result.metrics.source, 'chatgpt');
  agent.dispose(); assert.equal(signal.aborted, true);
  const invalid = createChatGPTAgent('test-model', async () => ({ text: JSON.stringify({ calls: [{ name: 'run_shell', arguments: {} }] }) }));
  await assert.rejects(invalid.plan('Execute', tools, context), /unknown tool/);
});

test('completed streams recover text events when the terminal snapshot omits messages', async () => {
  const end = { type: 'response.completed', response: { status: 'completed', output: [], usage: { input_tokens: 9 } } };
  for (const events of [
    [{ type: 'response.output_text.delta', output_index: 0, content_index: 0, delta: plan.slice(0, 15) },
      { type: 'response.output_text.delta', output_index: 0, content_index: 0, delta: plan.slice(15) }, end],
    [{ type: 'response.output_text.delta', delta: 'partial' }, { type: 'response.output_text.done', text: plan }, end],
    [{ type: 'response.output_item.done', output_index: 0, item: { type: 'message', status: 'completed', content: [{ type: 'output_text', text: plan }] } }, end],
  ]) assert.equal((await readCompletedResponse(streamResponse(events))).text, plan);
  await assert.rejects(readCompletedResponse(streamResponse([{ type: 'response.output_text.done', text: plan }])), /before completion/);
});

test('deck-sized output has explicit limits and distinguishes empty, refused and incomplete output', async () => {
  const large = JSON.stringify({ message: '', calls: [], padding: 'x'.repeat(120_000) });
  assert.equal((await readCompletedResponse(streamResponse([completed(large)]))).text, large);
  await assert.rejects(readCompletedResponse(streamResponse([completed('x'.repeat(256001))])), /exceeded 256,000/);
  await assert.rejects(readCompletedResponse(streamResponse([completed('')])), /no output text/);
  await assert.rejects(readCompletedResponse(streamResponse([{ type: 'response.refusal.done' }, completed('')])), /declined/);
  await assert.rejects(readCompletedResponse(streamResponse([{ type: 'response.output_text.done', text: plan },
    { type: 'response.incomplete', response: { incomplete_details: { reason: 'max_output_tokens' } } }])), /max_output_tokens/);
});

test('stream output preserves ordered parts without duplicate text and handles UTF-8 and final undelimited events', async () => {
  const events = [
    { type: 'response.output_text.done', output_index: 1, content_index: 0, text: 'world' },
    { type: 'response.output_text.done', output_index: 0, content_index: 0, text: '你好 ' },
    { type: 'response.completed', response: { status: 'completed', output: [] } },
  ];
  const bytes = new TextEncoder().encode(events.map(e => `data: ${JSON.stringify(e)}`).join('\r\n\r\n'));
  const response = new Response(new ReadableStream({ start(c) { for (let i=0;i<bytes.length;i+=7) c.enqueue(bytes.slice(i,i+7)); c.close(); } }));
  assert.equal((await readCompletedResponse(response)).text, '你好 world');
  assert.equal((await readCompletedResponse(streamResponse([{ type: 'response.output_text.done', text: plan }, completed(plan)]))).text, plan);
});

test('local OAuth, session isolation, model catalog, refresh, inference and logout', async t => {
  let nonce, refreshes = 0, revocations = 0, requests = 0, grantScope = true, failExchange = true;
  const fetchImpl = async (url, options = {}) => {
    if (url.endsWith('openid-configuration')) return Response.json({ issuer: 'https://auth.openai.com',
      authorization_endpoint: 'https://auth.openai.com/api/accounts/authorize', token_endpoint: 'https://auth.openai.com/api/accounts/oauth/token',
      jwks_uri: 'https://auth.openai.com/.well-known/jwks.json', revocation_endpoint: 'https://auth.openai.com/revoke' });
    if (url.endsWith('jwks.json')) return Response.json({ keys: [key] });
    if (url.endsWith('/oauth/token')) {
      const body = options.body;
      assert.equal(body.get('client_id'), 'oaiapp_test');
      assert.equal(body.get('resource'), 'https://api.openai.com/v1');
      const refresh = body.get('grant_type') === 'refresh_token';
      if (!refresh && failExchange) return Response.json({ error: 'invalid_grant', error_description: 'secret-code' }, { status: 400 });
      if (refresh) { refreshes++; assert.equal(body.get('refresh_token'), 'refresh-secret'); }
      else { assert.equal(body.get('redirect_uri'), 'http://127.0.0.1:1455/auth/callback'); assert.ok(body.get('code_verifier')); }
      return Response.json({ id_token: sign({ nonce }), access_token: 'access-secret', refresh_token: refresh ? 'rotated-secret' : 'refresh-secret',
        expires_in: refresh ? 3600 : 1, scope: grantScope ? 'openid chatgpt.tokens.use.direct' : 'openid', token_type: 'Bearer' });
    }
    if (url.endsWith('/models')) {
      assert.equal(options.headers.Authorization, 'Bearer access-secret');
      return Response.json({ models: [{ slug: 'model-a', display_name: 'Model A', visibility: 'list' }, { slug: 'hidden', visibility: 'hide' }] });
    }
    if (url.endsWith('/responses')) {
      requests++;
      const body = JSON.parse(options.body);
      if (body.tools?.[0]?.type === 'image_generation') {
        assert.equal(body.stream, true); assert.equal(body.store, false);
        return Response.json({ status: 'completed', output: [{ type: 'image_generation_call', status: 'completed',
          result: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9iUAAAAASUVORK5CYII=' }] });
      }
      assert.equal(body.model, 'model-a'); assert.equal(body.store, false); assert.equal(body.stream, true);
      assert.equal(Object.hasOwn(body, 'text'), false); assert.equal(Object.hasOwn(body, 'max_output_tokens'), false);
      assert.ok(body.instructions.includes('savanna_rename_document'));
      assert.equal(body.input[0].role, 'user');
      return streamResponse([completed(plan)]);
    }
    if (url.endsWith('/revoke')) { revocations++; assert.equal(options.body.get('token'), 'rotated-secret'); return new Response(''); }
    throw new Error(`Unexpected endpoint: ${url}`);
  };
  const app = createChatGPTProvider({ router: express, hostId: 'urn:uuid:test', fetchImpl });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie;
  async function api(path, body, extra = {}) {
    const response = await fetch(`${base}/api/agent/chatgpt/${path}`, { method: body === undefined ? 'GET' : 'POST',
      headers: { Host: '127.0.0.1:1455', Origin: origin, 'X-Editor-Agent': '1', 'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {}), ...extra }, ...(body === undefined ? {} : { body: JSON.stringify(preparedBody('chatgpt', path, body)) }) });
    cookie = response.headers.get('set-cookie')?.split(';')[0] || cookie;
    return { response, data: await browserResult('chatgpt', path, response) };
  }
  assert.equal((await api('status', undefined, { Origin: 'https://evil.example' })).response.status, 403);
  assert.equal((await api('status', undefined, { 'X-Editor-Agent': '' })).response.status, 403);
  assert.equal((await api('status')).data.connected, false);
  assert.ok(cookie);
  const login = await api('login', {}), url = new URL(login.data.url);
  assert.equal(url.searchParams.get('client_id'), 'dynamic_agent_client');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  nonce = url.searchParams.get('nonce');
  const state = url.searchParams.get('state');
  const callback = `${base}/auth/callback?state=${state}&code=code&client_id=oaiapp_test`;
  const cb = await fetch(callback, { headers: { Host: '127.0.0.1:1455' } });
  assert.equal(cb.status, 400);
  assert.match((await cb.json()).error, /token exchange.*invalid_grant/);
  failExchange = false;
  const retryUrl = new URL((await api('login', {})).data.url);
  assert.equal(retryUrl.searchParams.get('client_id'), 'oaiapp_test');
  assert.equal(retryUrl.searchParams.has('agent_name_hint'), false);
  nonce = retryUrl.searchParams.get('nonce');
  const retry = await fetch(`${base}/auth/callback?state=${retryUrl.searchParams.get('state')}&code=fresh-code`, { headers: { Host: '127.0.0.1:1455' } });
  assert.equal(retry.status, 200);
  assert.equal((await fetch(callback, { headers: { Host: '127.0.0.1:1455' } })).status, 400);
  const status = await api('status'); assert.equal(status.data.connected, true);
  assert.ok(!JSON.stringify(status.data).includes('secret'));
  const savedCookie = cookie; cookie = undefined;
  assert.equal((await api('status')).data.connected, false); cookie = savedCookie;
  const [first, second] = await Promise.all([api('models'), api('models')]);
  assert.deepEqual(first.data.models, [{ id: 'model-a', label: 'Model A' }]); assert.equal(second.response.status, 200);
  assert.equal(refreshes, 1);
  assert.equal((await api('plan', { model: 'hidden', command: 'rename', context })).response.status, 400);
  const result = await api('plan', { model: 'model-a', command: 'Rename to Budget', context });
  assert.equal(result.data.text, plan); assert.equal(requests, 1);
  const imageResult = await api('image', { model: 'model-a', query: 'Abstract greeting', alt: 'Greeting' });
  assert.equal(imageResult.response.status, 200); assert.equal(imageResult.data.mimeType, 'image/png');
  assert.equal(imageResult.data.provider, 'OpenAI');
  const logout = await api('logout', {}); assert.equal(logout.data.revoked, true); assert.equal(revocations, 1);
  assert.equal((await api('status')).data.connected, false);
  assert.equal((await api('image', { model: 'model-a', query: 'Abstract greeting', alt: 'Greeting' })).response.status, 400);
  grantScope = false;
  const deniedLogin = new URL((await api('login', {})).data.url);
  nonce = deniedLogin.searchParams.get('nonce');
  const denied = await fetch(`${base}/auth/callback?state=${deniedLogin.searchParams.get('state')}&code=code&client_id=oaiapp_test`);
  assert.equal(denied.status, 400);
  const deniedStatus = await api('status');
  assert.equal(deniedStatus.data.connected, false);
  assert.match(deniedStatus.data.error, /plan usage was not authorized/);
});
