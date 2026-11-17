import { shapeText } from './reformat-layouts.mjs';

// Keep overlapping artwork together, including text over cards and native groups.
function bounds(shape) {
  const { x, y, w, h } = shape;
  if (![x, y, w, h].every(Number.isFinite) || w < 0 || h < 0) return null;
  const angle = (Number(shape.rot) || 0) * Math.PI / 180;
  const width = Math.max(1, Math.abs(w * Math.cos(angle)) + Math.abs(h * Math.sin(angle)));
  const height = Math.max(1, Math.abs(w * Math.sin(angle)) + Math.abs(h * Math.cos(angle)));
  return { x: x + (w - width) / 2, y: y + (h - height) / 2, w: width, h: height };
}

function overlaps(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function union(a, b) {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

function scaleText(shape, ratio) {
  const scaleProps = value => {
    if (!value || typeof value !== 'object') return value;
    for (const key of Object.keys(value)) {
      if (['$_sz', '$_lIns', '$_rIns', '$_tIns', '$_bIns', '$_marL', '$_marR', '$_indent'].includes(key) &&
          Number.isFinite(Number(value[key]))) value[key] = Math.round(Number(value[key]) * ratio);
      else if (typeof value[key] === 'object') scaleProps(value[key]);
    }
    return value;
  };
  if (shape.txBody) scaleProps(shape.txBody);
  for (const child of shape.children || []) scaleText(child, ratio);
}

export function reflowObjects(shapes, { width, height, resize, preferRows = false }) {
  const objects = shapes.map(shape => ({ shape, box: bounds(shape) }));
  if (objects.some(({ box }) => !box)) return null;
  // Full-bleed shapes act as a backdrop. Keep them in their original draw order.
  const blocks = [];
  for (const entry of objects) {
    const { box, shape } = entry;
    if (objects.length > 1 && box.x <= width * .04 && box.y <= height * .04 && box.w >= width * .92 &&
        box.h >= height * .92 && !shapeText(shape) && !shape.graphic && !shape.children?.length) continue;
    const merged = { box, entries: [entry] };
    for (let i = blocks.length - 1; i >= 0; i--) {
      const block = blocks[i];
      if (!block.entries.some(item => overlaps(box, item.box))) continue;
      blocks.splice(i, 1);
      merged.box = union(merged.box, block.box);
      merged.entries.push(...block.entries);
    }
    blocks.push(merged);
  }
  if (!blocks.length) return null;
  blocks.sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x);

  const gap = Math.min(width, height) * .035;
  const gutter = gap * 1.65;
  const usableWidth = width - 2 * gutter, usableHeight = height - 2 * gutter;
  const candidates = [];
  for (let columns = 1; columns <= Math.min(4, blocks.length); columns++) {
    const rows = Math.ceil(blocks.length / columns);
    const w = (usableWidth - gap * (columns - 1)) / columns;
    const h = (usableHeight - gap * (rows - 1)) / rows;
    if (w <= 0 || h <= 0) continue;
    const ratios = blocks.map(({ box }) => Math.min(1, w / box.w, h / box.h));
    // Keep text and fine details legible when packing multiple independent objects.
    const score = Math.min(...ratios) * .65 + ratios.reduce((a, b) => a + b, 0) / ratios.length * .35;
    candidates.push({ columns, w, h, ratios, score: score + (preferRows && columns === 1 ? .05 : 0) });
  }
  const best = candidates.reduce((winner, entry) => !winner || entry.score > winner.score ? entry : winner, null);
  if (!best) return null;
  if (Math.min(...best.ratios) < .55 && blocks.length > 1) {
    // Dense compositions fit better as a single visual unit than as tiny cards.
    const box = blocks.map(block => block.box).reduce(union);
    const entries = blocks.flatMap(block => block.entries);
    blocks.splice(0, blocks.length, { box, entries });
    Object.assign(best, { columns: 1, w: usableWidth, h: usableHeight,
      ratios: [Math.min(1, usableWidth / box.w, usableHeight / box.h)] });
  }

  const transformed = new Map();
  blocks.forEach(({ box, entries }, index) => {
    const ratio = best.ratios[index];
    let x = gutter + (index % best.columns) * (best.w + gap) + (best.w - box.w * ratio) / 2;
    const y = gutter + Math.floor(index / best.columns) * (best.h + gap) + (best.h - box.h * ratio) / 2;
    if (blocks.length === 1 && ratio === 1 && Math.abs(x - box.x) < .5 && Math.abs(y - box.y) < .5 &&
        usableWidth - box.w > gap) x = gutter;
    for (const { shape } of entries) {
      const newX = x + (shape.x - box.x) * ratio, newY = y + (shape.y - box.y) * ratio;
      if (ratio === 1 && Math.abs(newX - shape.x) < .5 && Math.abs(newY - shape.y) < .5) continue;
      const next = ratio === 1 ? { ...shape } : resize(shape, shape.w * ratio, shape.h * ratio);
      if (ratio !== 1) scaleText(next, ratio);
      transformed.set(shape.id, { ...next, x: newX, y: newY, dirty: true });
    }
  });
  return transformed.size ? shapes.map(shape => transformed.get(shape.id) || shape) : null;
}
