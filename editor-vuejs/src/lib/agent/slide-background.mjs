import { editorColor } from './colors.mjs';
import { flattenShapeGroups } from './html-shape-groups.mjs';
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
    const namedShape = shape.name?.startsWith('!!') && !shape.name.startsWith('!!desq-inherited-backdrop-');
    if (namedShape || !covers || !rectangle(shape) || shape.txBody || shape.graphic || shape.children?.length || shape.imagePlaceholder || shape.pendingNative ||
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

export const pageImageCount = page => flattenShapeGroups(page.shapes).filter(shape => shape.type === 'image').length + (page.bg?.bgPr?.blipFill ? 1 : 0);

const usesInheritedBackground = slide => (/^<section\b[^>]*\sdata-desq-inherited-background="1"/.test(slide?.html || ''));

export function sharedSlideBackground(pages, slides) {
  const inherited = pages.filter((page, index) => usesInheritedBackground(slides[index]));
  const background = inherited[0]?.bg;
  if ((!background?.bgPr?.solidFill && !background?.bgPr?.gradFill) || pages.some(page => !page.bg)) return;
  const key = JSON.stringify(background);
  if (inherited.every(page => JSON.stringify(page.bg) === key)) return background;
}

function backdropShape({ width, height, genId }, fill, name, adjustment = 0) {
  const base = {id: genId(), name, type: 'custom', $_otag: 'sp', x: 0, y: 0, w: width, h: height,
    ...fill, ln: {noFill: true}};
  if (!adjustment) return {...base, d: `R0,0,${width},${height}`, prstGeom: {$_prst: 'rect', avLst: {}}};
  const r = Math.round(Math.min(width, height) * adjustment / 100) / 1000;
  const arc = `A${r},${r},0,0,1,`;
  const d = [
    `M${r},0H${width-r}`, arc + `${width},${r}`,
    `V${height-r}`, arc + `${width-r},${height}`,
    `H${r}`, arc + `0,${height-r}`,
    `V${r}`, arc + `${r},0Z`,
  ].join('');
  return {...base, d, prstGeom: {$_prst: 'roundRect', avLst: {gd: [{$_name: 'adj', $_fmla: 'val ' + adjustment}]}}};
}

export function inheritSharedSlideBackground(pages, slides, layout, options, capturedLayout) {
  const adjustment = /^<section\b[^>]*\sdata-desq-parent-background="(\d{1,5})"/.exec(capturedLayout?.html || '')?.[1];
  const backdrop = adjustment !== undefined && layout.shapes.filter(shape => shape.name?.startsWith('!!desq-parent-backdrop-'));
  if (backdrop?.length) {
    const native = {shapes: backdrop.map(shape => ({...shape, name: 'Parent background'}))};
    promoteSlideBackground(native, options);
    const inheritedFill = native.bg && JSON.stringify(native.bg);
    const {width, height} = options;
    // An opaque front layer already covers earlier backdrop layers.
    if (!native.shapes.length && native.bg) {
      const first = layout.shapes.indexOf(backdrop[0]);
      layout.shapes = layout.shapes.filter(shape => !backdrop.includes(shape));
      layout.shapes.splice(first, 0, backdropShape(options, native.bg.bgPr, 'Parent background', Number(adjustment)));
    } else {
      for (const shape of backdrop) {
        const index = layout.shapes.indexOf(shape);
        const exact = Math.abs(shape.x) < .01 && Math.abs(shape.y) < .01 &&
          Math.abs(shape.w - width) < .01 && Math.abs(shape.h - height) < .01;
        layout.shapes[index] = exact
          ? backdropShape(options, {...(shape.solidFill ? {solidFill:shape.solidFill} : {gradFill:shape.gradFill})}, 'Parent background', Number(adjustment))
          : {...shape, name:'Parent background'};
      }
    }
    // A layout shape sits in front of the native slide fill. Preserve that
    // slide's override by placing it at the bottom of the slide's shape stack.
    pages.forEach((page, index) => {
      page.showMaster = 1;
      if (usesInheritedBackground(slides[index]))
        page.shapes = page.shapes.filter(shape => !shape.name?.startsWith('!!desq-inherited-backdrop-'));
      if (!page.bg) return;
      if (!(usesInheritedBackground(slides[index]) && JSON.stringify(page.bg) === inheritedFill))
        page.shapes.unshift(backdropShape(options, page.bg.bgPr, 'Slide background'));
      delete page.bg;
    });
    // A fallback may have been supplied from the individual slide captures.
    if (JSON.stringify(layout.bg) === inheritedFill) delete layout.bg;
    const underlay = /^<section\b[^>]*\sdata-desq-background-underlay="([\da-f]{6})"/i.exec(capturedLayout.html)?.[1];
    if (underlay) layout.bg = {bgPr: {solidFill: editorColor(underlay)}};
    return;
  }

  if (!layout?.bg) return;
  const background = JSON.stringify(layout.bg);
  pages.forEach((page, index) => {
    if (usesInheritedBackground(slides[index]) && JSON.stringify(page.bg) === background) delete page.bg;
  });
}
