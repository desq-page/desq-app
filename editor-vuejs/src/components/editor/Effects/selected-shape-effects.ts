import { getSelectSelGrpShps, getSelectSelShps, getShapeDeep, updateShape } from "shared-vuejs/editor";

export function applyToSelectedShapes(change: (shape: any) => any) {
  const groupSelection = getSelectSelGrpShps();
  const ids = new Set(groupSelection.length ? groupSelection : getSelectSelShps());
  let changed = false;
  for (const id of ids) {
    const shape = getShapeDeep(id);
    if (!shape) continue;
    updateShape(change(shape) ?? shape);
    changed = true;
  }
  return changed;
}
