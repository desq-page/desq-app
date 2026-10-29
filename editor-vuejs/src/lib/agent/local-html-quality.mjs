import { fitLocalHTML } from './local-html-fit.mjs';
import { htmlToSVG } from './html-slides.mjs';
import { contrastRatio, legibleInk } from './deck-design.mjs';

const colorHex = value => {
  const values = value.match(/^rgba?\(([^)]+)\)$/)?.[1]?.split(/[,\s/]+/).map(Number);
  if (!values || values.length < 3 || (values.length === 4 && values[3] < .99)) return null;
  return '#' + values.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
};
const intersection = (a, b) => ({ w: Math.min(a.right, b.right) - Math.max(a.left, b.left), h: Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) });

// Runs inside the converter's existing network-disabled, isolated layout frame.
// Fix only small independent text movements and solid-color contrast. Complex
// geometry is reported to the model instead of guessing at the intended design.
export function refineLocalHTML(html, { prepareLayout } = {}) {
  let result;
  htmlToSVG(html, { prepareLayout(page, doc) {
    prepareLayout?.(page, doc);
    const view = doc.defaultView, issues = [], adjustments = fitLocalHTML(page, doc);
    const groups = new Map();
    const walker = doc.createTreeWalker(page, 4);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.textContent.trim() || node.parentElement.closest('style,svg')) continue;
      const range = doc.createRange(); range.selectNodeContents(node);
      if (!range.getBoundingClientRect().width) continue;
      let owner = node.parentElement;
      while (owner !== page && ['inline', 'contents'].includes(view.getComputedStyle(owner).display)) owner = owner.parentElement;
      if (!groups.has(owner)) groups.set(owner, []);
      groups.get(owner).push(node);
    }
    const boxes = () => [...groups].map(([el, nodes]) => {
      const rects = nodes.flatMap(node => { const r = doc.createRange(); r.selectNodeContents(node); return [...r.getClientRects()].filter(r => r.width && r.height); });
      return { el, nodes, rects, label: el.textContent.trim().replace(/\s+/g, ' ').slice(0, 65),
        box: { left: Math.min(...rects.map(r => r.left)), top: Math.min(...rects.map(r => r.top)), right: Math.max(...rects.map(r => r.right)), bottom: Math.max(...rects.map(r => r.bottom)) } };
    }).filter(item => item.rects.length);
    const text = boxes();
    const backgrounds = [...page.querySelectorAll('*'), page].filter(el => colorHex(view.getComputedStyle(el).backgroundColor));
    for (const item of text) {
      for (const node of item.nodes) {
        const el = node.parentElement, cs = view.getComputedStyle(el), size = parseFloat(cs.fontSize);
        const footnote = item.box.top > 640 && item.label.length < 65;
        if (size < (footnote ? 14 : 20)) issues.push(`Text is too small (${Math.round(size)}px): "${item.label}". Shorten or rearrange; use at least 20px.`);
        // Prefer the last containing background painted before this text.
        const panel = backgrounds.filter(bg => {
          if (bg !== el && !bg.contains(el) && !(bg.compareDocumentPosition(el) & 4)) return false;
          const r = bg.getBoundingClientRect();
          return r.left <= item.box.left && r.top <= item.box.top && r.right >= item.box.right && r.bottom >= item.box.bottom;
        }).sort((a, b) => a === page ? -1 : b === page ? 1 : a.compareDocumentPosition(b) & 4 ? -1 : 1).at(-1);
        const bg = panel && colorHex(view.getComputedStyle(panel).backgroundColor), ink = colorHex(cs.color);
        if (bg && ink && contrastRatio(bg, ink) < 3) {
          el.style.setProperty('color', legibleInk(bg), 'important');
          adjustments.push(`Improved solid-background text contrast: "${item.label}".`);
        }
      }
    }
    if (!text.some(item => item.box.top < 200 && item.nodes.some(node => parseFloat(view.getComputedStyle(node.parentElement).fontSize) >= 36))) {
      issues.push('Add a clear content-specific title at the top, at least 36px, separated from body content.');
    }
    let current = boxes();
    for (let i = 0; i < current.length; i++) for (let j = i + 1; j < current.length; j++) {
      let a = current[i], b = current[j];
      const overlaps = () => a.rects.some(x => b.rects.some(y => { const r = intersection(x, y); return r.w > 3 && r.h > 3; }));
      if (!overlaps()) continue;
      const lower = a.box.top > b.box.top ? a : b, upper = lower === a ? b : a;
      const delta = Math.ceil(upper.box.bottom - lower.box.top + 12);
      const cs = view.getComputedStyle(lower.el), parent = lower.el.parentElement.getBoundingClientRect(), elementBox = lower.el.getBoundingClientRect();
      // Only move text-only absolute boxes slightly, preserving font size and
      // the enclosing panel. Never move diagram groups or anchored images.
      if (cs.position === 'absolute' && cs.transform === 'none' &&
          cs.backgroundColor === 'rgba(0, 0, 0, 0)' && cs.backgroundImage === 'none' &&
          cs.boxShadow === 'none' && ['borderTopWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderRightWidth'].every(key => parseFloat(cs[key]) === 0) &&
          elementBox.bottom + delta <= parent.bottom && Number.isFinite(parseFloat(cs.top)) && delta > 0 && delta <= 28 &&
          lower.box.bottom + delta <= Math.min(672, parent.bottom) &&
          !lower.el.querySelector('img,svg,div,section') &&
          current.every(other => other === lower || other === upper || !other.rects.some(r => lower.rects.some(t => { const hit = intersection({ ...t.toJSON(), top: t.top + delta, bottom: t.bottom + delta }, r); return hit.w > 3 && hit.h > 3; })))) {
        lower.el.style.setProperty('top', `${parseFloat(cs.top) + delta}px`, 'important');
        adjustments.push(`Added spacing between "${upper.label}" and "${lower.label}".`);
        current = boxes(); a = current[i]; b = current[j];
      }
      if (overlaps()) issues.push(`Text collision between "${a.label}" and "${b.label}". Separate their text boxes; preserve readable type.`);
    }
    result = { html: page.outerHTML, issues: [...new Set(issues)].slice(0, 8), adjustments: [...new Set(adjustments)] };
  } });
  return result;
}
