const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function fixture(selection, editable = false) {
  const source = fs.readFileSync(__dirname + '/ToolbarTop.vue', 'utf8');
  const script = source.split('<script setup lang="ts">')[1].split('</script>')[0];
  const ast = ts.createSourceFile('ToolbarTop.ts', script, ts.ScriptTarget.Latest, true);
  const functions = ast.statements.filter(node => ts.isFunctionDeclaration(node) && ['showPointTab', 'showSpecialTab'].includes(node.name?.text));
  const context = vm.createContext({ piniaSelect: () => selection, piniaInfo: () => ({ useGrid: false }), showEditingPoint: () => editable });
  vm.runInContext(ts.transpile(functions.map(fn => fn.getText(ast)).join('\n')), context);
  return context;
}

test('a selected straight motion line opens point controls and disables other tabs', () => {
  const selection = { editingPoint: 1, selShps: ['motionSh-shape:0:0'], selShpFormat: { type: 'line', motionSh: 'shape' } };
  const state = fixture(selection);
  assert.equal(state.showPointTab(), true);
  assert.equal(state.showSpecialTab(), true);
  selection.editingPoint = -1;
  assert.equal(state.showPointTab(), false);
});

test('ordinary lines retain their normal toolbar', () => {
  const state = fixture({ editingPoint: 1, selShps: ['line'], selShpFormat: { type: 'line' } });
  assert.equal(state.showPointTab(), false);
  assert.equal(state.showSpecialTab(), false);
});
