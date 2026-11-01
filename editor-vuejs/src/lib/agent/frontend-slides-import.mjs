// Keep ordinary self-contained CSS rules when a stylesheet also has @media,
// @font-face or other at-rules. Drop unsafe rules before browser layout.
export function safeStylesheet(source) {
  const css = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  let start = 0, depth = 0, quote = '', escaped = false, open = -1;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === quote) quote = '';
      continue;
    }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === '{') { if (depth++ === 0) open = i; }
    else if (c === '}' && depth > 0 && --depth === 0) {
      const header = css.slice(start, open).trim();
      const body = css.slice(open + 1, i);
      // Any unhandled at-rule, nested rule or resource-bearing declaration is omitted.
      if (header && !header.includes('@') && !/[{}@]/.test(body) &&
          !/url\s*\(|expression\s*\(|image-set\s*\(|-moz-binding|behavior\s*:/i.test(body))
        rules.push(header + '{' + body + '}');
      start = i + 1;
    } else if (c === ';' && depth === 0) start = i + 1;
  }
  return rules.join('\n');
}

// Extract model-authored slide documents without executing scripts or loading resources.
export function parseFrontendSlides(input, document = globalThis.document) {
  if (!document?.createElement) throw Error('HTML import requires the editor browser.');
  if (typeof input !== 'string' || input.length > 1700000) throw Error('HTML must be under 1,700,000 characters.');
  const source = input.trim().replace(/^```(?:html)?\s*/i, '').replace(/\s*```$/, '');
  const template = document.createElement('template');
  template.innerHTML = source;
  const fragment = template.content;
  const candidates = [...fragment.querySelectorAll('.slide-container, .slide')];
  const slides = candidates.filter(node => !candidates.some(other => other !== node && other.contains(node)));
  if (!slides.length) throw Error('No slides found. Expected elements with class slide or slide-container.');
  if (slides.length > 20) throw Error('HTML import supports at most 20 slides.');
  // Retain only self-contained style blocks. Imported markup is never mounted until
  // the existing strict HTML validator has checked every element and declaration.
  const styles = [...fragment.querySelectorAll('style')].map(el => safeStylesheet(el.textContent)).join('\n');
  const title = fragment.querySelector('title')?.textContent?.trim() || slides[0].querySelector('h1,h2,h3')?.textContent?.trim() || 'Imported presentation';
  return {title: title.slice(0,160), audience:'Audience', objective:'Present the imported slides', design:{palette:'graphite'}, slides: slides.map((original,index) => {
    const stage = original.classList.contains('slide-container') ? 1280 : 1920;
    const section = document.createElement('section');
    for (const attr of original.attributes) if (!/^on/i.test(attr.name) && !['contenteditable','style'].includes(attr.name.toLowerCase())) section.setAttribute(attr.name, attr.value);
    section.innerHTML = original.innerHTML;
    section.classList.add('active', 'visible');
    section.setAttribute('data-desq-stage-width', String(stage));
    section.setAttribute('data-desq-imported', '1');
    section.setAttribute('style', `${original.getAttribute('style') || ''};position:relative!important;inset:auto!important;left:0!important;top:0!important;width:${stage}px!important;height:${stage * 9 / 16}px!important;margin:0!important;box-sizing:border-box!important;transform:none!important;visibility:visible!important;opacity:1!important;`);
    section.querySelectorAll('script,iframe,object,embed,link,style,video,audio,canvas').forEach(el => el.remove());
    for (const el of section.querySelectorAll('*')) {
      for (const attr of [...el.attributes]) if (/^on/i.test(attr.name) || ['contenteditable','href','xlink:href','srcset'].includes(attr.name.toLowerCase())) el.removeAttribute(attr.name);
      if (el.localName === 'a') el.replaceWith(...el.childNodes);
    }
    const sheet = document.createElement('style');
    sheet.textContent = styles;
    section.prepend(sheet);
    const heading = original.querySelector('h1,h2,h3')?.textContent?.trim() || `Slide ${index + 1}`;
    return {title:heading.slice(0,120), purpose:'Present the imported content', layout:'html', html:section.outerHTML};
  })};
}
