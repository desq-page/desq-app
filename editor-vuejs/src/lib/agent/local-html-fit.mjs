// Recover modest vertical overflow by reclaiming whitespace, not clipping text or
// shrinking fonts. Every trial is checked again by the normal HTML converter.
export function fitLocalHTML(page, doc) {
  const view = doc.defaultView, adjustments = [];
  const overflowing = () => page.scrollHeight > page.clientHeight + 1;
  if (!overflowing() || page.scrollHeight > 900 || page.scrollWidth > page.clientWidth + 1) return adjustments;
  const initial = page.scrollHeight;
  const elements = [page, ...page.querySelectorAll('*')].filter(el =>
    el.namespaceURI === 'http://www.w3.org/1999/xhtml' && !['style', 'img'].includes(el.localName));
  // Snapshot spacing before modifying it; avoid compounding computed styles.
  const spacing = elements.map(el => {
    const cs = view.getComputedStyle(el);
    return { el, values: Object.fromEntries(['padding-top', 'padding-bottom', 'margin-top', 'margin-bottom', 'row-gap'].map(key => [key, parseFloat(cs.getPropertyValue(key)) || 0])) };
  });
  for (const fraction of [.75, .5, .25]) {
    if (!overflowing()) break;
    for (const { el, values } of spacing) for (const [key, value] of Object.entries(values)) {
      const floor = key.startsWith('padding') ? (el === page ? 24 : 12) : key === 'row-gap' ? 12 : 0;
      if (value > floor) el.style.setProperty(key, `${Math.max(floor, value * fraction)}px`, 'important');
    }
  }
  // Oversized fixed containers often have generous empty space. Trial a smaller
  // height only when all descendant boxes and text remain inside it afterwards.
  if (overflowing()) for (const el of elements.slice(1)) {
    const cs = view.getComputedStyle(el), r = el.getBoundingClientRect();
    if (cs.position !== 'absolute' || cs.transform !== 'none' || r.bottom <= 720 || r.top < 120 || !el.children.length) continue;
    const height = 696 - r.top;
    if (height < 120 || height >= r.height) continue;
    const prior = el.getAttribute('style');
    el.style.setProperty('height', `${height}px`, 'important');
    const box = el.getBoundingClientRect();
    const descendants = [...el.querySelectorAll('*')].filter(child => child.localName !== 'style');
    const walker = doc.createTreeWalker(el, 4), textRects = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.textContent.trim() || node.parentElement.closest('style,svg')) continue;
      const range = doc.createRange(); range.selectNodeContents(node);
      textRects.push(...range.getClientRects());
    }
    if (el.scrollHeight > el.clientHeight + 1 || descendants.some(child => child.getBoundingClientRect().bottom > box.bottom + 1) || textRects.some(rect => rect.bottom > box.bottom + 1)) {
      if (prior === null) el.removeAttribute('style'); else el.setAttribute('style', prior);
    }
  }
  if (page.scrollHeight < initial) adjustments.push(`Reduced vertical whitespace to fit the slide (${initial}px → ${page.scrollHeight}px); font sizes preserved.`);
  return adjustments;
}
