import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../editor-vuejs/src/components/editor/Animation/ShapeAnimations.vue', import.meta.url), 'utf8');
function setup(timing) {
  const context = vm.createContext({
    getSlideInfo: () => ({ timing }),
    selectedIdx: { value: -1 }, selectedGrp: { value: 0 },
    selectedEffects: { value: new Set() }, selectionAnchor: -1,
    updateSlideAnimations: () => {}, saveDexie: () => {}, refreshAnim: () => {},
    document: { querySelectorAll: () => [] },
  });
  const handlers = source.slice(source.indexOf('let dragAnim:'), source.indexOf('\nfunction shapeSelected'));
  const move = source.slice(source.indexOf('function moveEffGrp('), source.indexOf('\nfunction addAnimations'));
  vm.runInContext(ts.transpile(handlers + '\n' + move), context);
  return context;
}

test('moves effects up, down, to the first position, and preserves selection', () => {
  const timing = { m: ['a', 'b', 'c', 'd'].map(sh => ({ sh })), i: [] };
  const ctx = setup(timing);
  ctx.moveEffGrp(0, 0, 0, 3);
  assert.deepEqual(timing.m.map(e => e.sh), ['b', 'c', 'a', 'd']);
  assert.equal(ctx.selectedIdx.value, 2);
  assert.deepEqual([...ctx.selectedEffects.value], ['0:2']);
  ctx.moveEffGrp(0, 2, 0, 0);
  assert.deepEqual(timing.m.map(e => e.sh), ['a', 'b', 'c', 'd']);
  ctx.moveEffGrp(0, 0, 0, 1);
  assert.deepEqual(timing.m.map(e => e.sh), ['a', 'b', 'c', 'd']);
});

test('moving between groups adopts or removes the trigger', () => {
  const timing = { m: [{ sh: 'a' }], i: [{ ef: [{ sh: 'b', trs: 'trigger' }] }] };
  const ctx = setup(timing);
  ctx.moveEffGrp(0, 0, 1, 0);
  assert.deepEqual(timing.i[0].ef, [{ sh: 'a', trs: 'trigger' }, { sh: 'b', trs: 'trigger' }]);
  ctx.moveEffGrp(1, 0, 0, 0);
  assert.deepEqual(timing.m, [{ sh: 'a' }]);
});

test('internal dragover allows dropping and drop uses the hovered row boundary', () => {
  const timing = { m: ['a', 'b', 'c'].map(sh => ({ sh })), i: [] };
  const ctx = setup(timing);
  let prevented = 0;
  const e = {
    dataTransfer: { setData() {} }, preventDefault() { prevented++; },
    currentTarget: { getBoundingClientRect: () => ({ top: 10, height: 20 }), classList: { toggle() {} } },
    clientY: 11,
  };
  ctx.dragAnimOver(e);
  assert.equal(prevented, 0);
  ctx.dragAnimStart(e, 2, 0);
  ctx.dragAnimOver(e);
  assert.equal(prevented, 1);
  assert.equal(e.dataTransfer.dropEffect, 'move');
  ctx.dragAnimDrop(e, 0, 0);
  assert.deepEqual(timing.m.map(e => e.sh), ['c', 'a', 'b']);
  ctx.dragAnimDrop(e, 1, 0);
  assert.equal(prevented, 2);
});
