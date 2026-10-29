import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { ZipReader, BlobReader, Uint8ArrayWriter } from '@zip.js/zip.js';
import { blankDocument } from '../src/model.mjs';
import { packageEntries, editableZip, readEditableZip, parseDocumentScript } from '../src/package.mjs';
import { createZip, readZip, crc32 } from '../src/zip.mjs';
globalThis.crypto ||= webcrypto;
const runtime = 'window.SavannaVanEditor={};', styles = '.ve-editor{color:red}';
const resources = { renderer: 'window.SavannaRenderer={};', rendererStyles: '.slide{position:relative}',
  player: 'window.SavannaPlayer={};', playerStyles: '@font-face{src:url(/fonts/Carlito.woff2)}',
  playerAssets: [{ name: 'assets/fonts/Carlito.woff2', mime: 'font/woff2', data: new Uint8Array([7, 8, 9]) }] };

test('package has readable files, binary media, aliases and a correct inventory', async () => {
  const doc = blankDocument();
  doc.assets = { 'ppt/media/photo.png': 'data:image/png;base64,AQID', 'photo.png': 'data:image/png;base64,AQID', '../photo.png': 'data:image/png;base64,BAUG' };
  const entries = await packageEntries(doc, runtime, styles, resources);
  const map = new Map(entries.map(e => [e.name, e.data]));
  assert.deepEqual([...map.keys()].sort(), ['index.html', 'document.js', 'editor.js', 'editor.css', 'renderer.css',
    'player.js', 'player.css', 'assets/fonts/Carlito.woff2', 'manifest.json', 'assets/photo.png', 'assets/photo-2.png'].sort());
  assert.equal(map.get('player.css'), '@font-face{src:url(assets/fonts/Carlito.woff2)}');
  const saved = parseDocumentScript(map.get('document.js'));
  assert.equal(saved.assets['photo.png'], saved.assets['ppt/media/photo.png']);
  assert.deepEqual([...map.get('assets/photo.png')], [1, 2, 3]);
  assert.ok(!map.get('index.html').includes('data:image'));
  assert.ok(!map.get('document.js').includes('base64'));
  const manifest = JSON.parse(map.get('manifest.json'));
  assert.equal(manifest.document, 'document.js');
  for (const entry of manifest.files) {
    const data = map.get(entry.path);
    assert.equal(entry.bytes, typeof data === 'string' ? new TextEncoder().encode(data).length : data.length);
  }
  assert.equal(doc.assets['photo.png'], 'data:image/png;base64,AQID');
});

test('ZIP reader supports legacy JSON and rejects executable document scripts', async () => {
  const oldDoc = blankDocument(); oldDoc.file.name = 'Legacy document';
  const legacy = createZip([{ name: 'document.json', data: JSON.stringify(oldDoc) },
    { name: 'document.js', data: 'obsolete fallback' }]);
  assert.equal((await readEditableZip(legacy)).file.name, 'Legacy document');
  assert.throws(() => parseDocumentScript('window.SavannaDocument = {}; globalThis.injected = true;'), /JSON|Invalid/);
});

test('ZIP is readable by an independent standard ZIP implementation', async () => {
  const archive = await editableZip(blankDocument(), runtime, styles, resources);
  const reader = new ZipReader(new BlobReader(archive));
  try {
    const entries = await reader.getEntries();
    const json = await entries.find(e => e.filename === 'document.js').getData(new Uint8ArrayWriter(), { checkSignature: true });
    assert.equal(parseDocumentScript(new TextDecoder().decode(json)).file.width, 1280);
  } finally { await reader.close(); }
  const entries = await readZip(archive);
  assert.equal(new TextDecoder().decode(entries.get('editor.js')), runtime);
});

test('packaging includes and rewrites directly embedded audio and video', async () => {
  const doc = blankDocument();
  doc.slides[0].shapes = [{ id: 'audio', audio: { $_target: 'data:audio/mpeg;base64,AQID' } },
    { id: 'video', video: { $_target: 'data:video/mp4;base64,BAUG' } }];
  const entries = await packageEntries(doc, runtime, styles, resources);
  const saved = parseDocumentScript(entries.find(entry => entry.name === 'document.js').data);
  for (const [idx, suffix] of [[0, '.mp3'], [1, '.mp4']]) {
    const target = saved.slides[0].shapes[idx][idx ? 'video' : 'audio'].$_target;
    assert.ok(target.startsWith('assets/') && target.endsWith(suffix));
    assert.ok(entries.some(entry => entry.name === target));
  }
});

test('ZIP reader rejects bad paths, corrupt entries and truncated archives', async () => {
  assert.throws(() => createZip([{ name: '../outside', data: 'bad' }]), /Invalid/);
  assert.throws(() => createZip([{ name: 'same', data: '' }, { name: 'same', data: '' }]), /duplicate/);
  await assert.rejects(readZip(new Blob(['not a zip'])), /Invalid/);
  const zip = createZip([{ name: 'text', data: 'hello' }]);
  const bytes = new Uint8Array(await zip.arrayBuffer()); bytes[34] ^= 1;
  await assert.rejects(readZip(new Blob([bytes])), /Corrupt/);
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
});

test('ZIP import rejects missing media and preserves asset metadata on round trip', async () => {
  const doc = blankDocument(); doc.assets = { photo: { data: 'data:image/png;base64,AQID', description: 'Original media' } };
  const entries = await packageEntries(doc, runtime, styles, resources);
  await assert.rejects(readEditableZip(createZip(entries.filter(e => !e.name.startsWith('assets/')))), /Missing media/);
  const prior = globalThis.FileReader;
  globalThis.FileReader = class {
    async readAsDataURL(blob) { this.result = `data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`; this.onload(); }
  };
  try {
    const restored = await readEditableZip(createZip(entries));
    assert.equal(restored.assets.photo.data, 'data:image/png;base64,AQID');
    assert.equal(restored.assets.photo.description, 'Original media');
    assert.equal((await packageEntries(restored, runtime, styles, resources)).filter(e => e.name.startsWith('assets/') && !e.name.startsWith('assets/fonts/')).length, 1);
  } finally { globalThis.FileReader = prior; }
});
