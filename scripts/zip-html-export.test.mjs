import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { buildSinglePageHtml } from '../shared-vuejs/src/edlib/common/export/single-page-package.mjs';

async function loadExporter() {
  const result = await build({
    entryPoints: ['shared-vuejs/src/edlib/common/export/export-zip.ts'],
    bundle: true, platform: 'node', format: 'esm', write: false,
    plugins: [{ name: 'export-boundaries', setup(builder) {
      builder.onResolve({ filter: /.*/ }, args => args.kind === 'entry-point' ? undefined : ({ path: args.path, namespace: 'mock' }));
      builder.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: `
        export const vStaticSlides = {fileInfo:{id:'deck',name:'deck.pptx'}};
        export const ue = {};
        export const optimizeDeckVideos = async () => { throw new Error('Export must not start video optimization'); };
        export const optimizedVideo = async (_id,name) => globalThis.zipTest.optimized?.[name];
        export const showProgress = () => {};
        export const flushPendingTextSave = () => globalThis.zipTest.flush();
        export const saveDexie = () => globalThis.zipTest.save();
        export const exportFile = id => globalThis.zipTest.generate(id);
        export const loadFileFromDexie = async () => ({});
        export const exportFontCss = async () => '';
        export const getInternalHtmlRecordsFromOPFS = () => globalThis.zipTest.pages;
        export const getMediaRecordsFromOPFS = async () => globalThis.zipTest.media || [];
        export const getFontRecordsFromOPFS = async () => [];
        export const getMediaRecordFromOPFS = async (_id, name) => { if (!globalThis.zipTest.original) throw new Error("Original video should not be loaded when optimized copy exists"); return {data: globalThis.zipTest.original[name]}; };
        export const downloadZip = entries => ({blob:async () => entries});
        export const downloadFile = entries => {globalThis.zipTest.downloaded = entries;return entries;};
        export const exportSinglePageHtml = () => {};
      `, loader: 'js' }));
    } }],
  });
  return import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
}

test('packaging falls back to the original video without starting optimization', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, headers: { get: () => '' }, text: async () => '' });
  const original = new Blob(['original video']);
  globalThis.zipTest = { pages: [], media: [{ name: 'ppt/media/video.mp4' }], original: { 'ppt/media/video.mp4': original } };
  try {
    const { createPackageEntries } = await loadExporter();
    for (let i = 0; i < 2; i++) {
      const entries = await createPackageEntries('deck');
      const video = entries.find(entry => entry.name === 'media/video.mp4');
      assert.equal(video.input, original);
      assert.equal(video.mime, undefined);
    }
  } finally { globalThis.fetch = previousFetch; delete globalThis.zipTest; }
});

test('media aliases are packaged once and can be exported as single HTML', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, headers: { get: () => '' }, text: async () => '' });
  const image = new Uint8Array([1, 2, 3]);
  const plain = 'publisher-image2.jpeg', qualified = `ppt/media/${plain}`;
  try {
    const { createPackageEntries } = await loadExporter();
    for (const names of [[plain, qualified], [qualified, plain]]) {
      globalThis.zipTest = { pages: [], media: names.map(name => ({ name })), original: { [plain]: image, [qualified]: image } };
      const entries = await createPackageEntries('deck');
      const assets = entries.filter(entry => entry.name.startsWith('media/'));
      assert.deepEqual(assets.map(entry => entry.name), [`media/${plain}`]);
      const html = await buildSinglePageHtml({ title: 'Deck', playerJs: '', playerCss: '', slides: [''], assets, config: { slides: [{}] } });
      assert.match(html, /id="player-asset-0"/);
      assert.doesNotMatch(html, /id="player-asset-1"/);
    }
    globalThis.zipTest = { pages: [], media: [{ name: plain }, { name: `PPT/MEDIA/${plain}` }], original: { [plain]: image } };
    await assert.rejects(createPackageEntries('deck'), /Conflicting media paths/);
  } finally { globalThis.fetch = previousFetch; delete globalThis.zipTest; }
});

test('ZIP HTML waits for all 100 slide pages before packaging', async () => {
  const previousFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async () => ({ok:true,headers:{get:()=>''},text:async () => ''});
  globalThis.zipTest = {
    pages: [],
    flush: async () => { calls.push('flush'); },
    save: async () => { calls.push('save'); },
    generate: async id => {
      assert.equal(id, 'deck');
      assert.deepEqual(calls, ['flush', 'save']);
      for (let i = 1; i <= 100; i++) {
        await new Promise(resolve => setImmediate(resolve));
        globalThis.zipTest.pages.push({name: i === 1 ? 'index.html' : `index${i}.html`,data:new Uint8Array([i])});
      }
    },
  };
  try {
    const {exportZip} = await loadExporter();
    const entries = await exportZip();
    assert.equal(entries.filter(entry => /\.html$/.test(entry.name)).length, 100);
    assert.ok(entries.some(entry => entry.name === 'index100.html'));
    globalThis.zipTest.generate = async () => {throw new Error('generation failed');};
    globalThis.zipTest.downloaded = undefined;
    await assert.rejects(exportZip(), /generation failed/);
    assert.equal(globalThis.zipTest.downloaded, undefined);
  } finally {
    globalThis.fetch = previousFetch;
    delete globalThis.zipTest;
  }
});


for (const name of ['video.mp4', 'video.mov', 'video.avi']) {
test(`packaging uses smaller MP4 for ${name} at its original URL without reading original bytes`, async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ok:true,headers:{get:()=>''},text:async () => ''});
  const optimized = new Blob(['optimized mp4']);
  globalThis.zipTest = {pages:[], media:[{name:'ppt/media/'+name}], optimized:{['ppt/media/'+name]:optimized}};
  try {
    const {createPackageEntries} = await loadExporter();
    const entries = await createPackageEntries('deck');
    const entry = entries.find(entry => entry.name === 'media/'+name);
    assert.equal(entry.input,optimized);
    assert.equal(entry.mime,'video/mp4');
  } finally {globalThis.fetch=previousFetch;delete globalThis.zipTest;}
});

}
