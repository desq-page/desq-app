import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { blankDocument, normalizeDocument, createShape, setText, plainText, textStyle, formatText, color,
  duplicateSlide, moveEffect, removeShapes, createHistory } from '../src/model.mjs';
import { editableHTML, scriptJSON } from '../src/document.mjs';
globalThis.crypto ||= webcrypto;

test('native JSON preserves unknown fields and repairs slide metadata after edits', () => {
  const doc = blankDocument();
  doc.file.custom = { preserve: true }; doc.slides[0].custom = ['native'];
  doc.slides[0].shapes.push({ id: 's', type: 'chart', unsupportedData: { series: [1, 2] } });
  const result = normalizeDocument(JSON.parse(JSON.stringify(doc)));
  assert.deepEqual(result.file.custom, doc.file.custom);
  assert.deepEqual(result.slides[0], doc.slides[0]);
  assert.equal(result.file.slides[0].id, result.slides[0].id);
  assert.throws(() => normalizeDocument({ file: { width: 100, height: 100 }, slides: [{ id: 'metadata-only' }] }), /full slide/);
  const invalid = blankDocument(); invalid.file.width = 0;
  assert.throws(() => normalizeDocument(invalid), /positive/);
});

test('text editing and formatting use Savanna txBody runs', () => {
  const shape = createShape('text');
  setText(shape, 'First\nSecond');
  formatText(shape, { $_b: 1, solidFill: color('#123456') });
  assert.equal(plainText(shape), 'First\nSecond');
  assert.equal(shape.txBody.p[1].r[0].rPr.$_b, 1);
  assert.notEqual(shape.txBody.p[0].r[0].rPr.solidFill, shape.txBody.p[1].r[0].rPr.solidFill);
});

test('duplicating slides remaps nested shape IDs and animation targets', () => {
  const source = { id: 'slide', shapes: [{ id: 'group', children: [{ id: 'shape', name: 'Title' }] }], timing: { m: [{ sh: 'shape', trs: 'group', du: 2 }] } };
  const copy = duplicateSlide(source);
  assert.notEqual(copy.id, source.id);
  assert.notEqual(copy.shapes[0].id, 'group');
  assert.equal(copy.timing.m[0].sh, copy.shapes[0].children[0].id);
  assert.equal(copy.timing.m[0].trs, copy.shapes[0].id);
  assert.equal(source.shapes[0].children[0].id, 'shape');
});

test('effects reorder in both directions without changing timings or triggers', () => {
  const slide = { timing: { m: [{ sh: 'a', du: 2 }, { sh: 'b', du: 4 }, { sh: 'c', du: 1 }], i: [{ ef: [{ sh: 'd', trs: 't' }, { sh: 'e', trs: 't' }] }] } };
  assert.equal(moveEffect(slide, 0, 0, 2), true);
  assert.deepEqual(slide.timing.m.map(e => e.sh), ['b', 'c', 'a']);
  moveEffect(slide, 0, 2, 0);
  assert.equal(slide.timing.m[0].du, 2);
  moveEffect(slide, 1, 1, 0);
  assert.deepEqual(slide.timing.i[0].ef, [{ sh: 'e', trs: 't' }, { sh: 'd', trs: 't' }]);
  assert.equal(moveEffect(slide, 0, -1, 0), false);
});

test('deleting groups cleans up animation targets and triggers of descendants', () => {
  const slide = { shapes: [{ id: 'group', children: [{ id: 'a' }] }, { id: 'b' }], timing: { m: [{ sh: 'a' }, { sh: 'b' }], i: [{ ef: [{ sh: 'b', trs: 'a' }] }] } };
  removeShapes(slide, ['group']);
  assert.deepEqual(slide.shapes, [{ id: 'b' }]);
  assert.deepEqual(slide.timing, { m: [{ sh: 'b' }], i: [] });
});

test('history gives isolated snapshots, preserves the save point, and discards redo branches', () => {
  const history = createHistory({ n: 0 }, 2);
  history.commit({ n: 1 }); history.saved(); history.commit({ n: 2 });
  assert.equal(history.dirty, true); assert.deepEqual(history.undo(), { n: 1 }); assert.equal(history.dirty, false);
  assert.deepEqual(history.redo(), { n: 2 });
  history.undo(); history.commit({ n: 3 }); assert.equal(history.canRedo, false);
  const copy = history.value; copy.n = 100; assert.equal(history.value.n, 3);
});

test('editable HTML safely embeds JSON, runtime and title without external resources', () => {
  const doc = blankDocument(); doc.file.name = '</title><script>bad()</script>';
  doc.slides[0].note = '</script><script>bad()</script>\u2028';
  const resources = { renderer: 'window.renderer=true;', player: 'window.player=true;', playerStyles: 'body{}', playerAssets: [{name:'assets/fonts/test.woff',mime:'font/woff',data:new Uint8Array([1])}] };
  const html = editableHTML(doc, 'window.example="</script>";', resources);
  assert.ok(!html.includes('<script>bad()'));
  assert.ok(html.includes('id="savanna-document"'));
  assert.ok(!html.includes('window.renderer=true;'), 'renderer is included in the editor runtime');
  assert.deepEqual(JSON.parse(scriptJSON(doc)), doc);
  assert.equal((html.match(/<script /g) || []).length, 2);
  assert.throws(() => editableHTML(doc, ''), /runtime is missing/);
});

test('editable HTML stores aliased media once and restores each asset', async () => {
  const { unpackDocumentAssets } = await import('../src/document.mjs');
  const doc = blankDocument();
  const video = 'data:video/mp4;base64,' + 'abc123'.repeat(100);
  doc.assets = { 'video.mp4': video, 'media/video.mp4': video, 'ppt/media/video.mp4': { data: video, caption: 'clip' } };
  const resources = { player: 'window.player=true;', playerStyles: 'body{}', playerAssets: [{ name:'font.woff', mime:'font/woff', data:new Uint8Array([1]) }] };
  const html = editableHTML(doc, 'window.editor=true;', resources);
  assert.equal(html.split(video).length - 1, 1);
  const payload = JSON.parse(html.match(/<script type="application\/json" id="savanna-document">([\s\S]*?)<\/script>/)[1]);
  assert.deepEqual(unpackDocumentAssets(payload).assets, doc.assets);
  assert.equal(doc.assets['media/video.mp4'], video, 'export does not mutate the document');
  assert.deepEqual(unpackDocumentAssets({ assets: { video } }), { assets: { video } }, 'older files remain supported');
});

test('editable HTML stores player font once and initializes its offline stylesheet', async () => {
  const vm = await import('node:vm');
  const font = new Uint8Array([1, 2, 3, 4]);
  const resources = { player: 'window.player=true;', playerStyles: '@font-face{src:url(/fonts/Carlito.woff2)}',
    playerAssets: [{ name: 'assets/fonts/Carlito.woff2', mime: 'font/woff2', data: font }] };
  const html = editableHTML(blankDocument(), 'window.editor=true;', resources);
  const encoded = Buffer.from(font).toString('base64');
  assert.equal(html.split(encoded).length - 1, 1);
  const style = {};
  const context = { window: {}, document: { querySelector: () => style } };
  vm.runInNewContext(html.match(/<script>(window\.SavannaEmbeddedPlayer=[\s\S]*?)<\/script>/)[1], context);
  assert.equal(style.textContent, `@font-face{src:url(data:font/woff2;base64,${encoded})}`);
});


test('single native paragraph/run objects render as text and remain editable', () => {
  const shape = { txBody: { bodyPr: {}, p: { id: 'p', pPr: { $_algn: 'r' }, r: {
    t: { text: 'Imported singleton', metadata: true }, rPr: { $_sz: 3200, $_i: 1 },
  } } } };
  assert.equal(plainText(shape), 'Imported singleton');
  assert.equal(textStyle(shape).$_sz, 3200);
  formatText(shape, { $_b: 1 });
  assert.equal(shape.txBody.p.r.rPr.$_b, 1);
  assert.equal(shape.txBody.p.r.t.metadata, true);
  setText(shape, 'Edited singleton');
  assert.equal(plainText(shape), 'Edited singleton');
  assert.equal(shape.txBody.p[0].id, 'p');
  assert.equal(shape.txBody.p[0].pPr.$_algn, 'r');
  assert.equal(shape.txBody.p[0].r[0].rPr.$_sz, 3200);
});

test('mixed singleton/array paragraphs and runs, and empty bodies are supported', () => {
  const shape = { txBody: { p: [ { r: { t: 'One' } }, { r: [{ t: 'Two' }, { t: ' runs' }] }, {} ] } };
  assert.equal(plainText(shape), 'One\nTwo runs\n');
  formatText(shape, { $_b: 1 });
  assert.equal(shape.txBody.p[0].r.rPr.$_b, 1);
  assert.equal(shape.txBody.p[1].r[1].rPr.$_b, 1);
  const empty = { txBody: {} };
  assert.equal(plainText(empty), '');
  assert.doesNotThrow(() => formatText(empty, { $_i: 1 }));
});
