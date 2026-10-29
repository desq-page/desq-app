// Shape selection reveals a contextual tab without changing the active tab.
export function resolveToolbarTab(current, { editingPoints, useGrid, hasShape }) {
  if (editingPoints) return 'shape-format';
  if (useGrid) return 'sizes';
  if (current === 'points' || current === 'sizes' || (current === 'shape-format' && !hasShape)) return 'home';
  return current;
}
