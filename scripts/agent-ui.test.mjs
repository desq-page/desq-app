import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { boundedRender, rasterImage } from '../shared-vuejs/src/lib/raster-render.mjs';
import { openChatGPTSignInPopup } from '../editor-vuejs/src/lib/agent/chatgpt-popup.mjs';
import { SELECTABLE_LOCAL_MODELS } from '../editor-vuejs/src/lib/agent/local-models.mjs';

test('local model menu offers Qwen 4B and Gemma 4B', () => {
  assert.deepEqual(SELECTABLE_LOCAL_MODELS.map(model => model.key), ['qwen-4b', 'gemma-4-e4b']);
});

function imageFixture(outcome) {
  let instance;
  class FakeImage {
    constructor() { instance = this; }
    set src(value) { this.value = value; if (value && outcome) queueMicrotask(() => this[outcome]?.()); }
  }
  return { FakeImage, instance: () => instance };
}

test('preview image errors and canvas encoding failures reject rather than leaving promises pending', async () => {
  const failed = imageFixture('onerror');
  await assert.rejects(rasterImage('svg', () => {}, undefined, failed.FakeImage), /could not be decoded/);
  assert.equal(failed.instance().onerror, null); assert.equal(failed.instance().value, '');
  const loaded = imageFixture('onload');
  await assert.rejects(rasterImage('svg', async () => { throw Error('Canvas encoding failed'); }, undefined, loaded.FakeImage), /Canvas encoding failed/);
  assert.equal(await rasterImage('svg', () => 'thumbnail', undefined, loaded.FakeImage), 'thumbnail');
});

test('preview deadline covers hung asset preparation, image loading and encoding', async () => {
  let signal;
  await assert.rejects(boundedRender(s => { signal = s; return new Promise(() => {}); }, 10), /timed out/);
  assert.equal(signal.aborted, true);
  const pending = imageFixture();
  await assert.rejects(boundedRender(s => rasterImage('svg', () => {}, s, pending.FakeImage), 10), /timed out/);
  assert.equal(pending.instance().onload, null); assert.equal(pending.instance().value, '');
  const loaded = imageFixture('onload');
  await assert.rejects(boundedRender(s => rasterImage('svg', () => new Promise(() => {}), s, loaded.FakeImage), 10), /timed out/);
});

test('ChatGPT popup navigates itself through its bootstrap channel without editor WindowProxy navigation', async () => {
  const bootstrap = readFileSync(new URL('../editor-vuejs/public/agent-sign-in.js', import.meta.url), 'utf8');
  let navigated, bootstrapWindow, closed = false;
  const navigation = new Promise(resolve => { navigated = resolve; });
  const popup = { get closed() { return closed; }, close() { closed = true; } };
  Object.defineProperty(popup, 'location', { get() { assert.fail('The editor must never access popup.location'); } });
  const view = { open(address) {
    bootstrapWindow = { opener: view, location: { hash: new URL(address, 'https://localhost:6173').hash, replace(url) { navigated(url); } } };
    queueMicrotask(() => new Function('window', 'document', bootstrap)(bootstrapWindow, { getElementById: () => ({}) }));
    return popup;
  } };
  const login = openChatGPTSignInPopup(view);
  try {
    const url = 'https://auth.openai.com/authorize?state=test';
    await login.navigate(url);
    assert.equal(await navigation, url);
    assert.equal(bootstrapWindow.opener, null);
    assert.equal(login.closed, false);
  } finally { login.close(); }
  assert.equal(closed, true);
});

test('blocked sign-in popups clean up and untrusted navigation is rejected', async () => {
  assert.equal(openChatGPTSignInPopup({ open: () => null }), null);
  const login = openChatGPTSignInPopup({ open: () => ({ closed: false, close() {} }) });
  try { await assert.rejects(login.navigate('https://evil.example/'), /Invalid ChatGPT/); }
  finally { login.close(); }
});
