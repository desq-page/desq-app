import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import vm from 'node:vm';
import { blankDocument } from '../src/model.mjs';
import { editableHTML, presentationHTML } from '../src/document.mjs';

test('Vue HTML import restores document records and embedded media without executing HTML', async () => {
  const doc = blankDocument();
  doc.file.id = 'portable-id'; doc.file.name = 'Imported'; doc.customRoot = { keep: true };
  doc.file.fonts = [{ type: 'local', name: 'Test Font.woff2', family: 'Test' }];
  doc.slides[0].layoutid = 'layout'; doc.slides[0].timing = { id: 'anim' };
  doc.slides[0].shapes = [{ id: 'picture', blipFill: { blip: { $_target: 'ppt/media/image1.jpeg' } } }];
  doc.masters = [{ id: 'master', theme: 'theme1', shapes: [] }];
  doc.layouts = [{ id: 'layout', parentid: 'master', shapes: [] }];
  doc.themes = { theme1: { data: { theme: { themeElements: { clrScheme: { accent1: 'blue' } } } } } };
  doc.assets = { 'ppt/media/image1.jpeg': 'data:image/jpeg;base64,AQID', 'fonts/Test Font.woff2': 'data:font/woff2;base64,BAUG' };
  const html = editableHTML(doc, 'window.mustNotRun = true;', { player: 'window.player=true;', playerStyles: 'body{}',
    playerAssets: [{ name: 'font.woff', mime: 'font/woff', data: new Uint8Array([1]) }] });
  const writes = [];
  const result = await build({ entryPoints: [new URL('../../editor-vuejs/src/lib/main/importEditableHtml.mjs', import.meta.url).pathname],
    bundle: true, write: false, format: 'cjs', platform: 'node', plugins: [{ name: 'storage-fixture', setup(build) {
      build.onResolve({ filter: /^shared-vuejs\/api\// }, args => /(?:lib-text-run-text|lib-crc32|edlib-common-export-single-page-package|presentation-document|document-model)$/.test(args.path) ? undefined : ({ path: args.path, namespace: 'stub' }));
      build.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: `
        export const genId=()=>"new-local-id";
        export const putAssetsToDexie=async value=>globalThis.writes.push(['record',value]);
        export const putFileInfoToDexie=async value=>globalThis.writes.push(['file',value]);
        export const saveMediaRecordToOPFS=async value=>globalThis.writes.push(['media',value]);
        export const saveToOPFS=async (path,data)=>globalThis.writes.push(['font',path,data]);
      ` }));
    } }] });
  const context = vm.createContext({ module: { exports: {} }, exports: {}, writes, URL, fetch, Uint8Array,
    DOMParser: class { parseFromString(text) { return { getElementById: () => {
      const match = text.match(/<script type="application\/json" id="savanna-document">([\s\S]*?)<\/script>/);
      return match ? { textContent: match[1] } : null;
    } }; } } });
  vm.runInContext(result.outputFiles[0].text, context);
  const id = await context.module.exports.importEditableHtml({ text: async () => html });
  assert.equal(id, 'new-local-id');
  assert.equal(context.mustNotRun, undefined);
  const file = writes.find(([kind]) => kind === 'file')[1];
  assert.equal(file.id, id); assert.equal(file.sourceDocumentId, 'portable-id');
  assert.equal(file.__editableHtmlRoot.customRoot.keep, true);
  const slide = writes.find(([kind, value]) => kind === 'record' && value.type === 'slides')[1];
  assert.equal(slide.data.sld.cSld.shapes[0].blipFill.blip.$_target, 'ppt/media/image1.jpeg');
  assert.equal(slide.data.sld.timing.id, 'anim');
  assert.ok(writes.some(([kind, value]) => kind === 'record' && value.type === 'slideLayouts' && value.data.sldLayout.cSld.parentid === 'master'));
  assert.ok(writes.some(([kind, value]) => kind === 'record' && value.type === 'theme' && value.data.theme.themeElements.clrScheme.accent1 === 'blue'));
  const media = writes.find(([kind]) => kind === 'media')[1];
  assert.equal(media.name, 'ppt/media/image1.jpeg'); assert.deepEqual([...media.data], [1, 2, 3]);
  assert.ok(writes.some(([kind, path]) => kind === 'font' && path.endsWith('/ppt/fonts/Test Font.woff2')));
  assert.equal(writes.at(-1)[0], 'file', 'document appears in the workspace only after import completes');
  writes.length = 0;
  const presentation = presentationHTML(doc, 'window.mustNotRun = true;', { playerStyles: 'body{}',
    playerAssets: [{ name: 'font.woff', mime: 'font/woff', data: new Uint8Array([1]) }] });
  assert.equal(await context.module.exports.importEditableHtml({ text: async () => presentation }), 'new-local-id');
  assert.ok(writes.some(([kind, value]) => kind === 'media' && value.name === 'ppt/media/image1.jpeg'));
  assert.ok(writes.some(([kind, value]) => kind === 'record' && value.type === 'slides' && value.data.sld.timing.id === 'anim'));
  assert.equal(context.mustNotRun, undefined, 'opening presentation HTML must not execute its player');
  const count = writes.length;
  await assert.rejects(context.module.exports.importEditableHtml({ text: async () => '<html><script>window.mustNotRun = true</script></html>' }), /does not contain editable/);
  assert.equal(writes.length, count, 'unrelated HTML is rejected without writing records');
});
