// Infer paragraph blocks before native SVG compilation. Aligned rows within
// each column may be interleaved in SVG order; stable object IDs,
// explicit metadata and separate SVG groups retain their authored boundaries.
const tag = node => Object.keys(node).find(key => key !== ':@');
const attrs = node => node[':@'] || {};
const kids = node => node[tag(node)] || [];
const content = node => tag(node) === '#text' ? String(node['#text']) : kids(node).map(content).join('');
const discreteLabel = node => /^\s*\d{1,4}(?:[./–-]\d{1,4})?\s*$/.test(content(node));
const length = value => /^[-+]?(?:\d+\.?\d*|\.\d+)(?:px)?$/.test(String(value)) ? parseFloat(value) : NaN;
const signature = a => JSON.stringify(Object.entries(a).filter(([key]) => !['x', 'y', 'dx', 'dy'].includes(key)).sort(([a], [b]) => a.localeCompare(b)));
const positioned = node => kids(node).some(child => tag(child) === 'tspan' &&
  (['x', 'y', 'dx', 'dy', 'rotate', 'transform'].some(key => key in attrs(child)) || positioned(child)));
const protectedText = a => Object.keys(a).some(key => ['id', 'transform', 'rotate', 'textLength', 'lengthAdjust'].includes(key) || key.startsWith('data-'));
const gapFor = (rows, fontSize) => {
  if (rows.length < 2 || !Number.isFinite(fontSize)) return;
  const gaps = rows.slice(1).map((row, i) => row.y - rows[i].y);
  if (gaps.some(gap => gap < fontSize * 0.9 || gap > fontSize * 3)) return;
  if (rows.some(row => !Number.isFinite(row.x) || !Number.isFinite(row.y) ||
    Math.abs(row.x - rows[0].x) > 0.1)) return;
  // Looser bullet lists and paragraph spacing still belong to one text block.
  return Math.min(...gaps);
};

function inferSpans(node, inherited) {
  const a = attrs(node);
  if (tag(node) !== 'text' || protectedText(a) || a.style || inherited.style ||
    !['start', 'middle', 'end', undefined].includes(a['text-anchor'] ?? inherited['text-anchor'])) return;
  const spans = kids(node).filter(child => !(tag(child) === '#text' && !String(child['#text']).trim()));
  if (spans.length < 2 || spans.some(child => tag(child) !== 'tspan' || positioned(child))) return;
  let y = length(a.y ?? 0);
  const rows = [];
  for (const span of spans) {
    const sa = attrs(span);
    // An explicit x reset distinguishes stacked rows from inline styled runs.
    if (sa.x === undefined || protectedText(sa) || sa.rotate !== undefined ||
      (sa.dx !== undefined && length(sa.dx) !== 0) ||
      (sa['font-size'] !== undefined && length(sa['font-size']) !== length(a['font-size'] ?? inherited['font-size'] ?? 24))) return;
    y = (sa.y === undefined ? y : length(sa.y)) + length(sa.dy ?? 0);
    rows.push({ x: length(sa.x), y });
  }
  const gap = gapFor(rows, length(a['font-size'] ?? inherited['font-size'] ?? 24));
  if (gap) {
    node[':@'] = { ...a, 'data-paragraph-line-height': String(gap) };
    spans.forEach((span, index) => {
      const extra = index ? rows[index].y - rows[index - 1].y - gap : 0;
      if (extra > 0.1) span[':@'] = { ...attrs(span), 'data-paragraph-space-before': String(extra) };
    });
  }
}

export function groupSVGParagraphs(node, inherited = {}, depth = 0) {
  if (depth > 32 || attrs(node)['data-pptx-replace-with']) return node;
  const style = { ...inherited, ...attrs(node) };
  if (tag(node) === 'text') { inferSpans(node, inherited); return node; }
  // Do not rewrite fallback/native metadata, links, defs or clipping resources.
  if (!['svg', 'g'].includes(tag(node))) return node;
  const children = kids(node);
  const output = [], consumed = new Set();
  for (let i = 0; i < children.length; i++) {
    if (consumed.has(i)) continue;
    const first = children[i], a = attrs(first);
    if (tag(first) !== 'text' || discreteLabel(first) || protectedText(a) || positioned(first) || a.dx !== undefined || a.dy !== undefined ||
      a.style || style.style || !['start', 'middle', 'end', undefined].includes(a['text-anchor'] ?? style['text-anchor'])) {
      output.push(groupSVGParagraphs(first, style, depth + 1)); continue;
    }
    const rows = [{ x: length(a.x ?? 0), y: length(a.y ?? 0) }], lines = [first];
    const fontSize = length(a['font-size'] ?? style['font-size'] ?? 24);
    const indices = [];
    let gap;
    for (let j = i + 1; j < children.length; j++) {
      const next = children[j];
      if (tag(next) === '#text' && !String(next['#text']).trim()) continue;
      const b = attrs(next);
      if (tag(next) !== 'text') break;
      const nextX = length(b.x ?? 0);
      // SVG generators often emit rows across columns (A1, B1, A2, B2).
      // Look past a clearly separate column, but never cross an intervening
      // object, link/group boundary, or a heading within this column.
      if (Number.isFinite(nextX) && Math.abs(nextX - rows[0].x) >= fontSize * 3) continue;
      if (consumed.has(j) || discreteLabel(next) || protectedText(b) || positioned(next) || b.dx !== undefined || b.dy !== undefined || signature(a) !== signature(b)) break;
      const proposed = [...rows, { x: length(b.x ?? 0), y: length(b.y ?? 0) }];
      const nextGap = gapFor(proposed, fontSize);
      if (!nextGap) break;
      rows.push(proposed.at(-1)); lines.push(next); gap = nextGap; indices.push(j);
    }
    if (lines.length > 1) {
      output.push({ text: lines.map((line, index) => ({ tspan: kids(line), ':@': { x: String(rows[index].x), y: String(rows[index].y),
          ...(index && rows[index].y - rows[index - 1].y - gap > 0.1
            ? { 'data-paragraph-space-before': String(rows[index].y - rows[index - 1].y - gap) } : {}) } })),
        ':@': { ...a, 'data-paragraph-line-height': String(gap) } });
      for (const index of indices) consumed.add(index);
    } else output.push(groupSVGParagraphs(first, style, depth + 1));
  }
  node[tag(node)] = output;
  return node;
}
