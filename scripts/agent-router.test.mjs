import test from 'node:test';
import assert from 'node:assert/strict';
import { createRouter } from '../cloudflare-publisher/src/agent/router.mjs';

test('Fetch router streams progress before the handler completes', async () => {
  const app = createRouter();
  let finish;
  const gate = new Promise(resolve => { finish = resolve; });
  app.get('/stream', async (req, res) => {
    res.set({ 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-cache' });
    res.flushHeaders();
    res.write('{"type":"progress"}\n');
    await gate;
    res.write('{"type":"result"}\n');
    res.end();
  });
  const response = await app.fetch(new Request('https://localhost/stream'));
  assert.equal(response.headers.get('Content-Type'), 'application/x-ndjson');
  const reader = response.body.getReader();
  assert.equal(new TextDecoder().decode((await reader.read()).value), '{"type":"progress"}\n');
  finish();
  assert.equal(new TextDecoder().decode((await reader.read()).value), '{"type":"result"}\n');
  assert.equal((await reader.read()).done, true);
});

test('Fetch stream cancellation notifies the producer', async () => {
  const app = createRouter();
  let closed;
  const cancelled = new Promise(resolve => { closed = resolve; });
  app.get('/stream', async (req, res) => {
    res.on('close', closed);
    res.flushHeaders();
    await cancelled;
    assert.equal(res.destroyed, true);
    res.end();
  });
  const response = await app.fetch(new Request('https://localhost/stream'));
  await response.body.cancel();
  await cancelled;
});

test('Fetch router preserves buffered JSON responses', async () => {
  const app = createRouter();
  app.get('/json', (req, res) => res.status(201).json({ ok: true }));
  const response = await app.fetch(new Request('https://localhost/json'));
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { ok: true });
});

test('credential proxy relays provider bytes without decoding or corrupting UTF-8', async () => {
  const { relayProviderResponse } = await import('../cloudflare-publisher/src/agent/proxy.mjs');
  const bytes = new TextEncoder().encode('预算\n');
  const app = createRouter();
  app.get('/raw', (req, res) => relayProviderResponse(new Response(bytes, { headers: { 'Content-Type': 'text/event-stream' } }), res, { maxBytes: 100, version: 'test' }));
  const response = await app.fetch(new Request('https://localhost/raw'));
  assert.equal(response.headers.get('X-Editor-Agent-Version'), 'test');
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
});

test('credential proxy interrupts oversized responses instead of forwarding beyond the limit', async () => {
  const { relayProviderResponse } = await import('../cloudflare-publisher/src/agent/proxy.mjs');
  const app = createRouter();
  app.get('/raw', (req, res) => relayProviderResponse(new Response('too large'), res, { maxBytes: 2, version: 'test' }));
  const response = await app.fetch(new Request('https://localhost/raw'));
  await assert.rejects(response.text(), /stream interrupted/);
});
