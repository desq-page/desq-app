// Compiler source IDs preserve the ancestry of the HTML elements that produced
// each primitive. Turn contiguous element ranges into ordinary editor groups.
const isHtmlGroup = id => /^desq-html-group-\d+(?:-rot-.*)?$/.test(id);
export function groupImportedHtmlShapes(shapes, genId, { width = 1280, height = 720 } = {}) {
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
      const rotation = /-rot-(-?[\d.]+)-(-?[\d.]+)-(-?[\d.]+)$/.exec(item.ids.at(-1));
      let groupX = x, groupY = y, rot = 0;
      if (rotation) {
        rot = Number(rotation[1]);
        const px = Number(rotation[2]) * width / 1280, py = Number(rotation[3]) * height / 720;
        const cx = (x + right) / 2, cy = (y + bottom) / 2, radians = rot * Math.PI / 180;
        groupX += px + Math.cos(radians) * (cx - px) - Math.sin(radians) * (cy - py) - cx;
        groupY += py + Math.sin(radians) * (cx - px) + Math.cos(radians) * (cy - py) - cy;
      }
      return [{ id: genId(), name: 'HTML group', type: 'group', x: groupX, y: groupY, ...(rot ? { rot } : {}), w: right - x, h: bottom - y,
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
