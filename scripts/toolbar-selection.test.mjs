import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveToolbarTab } from '../editor-vuejs/src/lib/main/toolbarSelection.mjs';

const normal = { editingPoints: false, useGrid: false, hasShape: true };
test('selecting or changing a shape preserves the chosen toolbar tab', () => {
  for (const tab of ['home', 'insert', 'design', 'view', 'animation', 'shape-format']) {
    assert.equal(resolveToolbarTab(tab, normal), tab);
  }
  assert.equal(resolveToolbarTab('view', { ...normal, hasShape: false }), 'view');
});
test('deselecting a shape returns from the contextual tab to Home', () => {
  assert.equal(resolveToolbarTab('shape-format', { ...normal, hasShape: false }), 'home');
});
test('point editing uses Shape Format, and grid mode selects its special tab', () => {
  assert.equal(resolveToolbarTab('view', { ...normal, editingPoints: true }), 'shape-format');
  assert.equal(resolveToolbarTab('shape-format', normal), 'shape-format');
  assert.equal(resolveToolbarTab('view', { ...normal, useGrid: true }), 'sizes');
  assert.equal(resolveToolbarTab('points', normal), 'home');
  assert.equal(resolveToolbarTab('sizes', normal), 'home');
});
