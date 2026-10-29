export function selectLayer(ids, selected, anchor, id, { shiftKey, ctrlKey, metaKey }) {
  if (!ids.includes(id)) return { selected, anchor };
  if (shiftKey) {
    const start = selected.includes(anchor) && ids.includes(anchor)
      ? anchor : selected.find(item => ids.includes(item)) || id;
    const from = ids.indexOf(start), to = ids.indexOf(id);
    return { selected: ids.slice(Math.min(from, to), Math.max(from, to) + 1), anchor: start };
  }
  if (ctrlKey || metaKey) {
    return { selected: selected.includes(id) ? selected.filter(item => item !== id) : [...selected, id], anchor: id };
  }
  return { selected: [id], anchor: id };
}
