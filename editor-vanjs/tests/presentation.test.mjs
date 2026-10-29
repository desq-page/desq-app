import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import vm from 'node:vm';
import { blankDocument } from '../src/model.mjs';
import { editableHTML, presentationHTML, unpackDocumentAssets } from '../src/document.mjs';

test('presentation and editable HTML use one identical document payload and media copy', () => {
  const doc = blankDocument(); const image = 'data:image/jpeg;base64,AQID';
  doc.assets = { 'image.jpeg': image, 'ppt/media/image.jpeg': image };
  doc.slides[0].shapes = [{ id: 'image', blipFill: { blip: { $_target: 'image.jpeg' } } }];
  const resources = { player: 'window.player = {};', playerStyles: 'body{}', playerAssets: [{ name: 'font.woff', mime: 'font/woff', data: new Uint8Array([1]) }] };
  const presentation = presentationHTML(doc, 'window.presentation = true;', resources);
  const editable = editableHTML(doc, 'window.editor = true;', resources);
  const payload = html => JSON.parse(html.match(/<script type="application\/json" id="savanna-document">([\s\S]*?)<\/script>/)[1]);
  assert.deepEqual(payload(presentation), payload(editable));
  assert.equal(unpackDocumentAssets(payload(presentation)).assets['image.jpeg'], image);
  assert.equal(presentation.split(image).length - 1, 1);
  assert.doesNotMatch(presentation, /player-slide-|player-document|data-savanna-editor/);
});

test('presentation initializes player from document and renders slides on demand', async () => {
  const result = await build({ entryPoints: ['editor-vanjs/src/presentation-entry.jsx'], bundle: true, platform: 'node', format: 'cjs', write: false,
    plugins: [{ name: 'presentation-fixture', setup(builder) {
      builder.onResolve({ filter: /.*/ }, args => args.kind === 'entry-point' ? undefined : { path: args.path, namespace: 'mock' });
      builder.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: args.path.includes('shared-renderer')
        ? 'export const getStyles=()=>".slide{}";'
        : args.path.includes('render.jsx') ? 'export const renderPlayerSlide=async(doc,index)=>{globalThis.fixture.rendered.push(index);return doc.slides[index-1].id};'
        : args.path.includes('document.mjs') ? 'export const unpackDocumentAssets=doc=>doc;'
        : 'export const setEmbeddedSlides=fn=>globalThis.fixture.loader=fn;export const initSlides=config=>{globalThis.fixture.config=config};' }));
    } }] });
  const doc = { file: { width: 100, height: 50 }, slides: [{ id: 'one', shapes: [], timing: { id: 'effect' } }, { id: 'two', shapes: [] }], layouts: [], masters: [] };
  const fixture = { rendered: [] };
  const document = { readyState: 'loading', getElementById: () => ({ textContent: JSON.stringify(doc) }),
    addEventListener() {}, createElement: () => ({}), head: { append() {} } };
  const context = vm.createContext({ module: { exports: {} }, exports: {}, document, fixture });
  vm.runInContext(result.outputFiles[0].text, context);
  await context.module.exports.startPresentation();
  assert.equal(fixture.config.slides[0].timing.id, 'effect');
  assert.deepEqual(fixture.rendered, []);
  assert.equal(await fixture.loader(2), 'two');
  assert.deepEqual(fixture.rendered, [2]);
});
