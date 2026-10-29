import { getRunText } from "shared-vuejs/api/lib-text-run-text";
import { textBaseline } from './ppt-master-text.mjs';
const textOf = shape => shape.txBody.p[0].r.map(run => getRunText(run)).join('');
const signature = shape => JSON.stringify({
  anchor: shape.paragraphTextAnchor, body: shape.txBody.bodyPr, paragraph: shape.txBody.p[0].pPr,
  runs: shape.txBody.p[0].r.map(run => run.rPr),
  sourceIds: shape.sourceIds, effects: shape.effectLst,
});
const eligible = shape => shape.type === 'text' && !shape.paragraphInferenceBlocked &&
  !shape.rot && !shape.flipH && !shape.flipV && shape.noFill &&
  shape.txBody?.p?.length === 1 && shape.txBody.p[0].pPr?.$_algn === 'l' &&
  shape.txBody.p[0].r.every(run => typeof run.t === 'string' && !run.rPr?.hlinkClick) &&
  Number.isFinite(shape.svgTextBaselineOffset) && !!textOf(shape).trim() &&
  !/^\s*\d{1,4}(?:[./–-]\d{1,4})?\s*$/.test(textOf(shape));
const fontSize = shape => Math.max(...shape.txBody.p[0].r.map(run => (run.rPr?.$_sz || 1800) / 75));
const anchorX = shape => shape.x + (shape.w - (shape.svgTextWidthPadding ?? fontSize(shape) * .25)) *
  (shape.paragraphTextAnchor === 'middle' ? .5 : shape.paragraphTextAnchor === 'end' ? 1 : 0);
const baseline = shape => shape.y + shape.svgTextBaselineOffset;

// SVG attribute equality is insufficient: inherited attributes, inline CSS and
// harmless wrapper groups can compile to identical native text. Merge a related
// run of adjacent body lines using the resolved formatting and baseline geometry.
export function mergeNativeParagraphs(shapes, language) {
  const output = [];
  for (let i = 0; i < shapes.length; i++) {
    const first = shapes[i], lines = [first];
    if (eligible(first) && textOf(first).trim().length >= 10) {
      while (i + 1 < shapes.length) {
        const next = shapes[i + 1], previous = lines.at(-1);
        const gap = baseline(next) - baseline(previous);
        if (!eligible(next) || signature(next) !== signature(first) ||
          Math.abs(anchorX(next) - anchorX(first)) > .1 || !Number.isFinite(gap) ||
          gap < fontSize(first) * .9 || gap > fontSize(first) * 3) break;
        lines.push(next); i++;
      }
    }
    if (lines.length === 1) { output.push(first); continue; }
    const gaps = lines.slice(1).map((line, index) => baseline(line) - baseline(lines[index]));
    const spacing = Math.min(...gaps);
    const offset = textBaseline(first.txBody.p[0].r.map(run => ({
      text: run.t, font_size: (run.rPr?.$_sz || 1800) / 75,
      font_family: run.rPr?.latin?.$_typeface,
      font_weight: run.rPr?.$_b ? 'bold' : 'normal', font_style: run.rPr?.$_i ? 'italic' : 'normal',
    })), { lineSpacingPx: spacing, language });
    const y = baseline(first) - offset;
    const widest = lines.reduce((a, b) => a.w > b.w ? a : b);
    const w = widest.w, pad = widest.svgTextWidthPadding ?? fontSize(first) * .25;
    const alignment = first.paragraphTextAnchor === 'middle' ? 'ctr' : first.paragraphTextAnchor === 'end' ? 'r' : 'l';
    const x = anchorX(first) - (w - pad) * (alignment === 'ctr' ? .5 : alignment === 'r' ? 1 : 0);
    output.push({ ...first, x, y, w,
      h: Math.max(...lines.map(line => line.y + line.h)) - y,
      svgTextBaselineOffset: offset,
      svgTextWidthPadding: pad,
      txBody: { ...first.txBody, bodyPr: { ...first.txBody.bodyPr, ...(alignment !== 'l' ? { $_rIns: Math.round(pad * 9525) } : {}) }, p: lines.map((line, index) => ({ ...line.txBody.p[0],
        pPr: { ...line.txBody.p[0].pPr, $_algn: alignment,
          lnSpc: { spcPts: { $_val: Math.round(spacing * 75) } },
          ...(index && gaps[index - 1] - spacing > .1
            ? { spcBef: { spcPts: { $_val: Math.round((gaps[index - 1] - spacing) * 75) } } } : {}),
        },
      })) },
    });
  }
  // Inference flags are compilation bookkeeping, not stored slide content.
  return output.map(({ paragraphInferenceBlocked, ...shape }) => shape);
}
