const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function fixture(shape) {
  const source = fs.readFileSync(__dirname + '/ShapeAnimations.vue', 'utf8');
  const script = source.split('<script setup lang="ts">')[1].split('</script>')[0];
  const ast = ts.createSourceFile('ShapeAnimations.ts', script, ts.ScriptTarget.Latest, true);
  const fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'shapeSelected');
  const state = {
    selectedIdx: { value: 0 }, selectedGrp: { value: 0 },
    selectedEffects: { value: new Set(['0:0', '0:1']) }, selectionAnchor: 0,
    animGrps: { value: [[{ shpId: 'a' }, { shpId: 'b' }], [{ shpId: 'c' }]] },
    getSelectSelShpFormat: () => shape, getEffIdx: () => null,
  };
  vm.createContext(state);
  vm.runInContext(ts.transpile(fn.getText(ast)), state);
  return state;
}

test('selecting a motion path highlights its effect and replaces stale multi-selection', () => {
  const f = fixture({ id: 'motionSh-c:1:0', motionSh: 'c', motionGrp: 1, motionEff: 0 });
  f.shapeSelected();
  assert.equal(f.selectedGrp.value, 1);
  assert.equal(f.selectedIdx.value, 0);
  assert.deepEqual(Array.from(f.selectedEffects.value), ['1:0']);
  assert.equal(f.selectionAnchor, 0);
});

test('selecting a different motion path updates the highlighted row', () => {
  const f = fixture({ id: 'motionSh-b:0:1', motionSh: 'b', motionGrp: 0, motionEff: 1 });
  f.shapeSelected();
  assert.deepEqual(Array.from(f.selectedEffects.value), ['0:1']);
  assert.equal(f.selectionAnchor, 1);
});
