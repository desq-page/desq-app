import { getRunText } from "shared-vuejs/api/lib-text-run-text";
import { wrapDeckText } from './deck-text.mjs';

export function fitGeneratedTextFrames(shapes, { width, containers = [], measureText } = {}) {
  return shapes.map(({ paragraphTextAnchor, ...shape }) => {
    if (shape.type !== 'text' || !shape.txBody) return shape;
    const bodyPr = { ...shape.txBody.bodyPr, $_wrap: 'square' };
    const result = { ...shape, autosize: true, txBody: { ...shape.txBody, bodyPr } };
    if (shape.rot || shape.flipH || shape.flipV || !shape.noFill || shape.pendingNative) return result;
    const runs = shape.txBody.p.flatMap(p => p.r || []);
    const font = Math.max(1, ...runs.map(run => (run.rPr?.$_sz || 1800) / 75));
    const anchor = paragraphTextAnchor || ({ ctr: 'middle', r: 'end' }[shape.txBody.p[0]?.pPr?.$_algn]) || 'start';
    const pad = shape.svgTextWidthPadding ?? font * .25;
    if (anchor !== 'start') {
      bodyPr.$_rIns = Math.round(pad * 9525);
      result.txBody.p = shape.txBody.p.map(p => ({ ...p, pPr: { ...p.pPr, $_algn: anchor === 'middle' ? 'ctr' : 'r' } }));
    }
    const anchorX = shape.x + (shape.w - pad) * (anchor === 'middle' ? .5 : anchor === 'end' ? 1 : 0);
    const baseline = shape.y + (shape.svgTextBaselineOffset || font);
    const panel = containers.filter(box => anchorX >= box.x && anchorX <= box.x + box.w &&
      baseline >= box.y && baseline < box.y + box.h && box.w > font * 3 && box.h > font)
      .sort((a, b) => a.w * a.h - b.w * b.h)[0];
    let available = Math.max(1, width - shape.x);
    let x = shape.x;
    if (panel) {
      if (anchor === 'middle') {
        available = 2 * Math.min(anchorX - panel.x, panel.x + panel.w - anchorX);
      } else if (anchor === 'end') {
        available = anchorX - panel.x + pad;
      } else {
        const leftInset = Math.max(0, shape.x - panel.x);
        // A textbox on the right is not an instruction to mirror its entire
        // offset as a right margin; that can yield zero or negative width.
        const inset = leftInset <= panel.w * .15 ? leftInset : font * .5;
        available = panel.x + panel.w - shape.x - inset;
      }
    }
    // Decorative rectangles or an anchor on a panel edge are not reliable
    // text bounds. Fall back to the slide rather than creating a 1px frame.
    if (available < Math.min(shape.w, font * 3)) {
      available = anchor === 'middle' ? 2 * Math.min(anchorX, width - anchorX)
        : anchor === 'end' ? anchorX + pad : width - shape.x;
    }
    const w = Math.max(1, Math.round(Math.min(shape.w, available) * 1e8) / 1e8);
    if (w >= shape.w - .1) return result;
    if (anchor === 'middle') x = anchorX - (w - pad) / 2;
    else if (anchor === 'end') x = anchorX - w + pad;
    let h = 0;
    for (const p of shape.txBody.p) {
      const size = Math.max(1, ...(p.r || []).map(run => (run.rPr?.$_sz || 1800) / 75));
      const value = (p.r || []).map(run => run.$_otag === 'br' ? '\n' : getRunText(run)).join('');
      const lineHeight = (p.pPr?.lnSpc?.spcPts?.$_val || 0) / 75 || size * 1.2;
      const contentWidth = Math.max(1, w - ((bodyPr.$_lIns || 0) + (bodyPr.$_rIns || 0)) / 9525);
      const lines = wrapDeckText(value, contentWidth, size * .75, p.r?.[0]?.rPr?.latin?.$_typeface || 'Arial', measureText);
      h += lines.length * lineHeight + (p.pPr?.spcBef?.spcPts?.$_val || 0) / 75 + (p.pPr?.spcAft?.spcPts?.$_val || 0) / 75;
    }
    return { ...result, x, w, h: Math.max(shape.h, h) };
  });
}
