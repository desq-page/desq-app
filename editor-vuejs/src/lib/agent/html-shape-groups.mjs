// Compiler source IDs preserve the ancestry of the HTML elements that produced
// each primitive. Turn contiguous element ranges into ordinary editor groups.
const isHtmlGroup = id => /^desq-html-group-\d+$/.test(id);
export function groupImportedHtmlShapes(shapes, genId) {
  const tree = [];
  const stack = [{ ids: [], children: tree }];
  for (const shape of shapes) {
    const ids = (shape.sourceIds || []).filter(isHtmlGroup);
    let shared = 0;
    while (shared < ids.length && stack[shared + 1]?.ids[shared] === ids[shared]) shared++;
    stack.length = shared + 1;
    for (let i = shared; i < ids.length; i++) {
      const node = { ids: ids.slice(0, i + 1), children: [] };
      stack.at(-1).children.push(node);
      stack.push(node);
    }
    stack.at(-1).children.push(shape);
  }
  function build(items) {
    return items.flatMap(item => {
      if (!item.ids) return [item];
      const children = build(item.children);
      if (children.length < 2) return children;
      const x = Math.min(...children.map(c => c.x)), y = Math.min(...children.map(c => c.y));
      const right = Math.max(...children.map(c => c.x + c.w)), bottom = Math.max(...children.map(c => c.y + c.h));
      return [{ id: genId(), name: 'HTML group', type: 'group', x, y, w: right - x, h: bottom - y,
        children: children.map(child => ({ ...child, x: child.x - x, y: child.y - y })) }];
    });
  }
  return build(tree);
}

// Inspection and preview code works in slide coordinates; editor groups store
// their children relative to the group origin.
export function flattenShapeGroups(shapes, x = 0, y = 0) {
  return shapes.flatMap(shape => shape.type === 'group' && shape.children
    ? flattenShapeGroups(shape.children, x + shape.x, y + shape.y)
    : [{ ...shape, x: x + shape.x, y: y + shape.y }]);
}
