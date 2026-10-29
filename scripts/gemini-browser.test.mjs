import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createGeminiBrowserClient } from '../editor-vuejs/src/lib/agent/gemini-browser.mjs';
const model = 'models/gemini-test';
const context = { document: { fileId: 'file' }, page: { pageId: 'page' } };
const catalog = { models: [{ name: model, supportedGenerationMethods: ['generateContent'] }] };
const result = text => Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] } }] });

test('Gemini uses only the Google endpoint and key header with no cookies, server credentials or key in URLs/payloads', async () => {
  const calls = [];
  const request = createGeminiBrowserClient({ fetchImpl: async (url, options) => {
    calls.push({ url, options });
    assert.equal(new URL(url).origin, 'https://generativelanguage.googleapis.com');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.headers['x-goog-api-key'], 'user-private-key');
    assert.ok(!url.includes('user-private-key'));
    assert.ok(!String(options.body).includes('user-private-key'));
    return url.includes('/models?') ? Response.json(catalog) : result('solar panels');
  } });
  await assert.rejects(request('plan', { body: { model, command: 'Edit slide', context } }), /Connect Gemini/);
  await request('connect', { body: { apiKey: ' user-private-key ' } });
  const progress = [];
  assert.equal((await request('keywords', { body: { model, query: 'Solar panels on roofs' }, onProgress: text => progress.push(text) })).text, 'solar panels');
  assert.equal(progress.length, 2);
  assert.equal((await request('plan', { body: { model, command: 'Edit slide', context } })).text, 'solar panels');
  await assert.rejects(request('plan', { body: { model: 'models/gemini-other', command: 'Edit slide', context } }), /available Gemini/);
  await request('disconnect');
  await assert.rejects(request('plan', { body: { model, command: 'Edit slide', context } }), /Connect Gemini/);
  assert.equal(calls.length, 3);
});

test('disconnect aborts catalog loading and generation, preventing a stale connection from saving a key', async () => {
  let started;
  let pending = false;
  const request = createGeminiBrowserClient({ fetchImpl: async (url, options) => {
    if (!pending) return Response.json(catalog);
    started?.();
    return new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true });
    });
  } });
  for (const path of ['connect', 'plan']) {
    pending = false;
    await request('connect', { body: { apiKey: 'private-key' } });
    pending = true;
    const begun = new Promise(resolve => { started = resolve; });
    const work = request(path, { body: path === 'connect' ? { apiKey: 'other-key' } : { model, command: 'Edit slide', context } });
    await begun;
    await request('disconnect');
    await assert.rejects(work, /Cancelled/);
    await assert.rejects(request('keywords', { body: { model, query: 'Photo' } }), /Connect Gemini/);
  }
});

test('catalog failures are sanitized, invalid keys are never retained and endpoint injection is rejected', async () => {
  const request = createGeminiBrowserClient({ fetchImpl: async () => Response.json({ error: { status: 'INVALID_ARGUMENT', message: 'private-key', details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'API_KEY_INVALID' }] } }, { status: 400 }) });
  await assert.rejects(request('connect', { body: { apiKey: 'private-key' } }), error => /API_KEY_INVALID/.test(error.message) && !error.message.includes('private-key'));
  await assert.rejects(request('plan', { body: { model, command: 'Edit', context } }), /Connect Gemini/);
  await assert.rejects(request('https://evil.example', {}), /Unknown/);
});

test('browser bundle for direct Gemini contains no server modules or Node polyfills', async () => {
  const result = await build({ entryPoints: ['editor-vuejs/src/lib/agent/gemini-agent.mjs'], bundle: true, platform: 'browser', format: 'esm', write: false, metafile: true });
  assert.ok(!Object.keys(result.metafile.inputs).some(path => path.includes('/server/')));
});
