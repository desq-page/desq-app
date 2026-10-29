import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { getRunText, withRunText } from '../shared-vuejs/src/lib/text/run-text.js';
import { outlineNativeText } from '../editor-vuejs/src/lib/agent/ppt-master-outlines.mjs';

function loadTextUtil(onPrepare = () => {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync('shared-vuejs/src/lib/text/textUtil.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    exports, structuredClone,
    require(name) {
      if (name === "./run-text.js") return { getRunText, withRunText };
      if (name === '../utility') return { genId: () => 'id', nodeAsArray: value => value == null ? [] : Array.isArray(value) ? value : [value] };
      if (name === '@chenglou/pretext/rich-inline') return { prepareRichInline: onPrepare, walkRichInlineLineRanges() {} };
      return {};
    },
  });
  return exports;
}

test('tab splitting preserves object and missing text, and splits string tabs with formatting', () => {
  const { splitTabs, getShapeTextInfo } = loadTextUtil();
  const objectRun = { t: { text: 'wrapped', metadata: true }, rPr: { bold: true } };
  const missingRun = { mathML: '<math/>' };
  const stringRun = { t: 'a\t\tb', rPr: { italic: true } };
  const result = splitTabs([objectRun, missingRun, stringRun, { t: '\t' }, { t: '' }]);
  assert.equal(result[0], objectRun);
  assert.equal(result[1], missingRun);
  assert.deepEqual(Array.from(result.slice(2), run => run.t), ['a', '\t', '', '\t', 'b', '\t', '']);
  assert.ok(result.slice(2, 7).every(run => run.rPr === stringRun.rPr));
  const info = getShapeTextInfo({ txBody: { p: { r: [objectRun, stringRun] } } });
  assert.equal(info.text, 'wrappeda\t\tb');
  assert.deepEqual(info.paras[0].runs[0].t, objectRun.t);
});

test('pretext receives only strings without changing object-valued runs', () => {
  let items;
  const { calcPretext } = loadTextUtil(value => { items = value; return {}; });
  const object = { text: 'wrapped' };
  const runs = [{ t: object }, {}, { t: 'hello' }, { t: '\t' }, { $_otag: 'br' }];
  calcPretext(runs, {}, [], 48, 0);
  assert.deepEqual(Array.from(items, item => item.text), ['wrapped', '', 'hello', '\u200A', '\n']);
  assert.equal(runs[0].t, object);
});

test('glyph outlines do not pass object-valued text to font APIs', () => {
  const seen = [];
  const font = {
    getPath(text) { seen.push(text); return { toPathData: () => 'M0 0L1 1' }; },
    getAdvanceWidth(text) { assert.equal(typeof text, 'string'); return text.length; },
  };
  outlineNativeText({ x: 0, y: 0, w: 100, h: 100, txBody: { p: [{ r: [{ t: { text: 'wrapped' } }, { t: 'ok' }] }] } }, new Map([['arial', font]]));
  assert.deepEqual(seen, ['wrapped', 'ok']);
});

 test('object text tabs preserve text-node metadata', () => {
  const { splitTabs } = loadTextUtil();
  const value = { t: { text: 'a\t b', lang: 'en' }, rPr: { bold: true } };
  const result = splitTabs([value]);
  assert.deepEqual(Array.from(result, getRunText), ['a', '\t', ' b']);
  assert.ok(result.every(run => run.t.lang === 'en' && run.rPr === value.rPr));
  assert.equal(value.t.text, 'a\t b');
  assert.equal(getRunText({ t: {} }), '');
});

async function loadPptxXmlParser() {
  const upstream = await import('txml/txml');
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync('shared-vuejs/src/lib/txml/txml.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, require(name) {
    if (name === 'txml/txml') return upstream;
    if (name === '../text/textUtil') return { escapeHtmlEntities: text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') };
    return { tagsWithPrefixP: ['txBody'] };
  } });
  const tXml = exports.default;
  const file = 'shared-vuejs/src/edlib/pptx/import/import-txml.ts';
  const ast = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const functions = ['makeOOXmlTagsUniform', 'loadUzipData', 'addIdToParaAndRuns'].map(name =>
    ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name).getText(ast));
  const importer = {};
  vm.runInNewContext(ts.transpileModule(functions.join('\n') + '\nexports.addIdToParaAndRuns = addIdToParaAndRuns;', {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports: importer, tXml, TextDecoder, getRunText, withRunText,
    genId: () => 'id', nodeAsArray: value => value == null ? [] : Array.isArray(value) ? value : [value],
    unescapeHtmlEntities: text => upstream.parse(`<t>${text}</t>`, { decodeEntities: true, keepWhitespace: true })[0].children.join(''),
  });
  return { ...importer, tXml };
}

test('Presentation2 paragraph retains preserved spaces and all three self-closing line breaks on import', async () => {
  const { loadUzipData, tXml, addIdToParaAndRuns } = await loadPptxXmlParser();
  const xml = readFileSync('scripts/fixtures/pptx-preserve-space.xml', 'utf8');
  const imported = loadUzipData('slide.xml', { 'slide.xml': new TextEncoder().encode(xml) });
  addIdToParaAndRuns({ sp: imported });
  const runs = imported.txBody.p.r;
  assert.equal(runs.filter(run => run.$_otag === 'br').length, 3);
  const preserved = runs.filter(run => run.t?.['$_xml:space'] === 'preserve');
  assert.deepEqual(Array.from(preserved, getRunText), ['Năng suất Robusta tăng từ ', 'lên ', ' giữa hai niên vụ,']);
  const expected = 'Năng suất Robusta tăng từ 2,73\nlên 2,93 tấn/ha giữa hai niên vụ,\ntrong khi Arabica giữ nguyên\nquanh mức 1,0–1,2 triệu bao.';
  const content = values => Array.from(values, run => run.$_otag === 'br' ? '\n' : getRunText(run)).join('');
  assert.equal(content(runs), expected);
  const info = loadTextUtil().getShapeTextInfo({ txBody: imported.txBody });
  assert.equal(content(info.paras[0].runs), expected);
  const reloaded = loadUzipData('slide.xml', { 'slide.xml': new TextEncoder().encode(tXml.stringify(imported, 'ppt/slides/slide4.xml')) });
  addIdToParaAndRuns({ sp: reloaded });
  assert.equal(content(reloaded.txBody.p.r), expected);
  assert.equal(reloaded.txBody.p.r[0].t['$_xml:space'], 'preserve');
});

test('preserved whitespace-only text and literal newlines survive XML parsing', async () => {
  const { loadUzipData, makeOOXmlTagsUniform } = await loadPptxXmlParser();
  for (const br of ['<a:br/>', '<a:br />', '<a:br lang="en"/>', '<a:br></a:br>']) {
    const xml = `<p:txBody><a:p><a:r><a:t xml:space="preserve">  \n </a:t></a:r>${br}</a:p></p:txBody>`;
    const imported = loadUzipData('slide.xml', { 'slide.xml': new TextEncoder().encode(xml) });
    assert.equal(getRunText(imported.txBody.p.r[0]), '  \n ');
    assert.equal(imported.txBody.p.r[1].$_otag, 'br');
  }
  assert.equal(makeOOXmlTagsUniform('<a:bravo/>'), '<a:bravo/>');
});
