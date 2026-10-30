import { preparedBody, browserResult } from './provider-test-client.mjs';
import { readGeminiPlan } from '../editor-vuejs/src/lib/agent/gemini-response.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createGeminiProvider } from '../cloudflare-publisher/src/agent/gemini.mjs';
import { geminiRequest, createGeminiAgent } from '../editor-vuejs/src/lib/agent/gemini-agent.mjs';
import { createEditorTools } from '../editor-vuejs/src/lib/agent/editor-tools.mjs';

const context = { document: { fileId: 'file', selectedShapeIds: ['shape'], pages: [] },
  page: { pageId: 'page', shapes: [{ id: 'shape', text: 'x'.repeat(500) }], shapeCount: 1 } };
const text = JSON.stringify({ message: '', calls: [{ name: 'desq_move_shape_by', arguments: { dy: 200 } }] });
const complete = () => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ thought: true, text: 'internal thinking' }, { text }] } }], usageMetadata: { promptTokenCount: 42 } });

test('Gemini returns only completed visible text and rejects blocked or truncated results', () => {
  assert.deepEqual(readGeminiPlan(complete()), { text, inputTokens: 42 });
  assert.throws(() => readGeminiPlan({ promptFeedback: { blockReason: 'SAFETY' } }), /blocked/);
  for (const finishReason of ['MAX_TOKENS', 'SAFETY', undefined])
    assert.throws(() => readGeminiPlan({ candidates: [{ finishReason, content: { parts: [{ text }] } }] }), /did not complete/);
  assert.throws(() => readGeminiPlan({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'x'.repeat(100001) }] } }] }), /bounded/);
});

test('Gemini client binds selection, limits context, switches models and cancels pending work', async () => {
  const tools = createEditorTools({}).listTools(); let signal, model = 'models/gemini-flash';
  const agent = createGeminiAgent(() => model, async (path, options) => {
    assert.equal(path, 'plan'); assert.equal(options.body.model, model);
    assert.equal(options.body.context.page.shapes[0].text.length, 240);
    signal = options.signal;
    return { text, inferenceMs: 123, inputTokens: 42 };
  });
  const plan = await agent.plan('Lower selected shape by 200 pixels', tools, context);
  assert.deepEqual(plan.calls[0].arguments, { dy: 200, shapeId: 'shape', fileId: 'file', pageId: 'page' });
  assert.equal(plan.metrics.source, 'gemini');
  model = 'models/gemini-pro'; await agent.plan('Lower selected shape', tools, context);
  agent.dispose(); assert.equal(signal.aborted, true);
  const invalid = createGeminiAgent(model, async () => ({ text: JSON.stringify({ calls: [{ name: 'run_shell', arguments: {} }] }) }));
  await assert.rejects(invalid.plan('Run shell', tools, context), /unknown tool/);
  const badArgs = createGeminiAgent(model, async () => ({ text: JSON.stringify({ calls: [{ name: 'desq_move_shape_by', arguments: { dy: '200' } }] }) }));
  await assert.rejects(badArgs.plan('Move shape', tools, context), /Invalid dy/);
});

async function fixture(t, options = {}) {
  let mode = 'success', planCalls = 0, pages = 0, aborted = false;
  const app = createGeminiProvider({ router: express, ...options, fetchImpl: async (url, request) => {
    assert.ok(url.startsWith('https://generativelanguage.googleapis.com/v1beta/'));
    assert.ok(!url.includes('test-secret'));
    assert.equal(request.headers['x-goog-api-key'], options.apiKey || 'test-secret');
    if (mode === 'bad-key') return Response.json({ error: { message: 'test-secret must not be exposed' } }, { status: 403 });
    if (url.includes('/models?')) {
      pages++;
      if (!new URL(url).searchParams.has('pageToken')) return Response.json({
        models: [{ name: 'models/gemini-flash', displayName: 'Gemini Flash', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/gemini-image', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/embedding', supportedGenerationMethods: ['embedContent'] }], nextPageToken: 'next-page',
      });
      return Response.json({ models: [{ name: 'models/gemini-pro', displayName: 'Gemini Pro', supportedGenerationMethods: ['generateContent'] }] });
    }
    if (url.endsWith('gemini-2.5-flash-image:generateContent')) return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ inlineData: {
      mimeType: 'image/png', data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9iUAAAAASUVORK5CYII=' } }] } }] });
    assert.match(url, /models\/gemini-(flash|pro):generateContent$/);
    planCalls++;
    const body = JSON.parse(request.body);
    assert.ok(body.systemInstruction.parts[0].text.includes('desq_move_shape_by'));
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    assert.equal(body.contents[0].role, 'user');
    if (mode === 'quota') return Response.json({ error: { message: 'test-secret' } }, { status: 429 });
    if (mode === 'truncated') { const result = complete(); result.candidates[0].finishReason = 'MAX_TOKENS'; return Response.json(result); }
    if (mode === 'pending') return new Promise((resolve, reject) => request.signal.addEventListener('abort', () => {
      aborted = true; reject(new DOMException('Cancelled', 'AbortError'));
    }, { once: true }));
    return Response.json(complete());
  } });
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}/api/agent/gemini`;
  let cookie;
  async function api(path, body = {}, headers = {}) {
    const response = await fetch(`${base}/${path}`, { method: path.startsWith('models?') ? 'GET' : 'POST',
      headers: { Origin: 'https://localhost:6173', 'X-Editor-Agent': '1', 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...headers }, ...(path.startsWith('models?') ? {} : { body: JSON.stringify(preparedBody('gemini', path, body)) }) });
    cookie = response.headers.get('set-cookie')?.split(';')[0] || cookie;
    const data = await browserResult('gemini', path, response);
    if (path === 'connect' && data.nextPageToken) {
      const next = await api(`models?pageToken=${data.nextPageToken}`);
      data.models.push(...next.data.models);
    }
    return { status: response.status, data };
  }
  return { api, mode: value => { mode = value; }, calls: () => planCalls, pages: () => pages, aborted: () => aborted,
    newSession() { cookie = undefined; } };
}

test('companion rejects untrusted origins, requires a key, paginates models and keeps sessions separate', async t => {
  const f = await fixture(t, { apiKey: '' });
  assert.equal((await f.api('connect', {}, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await f.api('connect', {}, { 'X-Editor-Agent': '' })).status, 403);
  assert.match((await f.api('connect')).data.error, /Enter a Google AI Studio API key/);
  assert.equal((await f.api('connect', { apiKey: 'key\nsecret' })).status, 400);
  const result = await f.api('connect', { apiKey: 'test-secret' });
  assert.deepEqual(result.data.models.map(model => model.id), ['models/gemini-flash', 'models/gemini-pro']);
  assert.equal(f.pages(), 2); assert.ok(!JSON.stringify(result.data).includes('test-secret'));
  assert.equal((await f.api('plan', { model: 'models/other', command: 'Move', context })).status, 400);
  assert.equal(f.calls(), 0);
  assert.equal((await f.api('plan', { model: 'models/gemini-flash', command: 'Move', context })).data.text, text);
  assert.equal((await f.api('connect')).status, 200); // Reuse memory key after Stop.
  f.newSession();
  assert.equal((await f.api('plan', { model: 'models/gemini-flash', command: 'Move', context })).status, 401);
});

test('image generation requires a connected session and honors the origin guard', async t => {
  const f = await fixture(t, { apiKey: '' });
  const image = { query: 'Abstract greeting', alt: 'Greeting' };
  assert.equal((await f.api('image', image)).status, 401);
  await f.api('connect', { apiKey: 'test-secret' });
  assert.equal((await f.api('image', image, { Origin: 'https://evil.example' })).status, 403);
  const result = await f.api('image', image);
  assert.equal(result.status, 200); assert.equal(result.data.mimeType, 'image/png');
  assert.equal(result.data.provider, 'Google Gemini');
  await f.api('disconnect'); assert.equal((await f.api('image', image)).status, 401);
});

test('Gemini errors never expose keys and disconnect clears the active key', async t => {
  const f = await fixture(t, { apiKey: '' });
  f.mode('bad-key');
  const denied = await f.api('connect', { apiKey: 'test-secret' });
  assert.match(denied.data.error, /HTTP 403/); assert.ok(!denied.data.error.includes('test-secret'));
  f.mode('success'); await f.api('connect', { apiKey: 'test-secret' });
  f.mode('quota');
  assert.match((await f.api('plan', { model: 'models/gemini-flash', command: 'Move', context })).data.error, /quota or rate limit/);
  f.mode('truncated');
  assert.match((await f.api('plan', { model: 'models/gemini-flash', command: 'Move', context })).data.error, /MAX_TOKENS/);
  await f.api('disconnect');
  assert.equal((await f.api('plan', { model: 'models/gemini-flash', command: 'Move', context })).status, 401);
  assert.match((await f.api('connect')).data.error, /Enter a Google AI Studio API key/);
});

test('disconnect aborts an in-flight Gemini request and no completed plan is returned', async t => {
  const f = await fixture(t, { apiKey: 'test-secret' });
  await f.api('connect'); f.mode('pending');
  const pending = f.api('plan', { model: 'models/gemini-flash', command: 'Move', context });
  for (let i = 0; i < 100 && !f.calls(); i++) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(f.calls(), 1);
  assert.equal((await f.api('plan', { model: 'models/gemini-flash', command: 'Move', context })).status, 409);
  await f.api('disconnect');
  const result = await pending;
  assert.equal(f.aborted(), true); assert.match(result.data.error, /cancelled/); assert.equal(result.data.text, undefined);
});

test('Gemini enforces the command envelope through structured JSON output', async () => {
  const { buildProviderPlan } = await import('../editor-vuejs/src/lib/agent/provider-request.mjs');
  const { request } = buildProviderPlan('gemini', { model: 'models/gemini-flash', command: 'Create one slide', context });
  const schema = request.generationConfig.responseJsonSchema;
  assert.deepEqual(schema.required, ['message', 'calls']);
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.properties.calls.items.required, ['name', 'arguments']);
  assert.ok(schema.properties.calls.items.properties.name.enum.includes('desq_create_deck'));
  assert.equal(schema.properties.calls.items.properties.arguments.type, 'object');
  assert.equal(buildProviderPlan('chatgpt', { model: 'gpt-test', command: 'Hello', context }).request.generationConfig, undefined);
});
