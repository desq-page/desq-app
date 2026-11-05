// Compiler source IDs preserve the ancestry of the HTML elements that produced
// each primitive. Turn contiguous element ranges into ordinary editor groups.
const isHtmlGroup = id => /^desq-html-group-\d+(?:-rot-.*?)?(?:-clip-.*?)?(?:-hover-.*)?$/.test(id);
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
      const [groupId, hoverData] = item.ids.at(-1).split(/-hover-(?=%7B)/);
      let hoverStyle;
      if (hoverData) {
        try { hoverStyle = JSON.parse(decodeURIComponent(hoverData)); } catch {}
      }
      const clip = /-clip-([01])([01])-(-?[\d.]+)_(-?[\d.]+)_([\d.]+)_([\d.]+)$/.exec(groupId);
      if (!children.length || (children.length < 2 && !clip && !hoverStyle)) return children;
      const x = clip ? Number(clip[3]) * width / 1280 : Math.min(...children.map(c => c.x));
      const y = clip ? Number(clip[4]) * height / 720 : Math.min(...children.map(c => c.y));
      const right = clip ? x + Number(clip[5]) * width / 1280 : Math.max(...children.map(c => c.x + c.w));
      const bottom = clip ? y + Number(clip[6]) * height / 720 : Math.max(...children.map(c => c.y + c.h));
      const rotation = /-rot-(-?[\d.]+)-(-?[\d.]+)-(-?[\d.]+)(?:-clip-|$)/.exec(groupId);
      let groupX = x, groupY = y, rot = 0;
      if (rotation) {
        rot = Number(rotation[1]);
        const px = Number(rotation[2]) * width / 1280, py = Number(rotation[3]) * height / 720;
        const cx = (x + right) / 2, cy = (y + bottom) / 2, radians = rot * Math.PI / 180;
        groupX += px + Math.cos(radians) * (cx - px) - Math.sin(radians) * (cy - py) - cx;
        groupY += py + Math.sin(radians) * (cx - px) + Math.cos(radians) * (cy - py) - cy;
      }
      const sourceIds = (children[0].sourceIds || []).filter(id => children.every(child => child.sourceIds?.includes(id)));
      return [{ id: genId(), sourceIds, name: 'HTML group', type: 'group', x: groupX, y: groupY, ...(rot ? { rot } : {}), w: right - x, h: bottom - y,
        ...(clip?.[1] === '1' ? { overflowX: 'clip' } : {}),
        ...(clip?.[2] === '1' ? { overflowY: 'clip' } : {}),
        ...(hoverStyle ? { hoverStyle } : {}),
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

// A compound SVG animates as one drawing rather than one effect per path.
export function retargetGroupedAnimations(page) {
  const replacements = new Map();
  function visit(shapes) {
    for (const group of shapes) {
      if (!group.children) continue;
      visit(group.children);
      if (!group.sourceIds?.some(id => /^html-reveal-\d+$/.test(id))) continue;
      const collect = children => children.forEach(child => { replacements.set(child.id, group.id); if (child.children) collect(child.children); });
      collect(group.children);
    }
  }
  visit(page.shapes);
  // Source IDs include ancestry: select the outermost group belonging to this
  // exact animated element, not an enclosing element with a different animation.
  const contains = (shape, id) => shape.id === id || shape.children?.some(child => contains(child, id));
  function sourceGroup(shapes, source, id) {
    for (const shape of shapes) {
      if (!contains(shape, id)) continue;
      if (shape.children && shape.sourceIds?.includes(source)) return shape;
      const nested = shape.children && sourceGroup(shape.children, source, id);
      if (nested) return nested;
    }
  }
  const remap = effects => {
    const seen = new Set();
    return (effects || []).filter(effect => {
      if (effect.sourceTarget) {
        const group = sourceGroup(page.shapes, effect.sourceTarget, effect.sh);
        if (group) effect.sh = group.id;
      } else if (replacements.has(effect.sh)) effect.sh = replacements.get(effect.sh);
      const signature = effect.nativeTiming ? JSON.stringify({
        sh: effect.sh, sourceTarget: effect.sourceTarget, row: effect.nativeTiming.rowXml, du: effect.du, dl: effect.dl,
        tr: effect.tr, rp: effect.rp, rv: effect.rv, trs: effect.trs,
      }) : JSON.stringify(effect);
      if (seen.has(signature)) return false;
      seen.add(signature); return true;
    });
  };
  if (page.timing) {
    page.timing.m = remap(page.timing.m);
    for (const group of page.timing.i || []) group.ef = remap(group.ef);
  }
}
