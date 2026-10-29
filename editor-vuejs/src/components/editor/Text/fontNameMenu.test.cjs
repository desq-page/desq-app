const fs = require('node:fs');
const ts = require('typescript');
const assert = require('node:assert/strict');
const { test } = require('node:test');
function fixture(queryLocalFonts, savedRecent = null) {
  let persistedRecent = savedRecent;
  const exports = {};
  new Function('exports', 'require', 'window', ts.transpileModule(fs.readFileSync(__dirname + '/fontNameMenu.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText)(exports, require, { queryLocalFonts, localStorage: {
    getItem: () => persistedRecent, setItem: (_, value) => { persistedRecent = value; },
  } });
  const applied = [], uploaded = [], google = [], panels = [];
  const menu = exports.createFontNameMenu({
    getFonts: () => [
      { family: 'Uploaded', name: 'uploaded.ttf', type: 'local' },
      { family: 'Uploaded', name: 'uploaded-bold.ttf', type: 'local' },
      { family: 'Google', type: 'google' },
      { family: 'Missing asset', type: 'local' },
    ],
    getThemeFonts: () => [{ family: 'Theme Heading', role: 'Headings' }, { family: 'Theme Body', role: 'Body' }],
    applyFont: font => applied.push(font), loadUploadedFont: font => uploaded.push(font),
    loadGoogleFont: font => google.push(font),
    openPanel: pane => panels.push(pane),
  });
  return { menu, applied, uploaded, google, panels, systemFonts: exports.systemFontSource, remember: exports.rememberFontFamily, recents: exports.recentFontFamilies, themeFontFamilies: exports.themeFontFamilies, createSystemFontSource: exports.createSystemFontSource, storedRecents: () => JSON.parse(persistedRecent) };
}
test('dropdown contains theme/recent groups and three panel links without source font lists', () => {
  let requests = 0;
  const f = fixture(async () => { requests++; return []; });
  assert.deepEqual(f.menu.options().filter(o => o.label).map(o => o.label),
    ['Theme Fonts', 'Recent Fonts', 'Google Fonts…', 'Uploaded Fonts…', 'System Fonts (restricted)…']);
  const options = f.menu.options();
  assert.deepEqual(options[0].children.map(o => o.label), ['Theme Heading (Headings)', 'Theme Body (Body)']);
  assert.equal(options[1].children[0].label, 'No recent fonts');
  assert.ok(options.slice(3).every(o => !o.children));
  assert.equal(requests, 0);
});
test('System Fonts link opens its panel without requesting access; the button shares the result', async () => {
  let requests = 0;
  const f = fixture(async () => { requests++; return [{ family: 'Zeta' }, { family: 'Arial' }, { family: 'Arial' }]; });
  f.menu.options().find(o => o.key === 'system-fonts').onClick();
  assert.equal(requests, 0, 'opening the panel does not request permission');
  assert.deepEqual(f.panels, ['systemfonts']);
  await f.systemFonts.request();
  assert.deepEqual(f.systemFonts.families.value, ['Arial', 'Zeta']);
  await f.systemFonts.request();
  assert.equal(requests, 1);
  assert.ok(!JSON.stringify(f.menu.options()).includes('Arial'), 'system families remain in the panel');
});
test('permission denial stays in the panel and allows retry', async () => {
  let attempt = 0;
  const f = fixture(async () => { if (!attempt++) throw Object.assign(new Error(), { name: 'NotAllowedError' }); return [{ family: 'Arial' }]; });
  await f.systemFonts.request();
  assert.match(f.systemFonts.message.value, /denied/);
  assert.equal(f.systemFonts.loaded.value, false);
  await f.systemFonts.request();
  assert.deepEqual(f.systemFonts.families.value, ['Arial']);
});
test('unsupported browser shows a helpful panel message', async () => {
  const f = fixture(undefined);
  await f.systemFonts.request();
  assert.match(f.systemFonts.message.value, /unavailable in this browser/);
});
test('recent choices deduplicate, use the correct loader, and retain panel links', () => {
  const f = fixture();
  f.remember('Google');
  f.remember('Uploaded');
  f.remember('Google');
  assert.deepEqual(f.menu.options()[1].children.map(o => o.label), ['Google (Google)', 'Uploaded (Uploaded)']);
  f.menu.options()[1].children.find(o => o.label === 'Uploaded (Uploaded)').onClick();
  assert.equal(f.uploaded[0].family, 'Uploaded');
  f.menu.options()[1].children.find(o => o.label === 'Google (Google)').onClick();
  assert.deepEqual(f.applied, ['Uploaded', 'Google']);
  assert.deepEqual(f.google, ['Google']);
  f.menu.options().find(o => o.key === 'google-fonts').onClick();
  f.menu.options().find(o => o.key === 'uploaded-fonts').onClick();
  assert.deepEqual(f.panels, ['googlefonts', 'localfonts']);
  for (let i = 0; i < 20; i++) f.remember(`Font ${i}`);
  assert.equal(f.recents.value.length, 10);
  assert.equal(f.recents.value[0].family, 'Font 19');
});
test('theme choices apply the current heading/body family and enter recent history', () => {
  const f = fixture();
  assert.deepEqual(f.themeFontFamilies(null), []);
  assert.deepEqual(f.themeFontFamilies({ fontScheme: {
    majorFont: { latin: { $_typeface: 'Heading' } }, minorFont: { latin: { $_typeface: 'Body' } },
  } }), [{ family: 'Heading', role: 'Headings' }, { family: 'Body', role: 'Body' }]);
  f.menu.options()[0].children[0].onClick();
  assert.deepEqual(f.applied, ['Theme Heading']);
  assert.equal(f.menu.options()[1].children[0].label, 'Theme Heading (System)');
});

test('toolbar font callbacks tolerate a null file while the editor loads', () => {
  const { parse, compileScript, compileTemplate } = require('@vue/compiler-sfc');
  const filename = __dirname + '/ToolbarText.vue';
  const { descriptor } = parse(fs.readFileSync(filename, 'utf8'), { filename });
  const script = compileScript(descriptor, { id: 'font-null-file' });
  const template = compileTemplate({ source: descriptor.template.content, filename, id: 'font-null-file',
    compilerOptions: { bindingMetadata: script.bindings } });
  assert.deepEqual(template.errors, []);
  const ast = ts.createSourceFile('toolbar.ts', descriptor.scriptSetup.content, ts.ScriptTarget.Latest, true);
  const declaration = ast.statements.find(node => ts.isVariableStatement(node) &&
    node.declarationList.declarations.some(d => d.name.getText(ast) === 'fontMenu'));
  let file = null;
  const untouched = () => assert.fail('must not load or save fonts without a file');
  const callbacks = new Function('createFontNameMenu', 'getFileInfo', 'updateFontFamily',
    'loadCustomFont', 'getBaseHref', 'loadGoogleFont', 'updateFile', 'saveDexie', 'toggleTaskPane', 'getTheme', 'themeFontFamilies',
    ts.transpile(declaration.getText(ast)) + '\nreturn fontMenu;')(
    callbacks => callbacks, () => file, () => {}, untouched, untouched, untouched, untouched, untouched, () => {}, () => null, () => [],
  );
  assert.deepEqual(callbacks.getFonts(), []);
  callbacks.loadUploadedFont({ family: 'Uploaded' });
  callbacks.loadGoogleFont('Carlito');
  file = { id: 'loaded', fonts: [{ family: 'Uploaded', name: 'uploaded.ttf', type: 'local' }] };
  assert.equal(callbacks.getFonts()[0].family, 'Uploaded');
});


test('System Fonts renders a bounded batch, advances on scroll, and filters from the top', async () => {
  const { parse, compileScript, compileTemplate } = require('@vue/compiler-sfc');
  const vue = require('vue');
  const vueuse = await import('@vueuse/core');
  const filename = __dirname + '/SystemFonts.vue';
  const { descriptor } = parse(fs.readFileSync(filename, 'utf8'), { filename });
  const script = compileScript(descriptor, { id: 'system-fonts-test' });
  const template = compileTemplate({ source: descriptor.template.content, filename, id: 'system-fonts-test',
    compilerOptions: { bindingMetadata: script.bindings } });
  assert.deepEqual(template.errors, []);
  const f = fixture();
  f.systemFonts.families.value = Array.from({ length: 1000 }, (_, index) => `Font ${String(index).padStart(4, '0')}`);
  f.systemFonts.loaded.value = true;
  const edits = [];
  const exports = {};
  const deps = {
    vue: { ...vue, onMounted: callback => callback() }, '@vueuse/core': vueuse,
    './fontNameMenu': { systemFontSource: f.systemFonts, rememberFontFamily: f.remember },
    '@/lib/common/store': { piniaSelect: () => ({ editingInfo: {} }) },
    'shared-vuejs/api/execCommand': { execEditorSurroundSpan: style => edits.push(style) },
    'shared-vuejs/api/dbutils': { saveDexie() {} },
  };
  new Function('exports', 'require', ts.transpileModule(script.content, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText)(exports, id => deps[id] || {});
  const scope = vue.effectScope();
  try {
    const panel = scope.run(() => exports.default.setup({}, { expose() {} }));
    const container = { clientHeight: 280, scrollTop: 0 };
    panel.containerProps.ref.value = container;
    await vue.nextTick();
    panel.containerProps.onScroll();
    assert.ok(panel.list.value.length > 0 && panel.list.value.length < 30);
    assert.equal(panel.list.value[0].index, 0);
    container.scrollTop = 2800;
    panel.containerProps.onScroll();
    assert.ok(panel.list.value[0].index > 90);
    panel.doSearch('Font 099');
    await vue.nextTick();
    assert.equal(container.scrollTop, 0);
    assert.equal(panel.filteredItems.value.length, 10);
    assert.ok(panel.list.value.every(item => item.data.startsWith('Font 099')));
    panel.updateFontFamily('Font 0990');
    assert.deepEqual(edits, [{ 'font-family': 'Font 0990' }]);
  } finally {
    scope.stop();
  }
});

test('system font previews use installed fonts without starting Google font downloads', () => {
  const { parse, compileScript } = require('@vue/compiler-sfc');
  const filename = __dirname + '/GoogleFontItem.vue';
  const { descriptor } = parse(fs.readFileSync(filename, 'utf8'), { filename });
  const script = compileScript(descriptor, { id: 'font-preview-test' });
  const downloads = [];
  const exports = {};
  new Function('exports', 'require', ts.transpileModule(script.content, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText)(exports, id => id === 'vue' ? require('vue') :
    id === 'shared-vuejs/api/slideUtils' ? { loadGoogleFont: font => downloads.push(font) } : {});
  exports.default.setup({ type: 'system', item: { family: 'Arial' } }, { expose() {} });
  assert.deepEqual(downloads, []);
  exports.default.setup({ item: { family: 'Carlito' } }, { expose() {} });
  assert.deepEqual(downloads, ['Carlito']);
});


for (const state of ['granted', 'prompt', 'denied', 'unsupported']) {
  test(`opening System Fonts with ${state} permission only enumerates already-allowed fonts`, async () => {
    let enumerations = 0;
    let checks = 0;
    const f = fixture();
    const source = f.createSystemFontSource(
      () => async () => { enumerations++; return [{ family: 'Arial' }]; },
      async () => { checks++; if (state === 'unsupported') throw new Error('Unsupported'); return { state }; },
    );
    await source.loadIfGranted();
    assert.equal(checks, 1);
    assert.equal(enumerations, state === 'granted' ? 1 : 0);
    assert.equal(source.loaded.value, state === 'granted');
    if (state === 'granted') {
      assert.deepEqual(source.families.value, ['Arial']);
      await source.loadIfGranted();
      assert.equal(enumerations, 1, 'reuse fonts on subsequent opens');
    }
  });
}


test('recent labels retain their explicit source even when families overlap', () => {
  const f = fixture();
  f.remember('Google', 'system');
  assert.equal(f.menu.options()[1].children[0].label, 'Google (System)');
  f.menu.options()[1].children[0].onClick();
  assert.deepEqual(f.google, [], 'system choice must not trigger the Google loader');
  f.remember('Google', 'google');
  assert.equal(f.recents.value.length, 1);
  assert.equal(f.menu.options()[1].children[0].label, 'Google (Google)');
  f.menu.options()[1].children[0].onClick();
  assert.deepEqual(f.google, ['Google']);
});
test('legacy recent font names migrate and source metadata survives reload', () => {
  const f = fixture(undefined, JSON.stringify(['Google', 'Uploaded', 'Google']));
  assert.deepEqual(f.menu.options()[1].children.map(o => o.label), ['Google (Google)', 'Uploaded (Uploaded)']);
  f.remember('Arial', 'system');
  assert.deepEqual(f.storedRecents()[0], { family: 'Arial', type: 'system' });
  const reopened = fixture(undefined, JSON.stringify(f.storedRecents()));
  assert.equal(reopened.menu.options()[1].children[0].label, 'Arial (System)');
});
