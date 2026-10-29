import { htmlToSVG } from './html-slides.mjs';
import { refineLocalHTML } from './local-html-quality.mjs';

const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const semantic = new Set('h1 h2 h3 h4 h5 h6 p ul ol table img svg'.split(' '));

// Geometry fallback only. Source markup still passes the converter's safety
// checks. Keep the text, emphasis, lists, tables, images and SVG diagrams; replace
// oversized CSS geometry with a bounded, host-owned layout in the shared palette.
export function reflowLocalHTML(html, { title, design, reservePhoto = false }) {
  let content, sourceTitle, fullText;
  const captured = {};
  try {
    htmlToSVG(html, { inspectLayout(page, doc) {
      const view = doc.defaultView;
      const heading = page.querySelector('h1') || page.querySelector('h2');
      sourceTitle = heading?.textContent.trim() || title;
      const blocks = [];
      const collect = parent => {
        let inline = [];
        const flush = () => {
          if (inline.some(node => node.textContent.trim())) {
            const p = doc.createElement('p'); inline.forEach(node => p.append(node.cloneNode(true))); blocks.push(p);
          }
          inline = [];
        };
        for (const child of parent.childNodes) {
          if (child === heading) { flush(); continue; }
          if (child.nodeType === 3) { inline.push(child); continue; }
          if (child.nodeType !== 1 || child.localName === 'style') continue;
          const cs = view.getComputedStyle(child);
          if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
          if (semantic.has(child.localName)) { flush(); blocks.push(child.cloneNode(true)); }
          else if (['inline', 'contents'].includes(cs.display) && !child.querySelector('h1,h2,h3,p,ul,ol,table,img,svg,div')) inline.push(child);
          else { flush(); collect(child); }
        }
        flush();
      };
      collect(page);
      blocks.forEach(block => block.querySelectorAll('style').forEach(style => style.remove()));
      const plainText = node => {
        if (node.nodeType === 3) return node.textContent;
        if (node.localName === 'br') return '\n';
        const body = [...node.childNodes].map(plainText).join('');
        return body + (['td','th'].includes(node.localName) ? '\t' : ['p','div','li','tr','h1','h2','h3','ul','ol','table'].includes(node.localName) ? '\n' : '');
      };
      fullText = [sourceTitle, ...blocks.map(block => plainText(block).trim()), ...[...page.querySelectorAll('img')].map(img => `Image: ${img.getAttribute('alt') || img.getAttribute('data-query') || ''}`)].filter(Boolean).join('\n\n');
      content = blocks.flatMap(block => {
        // Long lists can flow across host columns without losing bullets or
        // ordered numbering. Preserve each item's nested rich content intact.
        if (!['ul', 'ol'].includes(block.localName) || block.children.length <= 4) return [block];
        let number = Number(block.getAttribute('start')) || 1;
        return [...block.children].filter(item => item.localName === 'li').map(item => {
          if (item.hasAttribute('value')) number = Number(item.getAttribute('value'));
          const list = doc.createElement(block.localName);
          if (block.localName === 'ol') list.setAttribute('start', String(number));
          list.append(item.cloneNode(true)); number++;
          return list;
        });
      });
      // A long rich paragraph must be able to cross columns. Slice DOM ranges
      // at word boundaries so emphasis and every character survive the split.
      content = content.flatMap(block => {
        if (block.localName !== 'p' || block.textContent.length <= 240 || block.querySelector('img,svg,table')) return [block];
        const nodes = [], walker = doc.createTreeWalker(block, 4);
        while (walker.nextNode()) nodes.push(walker.currentNode);
        const at = offset => {
          for (const node of nodes) { if (offset <= node.length) return [node, offset]; offset -= node.length; }
          return [nodes.at(-1), nodes.at(-1).length];
        };
        const pieces = [], text = block.textContent;
        for (let start = 0; start < text.length;) {
          let end = Math.min(start + 240, text.length);
          if (end < text.length) {
            const space = text.lastIndexOf(' ', end);
            if (space > start + 100) end = space + 1;
            else if (/[\uD800-\uDBFF]/.test(text[end - 1])) end--;
          }
          const range = doc.createRange(); range.setStart(...at(start)); range.setEnd(...at(end));
          let fragment = range.cloneContents();
          let ancestor = range.commonAncestorContainer;
          if (ancestor.nodeType === 3) ancestor = ancestor.parentElement;
          while (ancestor && ancestor !== block) {
            const wrapper = ancestor.cloneNode(false); wrapper.append(fragment); fragment = wrapper; ancestor = ancestor.parentElement;
          }
          const part = block.cloneNode(false); part.append(fragment); pieces.push(part); start = end;
        }
        return pieces;
      });
      throw captured; // Extraction completes before geometry validation.
    } });
  } catch (error) { if (error !== captured) throw error; }
  if (!content?.length) throw Error('Cannot reflow an empty slide.');
  const render = (node, size, width) => {
    const clone = node.cloneNode(true);
    // Freeze text structure, not CSS sizes/positioning from the failed layout.
    for (const el of [clone, ...clone.querySelectorAll('*')]) {
      if (el.namespaceURI === 'http://www.w3.org/2000/svg') continue;
      for (const attr of [...el.attributes]) {
        if (!['data-query', 'alt', 'colspan', 'rowspan', 'start', 'value'].includes(attr.name)) el.removeAttribute(attr.name);
      }
    }
    for (const el of [clone, ...clone.querySelectorAll('*')]) {
      if (el.localName === 'svg') {
        const vb = (el.getAttribute('viewBox') || '').trim().split(/[ ,]+/).map(Number);
        if (vb.length !== 4 || !vb.every(Number.isFinite) || vb[2] <= 0 || vb[3] <= 0) throw Error('Cannot preserve SVG without a valid viewBox during reflow.');
        el.setAttribute('style', `display:block;position:static;width:${width}px;height:${Math.min(280, width * vb[3] / vb[2])}px;margin:0 0 12px`);
      } else if (el.namespaceURI === 'http://www.w3.org/2000/svg') continue;
      else if (el.localName === 'img') el.setAttribute('style', `display:block;position:static;width:${width}px;height:180px;object-fit:cover;margin:0 0 12px`);
      else if (/^h[1-6]$/.test(el.localName)) el.setAttribute('style', `font-size:${size + 2}px;font-weight:700;line-height:1.2;color:${design.accent};margin:0 0 10px`);
      else if (['ul', 'ol'].includes(el.localName)) el.setAttribute('style', 'padding:0 0 0 26px;margin:0 0 12px');
      else if (el.localName === 'li') el.setAttribute('style', 'margin:0 0 8px');
      else if (el.localName === 'table') el.setAttribute('style', 'width:100%;table-layout:fixed;border-collapse:collapse;margin:0 0 12px');
      else if (['td', 'th'].includes(el.localName)) el.setAttribute('style', `padding:8px;border:1px solid ${design.accent};overflow-wrap:anywhere`);
      else if (el === clone) el.setAttribute('style', 'margin:0 0 12px;overflow-wrap:anywhere');
    }
    return clone.outerHTML;
  };
  const reservedPhoto = reservePhoto ? content.find(node=>node.localName === 'img') : undefined;
  if (reservedPhoto) content = content.filter(node=>node !== reservedPhoto);
  const photoHTML = reservedPhoto ? `<div style="position:absolute;left:752px;top:176px;width:472px;height:360px">${render(reservedPhoto,24,472).replace('height:180px','height:360px')}</div>` : '';
  let lastError;
  for (const size of [24, 22, 20]) for (const columns of (reservedPhoto ? [1] : [1, 2, 3])) {
    try {
    const contentWidth = reservedPhoto ? 648 : 1168;
    const width = (contentWidth - (columns - 1) * 28) / columns;
    const groups = Array.from({length:columns}, () => []);
    groups[0] = content.map(node => render(node, size, width));
    const candidate = `<section style="position:relative;width:1280px;height:720px;overflow:hidden;background:${design.background};color:${design.foreground};font-family:Arial"><h1 style="position:absolute;left:56px;top:40px;width:1168px;font-size:40px;line-height:1.15;margin:0">${escape(sourceTitle)}</h1><div style="position:absolute;left:56px;top:166px;width:${contentWidth}px;display:flex;align-items:flex-start;gap:28px;font-size:${size}px;line-height:1.25">${groups.map(group => `<div data-reflow-column style="width:${width}px;flex:none;min-width:0">${group.join('')}</div>`).join('')}</div>${photoHTML}</section>`;
      const result = refineLocalHTML(candidate, { prepareLayout(page) {
        const cols = [...page.querySelectorAll('[data-reflow-column]')];
        const units = cols.flatMap(col => [...col.children]);
        cols.forEach(col => col.replaceChildren());
        let index = 0;
        for (const unit of units) {
          cols[index].append(unit);
          if (cols[index].scrollHeight > 500 && cols[index].children.length > 1 && index < cols.length - 1) cols[++index].append(unit);
        }
      } });
      if (result.issues.length) throw Error(result.issues.join(' '));
      return { ...result, adjustments: [`Reflowed oversized HTML into ${columns} editable content column${columns === 1 ? '' : 's'} at ${size}px; original text and media retained.`, ...result.adjustments] };
    } catch (error) { lastError = error; }
  }
  // Preserve an overfull page's source, and show a clearly labelled extract
  // rather than losing the entire deck. No new claims or extra slides are added.
  const points = content.flatMap(node => node.textContent.trim().split(/(?<=[.!?。！？])\s+|\n+/)).filter(Boolean);
  for (const budget of [600, 360, 180]) {
    let remaining = budget;
    const selected = [];
    for (const point of points) {
      if (remaining <= 0 || selected.length >= 5) break;
      let take = point.slice(0, remaining);
      if (take.length < point.length) {
        const boundary = take.lastIndexOf(' ');
        if (boundary > 40) take = take.slice(0, boundary);
        take = take.replace(/[\uD800-\uDBFF]$/, '') + '…';
      }
      selected.push(`<p style="margin:0 0 16px">${escape(take)}</p>`); remaining -= take.length;
    }
    const shortTitle = sourceTitle.length > 54 ? sourceTitle.slice(0, 51).replace(/[\uD800-\uDBFF]$/, '') + '…' : sourceTitle;
    const candidate = `<section style="position:relative;width:1280px;height:720px;background:${design.background};color:${design.foreground};font-family:Arial;overflow:hidden"><h1 style="position:absolute;left:56px;top:40px;width:1168px;font-size:40px;line-height:1.15">${escape(shortTitle)}</h1><div style="position:absolute;left:56px;top:174px;width:${reservedPhoto ? 648 : 1168}px;font-size:24px;line-height:1.25">${selected.join('')}</div>${photoHTML}<p style="position:absolute;left:56px;top:650px;width:1168px;font-size:20px;color:${design.foreground}">Content excerpt — full generated content is saved with this slide.</p></section>`;
    try {
      const result = refineLocalHTML(candidate);
      if (result.issues.length) throw Error(result.issues.join(' '));
      return { ...result, overflowContent: { text: fullText, html },
        adjustments: ['Used a labelled content excerpt; full generated content retained with the slide.', ...result.adjustments] };
    } catch (error) { lastError = error; }
  }
  throw Error(`Cannot construct a readable content excerpt. ${lastError?.message || ''}`);
}
