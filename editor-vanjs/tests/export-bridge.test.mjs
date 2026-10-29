import { parseDocumentScript } from '../src/package.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { readZip } from '../src/zip.mjs';
import { blankDocument } from '../src/model.mjs';
import { unpackDocumentAssets } from '../src/document.mjs';
globalThis.crypto ||= webcrypto;

test('Vue export bridge flushes edits and produces standalone native JSON with media', async () => {
  const fixture = blankDocument(); fixture.file.name = 'Native deck.pptx';
  const raw = { ...fixture.file, __editableHtmlRoot: { customRoot: { keep: true } }, slides: fixture.slides, layouts: [{ id: 'master', shapes: [] }, { id: 'layout', parentid: 'master', shapes: [] }] };
  const calls = [], downloads = [];
  let runtime = 'window.SavannaVanEditor={}; window.SavannaRenderer={}; /* __savannaAssetPool */';
  const result = await build({
    entryPoints: [new URL('../../editor-vuejs/src/lib/main/exportEditableHtml.ts', import.meta.url).pathname], bundle: true, write: false,
    format: 'cjs', platform: 'node', define: { 'import.meta.env.BASE_URL': '"/"' },
    plugins: [{ name: 'editor-bridge-fixture', setup(build) {
      build.onResolve({ filter: /^shared-vuejs\// }, args => ({ path: args.path, namespace: 'stub' }));
      build.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: `
        export const getFileInfo=()=>({id:'file'});
        export const saveDexie=async()=>globalThis.fixture.calls.push('save');
        export const flushPendingTextSave=async()=>globalThis.fixture.calls.push('flush');
        export const prepareExportFile=async()=>globalThis.fixture.raw;
        export const getFontRecordsFromOPFS=async()=>[];
        export const getMediaRecordsFromOPFS=async()=>[{name:'ppt/media/pic.png'}];
        export const getMediaRecordFromOPFS=async()=>({data:new Uint8Array([1,2,3])});
        export const downloadFile=async(blob,name)=>globalThis.fixture.downloads.push({blob,name});
        export const showProgress=value=>globalThis.fixture.calls.push(value);
        export default {themes:{}};
      ` }));
    } }],
  });
  const context = vm.createContext({ module: { exports: {} }, exports: {}, crypto: webcrypto, Blob, Uint8Array, console,
    fixture: { raw, calls, downloads },
    fetch: async url => ({ ok: true, text: async () => url.endsWith('.css') ? '.ve-editor{color:red}' : url.endsWith('presentation.js') ? 'window.SavannaPresentation={};' : runtime,
      arrayBuffer: async () => new Uint8Array([4, 5, 6]).buffer }),
    TextEncoder, TextDecoder, Map, Set, atob, btoa,
    FileReader: class { readAsDataURL() { this.result = 'data:image/png;base64,AQID'; this.onload(); } },
  });
  vm.runInContext(result.outputFiles[0].text, context);
  await context.module.exports.exportEditableHtml();
  assert.deepEqual(calls.slice(1, 3), ['flush', 'save']);
  assert.equal(downloads[0].name, 'Native deck.editable.zip');
  const entries = await readZip(downloads[0].blob);
  const doc = parseDocumentScript(new TextDecoder().decode(entries.get('document.js')));
  assert.equal(doc.slides[0].id, fixture.slides[0].id);
  assert.equal(doc.assets['ppt/media/pic.png'], 'assets/pic.png');
  assert.equal(doc.assets['pic.png'], doc.assets['media/pic.png']);
  assert.equal(doc.layouts.length, 1); assert.equal(doc.masters.length, 1);
  assert.equal(doc.file.slides[0].shapes, undefined);
  assert.equal(doc.file.assets, undefined);
  assert.equal(new TextDecoder().decode(entries.get('editor.js')), 'window.SavannaVanEditor={}; window.SavannaRenderer={}; /* __savannaAssetPool */');
  assert.ok(entries.has('player.js')); assert.ok(entries.has('player.css')); assert.ok(entries.has('assets/fonts/Carlito.woff2'));
  assert.deepEqual([...entries.get('assets/pic.png')], [1, 2, 3]);
  assert.equal([...entries.keys()].filter(k => k.startsWith('assets/') && !k.startsWith('assets/fonts/')).length, 1);
  assert.equal(calls.at(-1), '');
  await context.module.exports.exportSingleEditableHtml();
  assert.equal(downloads[1].name, 'Native deck.editable.html');
  assert.equal(downloads[1].blob.type, 'text/html;charset=utf-8');
  const html = await downloads[1].blob.text();
  assert.match(html, /id="savanna-document"/);
  assert.match(html, /data:image\/png;base64,AQID/);
  assert.match(html, /window\.SavannaVanEditor/);
  assert.match(html, /window\.SavannaRenderer/);
  assert.match(html, /window\.SavannaEmbeddedPlayer/);
  assert.doesNotMatch(html, /<script[^>]+src=/);
  const payload = JSON.parse(html.match(/<script type="application\/json" id="savanna-document">([\s\S]*?)<\/script>/)[1]);
  const restored = unpackDocumentAssets(payload);
  assert.equal(restored.assets['pic.png'], 'data:image/png;base64,AQID');
  assert.equal(restored.customRoot.keep, true, 'imported root metadata survives another export');
  runtime = 'window.SavannaVanEditor={};';
  await assert.rejects(context.module.exports.exportSingleEditableHtml(), /runtime is outdated/);
  assert.equal(downloads.length, 2, 'an incompatible runtime must not produce a broken HTML file');
  await context.module.exports.exportSinglePageHtml();
  const presentation = await downloads[2].blob.text();
  assert.equal(downloads[2].name, 'Native deck.pptx.html');
  assert.match(presentation, /window\.SavannaPresentation/);
  assert.doesNotMatch(presentation, /SavannaVanEditor|player-slide-|player-document/);
  const portable = unpackDocumentAssets(JSON.parse(presentation.match(/<script type="application\/json" id="savanna-document">([\s\S]*?)<\/script>/)[1]));
  assert.equal(portable.assets['pic.png'], 'data:image/png;base64,AQID');
  assert.deepEqual(portable, restored, 'both exports carry the same complete document');
  assert.equal(presentation.split('data:image/png;base64,AQID').length - 1, 1);
});
