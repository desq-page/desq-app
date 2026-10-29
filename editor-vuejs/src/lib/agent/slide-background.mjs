import { SVGPathData } from 'svg-pathdata';

const opaque = color => color?.uniClr && (color.uniClr.alpha?.$_val ?? 100000) === 100000;
function rectangle(shape) {
  if (shape.type === 'image' && !shape.d && !shape.prstGeom) return true;
  if (shape.prstGeom) return shape.prstGeom.$_prst === 'rect';
  if (!shape.d) return ['rectangle', 'rect'].includes(shape.type);
  if (shape.d.startsWith('R')) return true;
  try {
    const commands = new SVGPathData(shape.d).toAbs().normalizeHVZ(false).commands;
    if (commands.some(command => ![SVGPathData.MOVE_TO, SVGPathData.LINE_TO, SVGPathData.CLOSE_PATH].includes(command.type))) return false;
    if (commands.filter(command => command.type === SVGPathData.MOVE_TO).length !== 1) return false;
    const points = commands.filter(command => command.x !== undefined).map(command => [command.x, command.y]);
    if (points.length < 4 || points.length > 5) return false;
    const epsilon = .01;
    if (points.some(([x, y]) => Math.min(Math.abs(x), Math.abs(x - shape.w)) > epsilon || Math.min(Math.abs(y), Math.abs(y - shape.h)) > epsilon)) return false;
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const [x, y] = points[i], [nx, ny] = points[(i + 1) % points.length];
      if (Math.abs(x - nx) > epsilon && Math.abs(y - ny) > epsilon) return false;
      area += x * ny - nx * y;
    }
    return Math.abs(Math.abs(area) / 2 - shape.w * shape.h) < Math.max(1, shape.w * shape.h * 1e-6);
  } catch { return false; }
}

export function promoteSlideBackground(page, { width, height }) {
  const targets = new Set();
  const collect = value => {
    if (typeof value === 'string') targets.add(value);
    else if (value && typeof value === 'object') for (const child of Object.values(value)) collect(child);
  };
  collect(page.timing);
  // Only consume the leading backdrop layers. Never move a later foreground
  // panel behind existing content or remove an interactive/animated object.
  while (page.shapes.length) {
    const shape = page.shapes[0], epsilon = .01;
    const covers = shape.x <= epsilon && shape.y <= epsilon && shape.x + shape.w >= width - epsilon && shape.y + shape.h >= height - epsilon;
    const exact = Math.abs(shape.x) < epsilon && Math.abs(shape.y) < epsilon && Math.abs(shape.w - width) < epsilon && Math.abs(shape.h - height) < epsilon;
    if (shape.name?.startsWith('!!') || !covers || !rectangle(shape) || shape.txBody || shape.graphic || shape.children?.length || shape.imagePlaceholder || shape.pendingNative ||
      shape.link || shape.style || shape.effectLst || shape.rot || shape.flipH || shape.flipV || targets.has(shape.id) ||
      (shape.ln && !shape.ln.noFill && (shape.ln.solidFill || shape.ln.gradFill || shape.ln.pattFill))) break;
    let fill;
    if (shape.type === 'image' && shape.blipFill?.blip?.$_target) {
      fill = { blipFill: structuredClone(shape.blipFill) };
      const original = fill.blipFill.srcRect || {};
      const l = (original.$_l || 0) / 100000, r = (original.$_r || 0) / 100000;
      const t = (original.$_t || 0) / 100000, b = (original.$_b || 0) / 100000;
      if (!exact) fill.blipFill.srcRect = {
        $_l: Math.round((l + (1 - l - r) * -shape.x / shape.w) * 100000),
        $_r: Math.round((r + (1 - l - r) * (shape.x + shape.w - width) / shape.w) * 100000),
        $_t: Math.round((t + (1 - t - b) * -shape.y / shape.h) * 100000),
        $_b: Math.round((b + (1 - t - b) * (shape.y + shape.h - height) / shape.h) * 100000),
      };
      fill.blipFill.stretch = { fillRect: {} };
    } else if (opaque(shape.solidFill)) fill = { solidFill: structuredClone(shape.solidFill) };
    else if (exact && shape.gradFill?.gsLst?.gs?.length && shape.gradFill.gsLst.gs.every(opaque)) fill = { gradFill: structuredClone(shape.gradFill) };
    else break;
    page.bg = { bgPr: fill };
    if (shape.imageSource) page.agentMetadata = { ...page.agentMetadata, backgroundImageSource: structuredClone(shape.imageSource) };
    else if (page.agentMetadata) delete page.agentMetadata.backgroundImageSource;
    page.shapes.shift();
  }
  return page;
}

export const pageImageCount = page => page.shapes.filter(shape => shape.type === 'image').length + (page.bg?.bgPr?.blipFill ? 1 : 0);
