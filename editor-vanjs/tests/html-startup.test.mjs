import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { blankDocument } from '../src/model.mjs';
import { editableHTML } from '../src/document.mjs';

test('embedded editor initializes with its shared renderer', async () => {
  const runtime = await readFile(new URL('../dist/editor.js', import.meta.url), 'utf8');
  const html = editableHTML(blankDocument(), runtime, { player: 'window.playerStub = true;', playerStyles: ' ',
    playerAssets: [{ name: 'font.woff', mime: 'font/woff', data: new Uint8Array([1]) }] });
  const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)]
    .filter(match => !match[1].includes('application/json'));
  const document = { baseURI: 'http://localhost/', readyState: 'loading', currentScript: { src: '', textContent: '' },
    addEventListener() {}, querySelector() { return {}; }, createElement() { return { style: {}, setAttribute() {} }; }, createElementNS() { return {}; } };
  const context = vm.createContext({ document, window: null, location: { href: document.baseURI },
    navigator: { userAgent: '', platform: '' }, localStorage: { getItem() { return null; }, setItem() {} },
    URL, console, setTimeout, clearTimeout, TextEncoder, TextDecoder, Blob, fetch, EventTarget, Event,
    CustomEvent: class extends Event { constructor(type, options) { super(type); this.detail = options?.detail; } },
    matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }) });
  context.window = context;
  for (const script of scripts) vm.runInContext(script[2], context);
  assert.ok(context.SavannaVanEditor?.van);
  assert.equal(typeof context.SavannaRenderer?.renderSlide, 'function');
});
