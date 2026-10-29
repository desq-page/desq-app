import test from 'node:test';
import assert from 'node:assert/strict';
import { selectLayer } from './layerSelection.mjs';

test('layer selection toggles with Ctrl or Command and selects a range with Shift', () => {
  const ids = ['front', 'second', 'third', 'back'];
  let state = selectLayer(ids, [], undefined, 'second', {});
  state = selectLayer(ids, state.selected, state.anchor, 'back', { shiftKey: true });
  assert.deepEqual(state.selected, ['second', 'third', 'back']);
  state = selectLayer(ids, state.selected, state.anchor, 'front', { shiftKey: true });
  assert.deepEqual(state.selected, ['front', 'second']);
  state = selectLayer(ids, state.selected, state.anchor, 'back', { ctrlKey: true });
  assert.deepEqual(state.selected, ['front', 'second', 'back']);
  state = selectLayer(ids, state.selected, state.anchor, 'second', { metaKey: true });
  assert.deepEqual(state.selected, ['front', 'back']);
  state = selectLayer(ids, state.selected, state.anchor, 'third', { shiftKey: true });
  assert.deepEqual(state.selected, ['front', 'second', 'third']);
  state = selectLayer(ids, state.selected, state.anchor, 'back', {});
  assert.deepEqual(state.selected, ['back']);
});
