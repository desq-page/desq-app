// Compare the content placement, not template IDs, palettes, or generated shape IDs.
// Small spacing changes should not fill the taskpane with the same composition.
function contentGeometry(entry, width, height) {
  return entry.candidate.shapes.filter(shape => shape.txBody || shape.blipFill || shape.graphic)
    .filter(shape => shape.name !== 'Template list marker' && shape.ph?.$_type !== 'sldNum' &&
      !/^slide number(?: placeholder)?(?: \d+)?$/i.test(shape.name || ''))
    .map(shape => ({ kind: shape.graphic ? 'chart' : shape.blipFill ? 'photo' : 'text',
      box: [shape.x / width, shape.y / height, shape.w / width, shape.h / height] }));
}
export function distinctLayoutSuggestions(ranked, { width, height }) {
  const kept = [];
  for (const entry of ranked) {
    const geometry = contentGeometry(entry, width, height);
    const duplicate = kept.some(other => {
      if (other.entry.candidate.topology !== entry.candidate.topology || other.geometry.length !== geometry.length) return false;
      let total = 0;
      for (let i = 0; i < geometry.length; i++) {
        if (geometry[i].kind !== other.geometry[i].kind) return false;
        for (let j = 0; j < 4; j++) {
          const distance = Math.abs(geometry[i].box[j] - other.geometry[i].box[j]);
          if (distance > .065) return false;
          total += distance;
        }
      }
      return total / Math.max(1, geometry.length * 4) < .025;
    });
    if (!duplicate) kept.push({ entry, geometry });
  }
  return kept.map(item => item.entry);
}
