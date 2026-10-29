const fs = require('node:fs');
const ts = require('typescript');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vue = require('vue');
const { renderToString } = require('@vue/server-renderer');
const { parse, compileScript } = require('@vue/compiler-sfc');

function component() {
  const filename = __dirname + '/TabbarItems.vue';
  const { descriptor } = parse(fs.readFileSync(filename, 'utf8'), { filename });
  const script = compileScript(descriptor, { id: 'tab-icons', inlineTemplate: true });
  const exports = {};
  const deps = {
    vue, 'naive-ui': require('naive-ui'),
    '@/lib/common/store': { piniaInfo: () => ({ currentTaskPane: 'googlefonts' }), piniaSelect: () => ({ selShpFormat: null }) },
    '@/lib/main/utils': { toggleTaskPane() {} },
  };
  new Function('exports', 'require', ts.transpileModule(script.content, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText)(exports, id => deps[id] || {});
  return exports.default;
}

test('font tabs render their configured Google, upload and system SVG icons', async () => {
  const filename = __dirname + '/../../editor/Text/ToolbarTextOptions.ts';
  const ast = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true);
  const declaration = ast.statements.find(node => ts.isVariableStatement(node) &&
    node.declarationList.declarations.some(d => d.name.getText(ast) === 'fontTabbarItems'));
  const exports = {};
  new Function('exports', 'LogoGoogle', 'FileUpload', 'DeviceLaptop', ts.transpileModule(declaration.getText(ast), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText)(exports, require('@vicons/carbon').LogoGoogle,
    require('@vicons/tabler').FileUpload, require('@vicons/tabler').DeviceLaptop);
  const html = await renderToString(vue.createSSRApp(component(), { items: exports.fontTabbarItems }));
  assert.equal((html.match(/<svg\b/g) || []).length, 3);
  assert.equal((html.match(/n-button__icon/g) || []).length, 3);
  for (const label of ['Google', 'Uploaded', 'System']) assert.ok(html.includes(label));
});

test('tabs without an icon keep their text-only rendering', async () => {
  const html = await renderToString(vue.createSSRApp(component(), { items: [{ label: 'Plain', taskpane: 'plain' }] }));
  assert.ok(html.includes('Plain'));
  assert.equal((html.match(/<svg\b/g) || []).length, 0);
});
