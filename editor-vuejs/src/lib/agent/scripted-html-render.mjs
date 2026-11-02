import { parseSlideHTML } from './html-slides.mjs';
import { materializeFontAwesomeIcons } from './fontawesome-vectors.mjs';

// This function is serialized into an opaque-origin iframe. Its output is
// untrusted: the parent revalidates it before any slide is compiled.
async function snapshotSlides(token, width, count) {
  try {
    await Promise.race([document.fonts?.ready || Promise.resolve(), new Promise(r => setTimeout(r, 4000))]);
    await new Promise(r => setTimeout(r, 500));
    const candidates = [...document.querySelectorAll('.slide-container, .slide')];
    const slides = candidates.filter(node => !candidates.some(other => other !== node && node.contains(other)));
    if (slides.length !== count) throw Error('The rendered slide count changed.');
    const properties = ['display','position','box-sizing','width','height','min-width','min-height','max-width','max-height',
      'top','right','bottom','left','margin-top','margin-right','margin-bottom','margin-left','padding-top','padding-right','padding-bottom','padding-left',
      'flex','flex-direction','flex-wrap','flex-grow','flex-shrink','flex-basis','align-items','align-self','justify-content','justify-items',
      'grid-template-columns','grid-template-rows','grid-column-start','grid-column-end','grid-row-start','grid-row-end','column-gap','row-gap',
      'overflow-x','overflow-y','color','background-color','background-image','background-clip','-webkit-text-fill-color','opacity','font-family','font-size','font-weight','font-style',
      'line-height','letter-spacing','text-align','text-transform','text-decoration-line','white-space','vertical-align','object-fit','list-style-type','list-style-position',
      'border-top-width','border-right-width','border-bottom-width','border-left-width','border-top-style','border-right-style','border-bottom-style','border-left-style',
      'border-top-color','border-right-color','border-bottom-color','border-left-color','border-top-left-radius','border-top-right-radius','border-bottom-right-radius','border-bottom-left-radius','box-shadow'];
    for (const ancestor of document.querySelectorAll('.deck-viewport,.deck-stage,#slideshow-holder,#slideshow-wrapper')) {
      ancestor.style.setProperty('transform', 'none', 'important');
      ancestor.style.setProperty('zoom', '1', 'important');
      ancestor.style.setProperty('width', `${width}px`, 'important');
      ancestor.style.setProperty('height', `${width * 9 / 16}px`, 'important');
      ancestor.style.setProperty('left', '0', 'important');
      ancestor.style.setProperty('top', '0', 'important');
    }
    const output = [];
    for (const slide of slides) {
      slide.classList.add('active', 'visible');
      for (const [key, value] of Object.entries({position:'relative',left:'0',top:'0',width:`${width}px`,height:`${width * 9 / 16}px`,margin:'0',transform:'none',opacity:'1',visibility:'visible'})) slide.style.setProperty(key, value, 'important');
      await new Promise(r => setTimeout(r, 40));
      const clone = slide.cloneNode(true);
      const sourceNodes = [slide, ...slide.querySelectorAll('*')];
      const cloneNodes = [clone, ...clone.querySelectorAll('*')];
      if (sourceNodes.length > 1500) throw Error('A slide has too many elements.');
      for (let i = 0; i < sourceNodes.length; i++) {
        const source = sourceNodes[i], target = cloneNodes[i];
        if (!target || source.localName === 'script' || source.localName === 'style') continue;
        const computed = getComputedStyle(source);
        // Font Awesome renders private-use glyphs via CSS generated content.
        if (!source.textContent.trim() && source.classList && [...source.classList].some(c => /^(?:fa|fas|far|fab|fa-solid|fa-regular|fa-brands)$/.test(c))) {
          const pseudo = getComputedStyle(source, '::before');
          const match = pseudo.content?.match(/^["'](.+)["']$/u);
          const point = match?.[1]?.codePointAt(0);
          if (/font ?awesome/i.test(pseudo.fontFamily) && point && ((point >= 0xe000 && point <= 0xf8ff) || (point >= 0xf0000 && point <= 0xffffd))) {
            target.setAttribute('data-desq-fa-code', point.toString(16));
            target.setAttribute('data-desq-fa-color', pseudo.color);
            const rect = source.getBoundingClientRect();
            target.setAttribute('data-desq-fa-font-size', pseudo.fontSize);
            target.setAttribute('data-desq-fa-width', String(rect.width));
            target.setAttribute('data-desq-fa-height', String(rect.height));
            target.setAttribute('data-desq-fa-kind', /brands/i.test(pseudo.fontFamily) ? 'brands' : Number(pseudo.fontWeight) >= 600 ? 'solid' : 'regular');
          } else if (source.classList.contains('fa-solid') || source.classList.contains('fas') || source.classList.contains('fa-regular') || source.classList.contains('far') || source.classList.contains('fa-brands') || source.classList.contains('fab') || (source.classList.contains('fa') && [...source.classList].some(c => /^fa-[\w-]+$/.test(c)))) {
            throw Error('Font Awesome icon styles did not load. Check the presentation stylesheet and network connection.');
          }
        }
        target.removeAttribute('style');
        // SVG children use presentation attributes; HTML layout properties such
        // as width:auto are invalid SVG geometry and greatly inflate snapshots.
        if (source.namespaceURI === 'http://www.w3.org/2000/svg' && source.localName !== 'svg') {
          for (const property of ['fill', 'fill-opacity', 'stroke', 'stroke-opacity', 'stroke-width', 'stroke-linecap', 'stroke-linejoin']) {
            const value = computed.getPropertyValue(property);
            if (value && !/@|url\s*\(|expression\s*\(/i.test(value)) target.style.setProperty(property, value);
          }
          continue;
        }
        for (const property of properties) {
          const value = computed.getPropertyValue(property);
          if (value && !/@|url\s*\(|expression\s*\(|image-set\s*\(|-moz-binding|behavior\s*:/i.test(value)) target.style.setProperty(property, value);
        }
        // Keep a source text run on one line when it was rendered that way.
        // Its frozen box can otherwise rewrap when the second layout pass uses
        // slightly different font metrics or rounds the measured width.
        const directText = [...source.childNodes].filter(node => node.nodeType === 3 && node.textContent.trim());
        const rects = directText.flatMap(node => {
          const range = document.createRange();
          range.selectNodeContents(node);
          return [...range.getClientRects()].filter(rect => rect.width && rect.height);
        });
        if (rects.length && rects.every(rect => Math.abs(rect.top - rects[0].top) < 1))
          target.style.setProperty('white-space', 'nowrap');
      }
      // Standalone HTML decks commonly reuse symbols defined outside slides.
      // Inline local symbols before the sandbox is discarded, resolving CSS
      // variables in the original use context. Never follow external URLs.
      for (let i = 0; i < sourceNodes.length; i++) {
        const use = sourceNodes[i];
        if (use.localName !== 'use' || use.namespaceURI !== 'http://www.w3.org/2000/svg') continue;
        const targetUse = cloneNodes[i];
        const href = use.getAttribute('href') || use.getAttribute('xlink:href') || '';
        const symbol = /^#[\w.-]+$/.test(href) ? document.getElementById(href.slice(1)) : null;
        const sourceSvg = use.parentElement, svg = targetUse?.parentElement;
        if (!symbol || symbol.localName !== 'symbol' || sourceSvg?.localName !== 'svg' || sourceSvg.querySelectorAll('use').length !== 1 || !svg) throw Error('Unsupported SVG icon reference; use a local symbol within a single SVG.');
        if (symbol.querySelectorAll('*').length > 500) throw Error('An SVG symbol has too many elements.');
        const viewBox = symbol.getAttribute('viewBox');
        if (!viewBox) throw Error('SVG symbols need a viewBox.');
        if (!svg.hasAttribute('viewBox')) svg.setAttribute('viewBox', viewBox);
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.innerHTML = symbol.innerHTML;
        const style = getComputedStyle(use);
        for (const node of [group, ...group.querySelectorAll('*')]) {
          for (const attr of [...node.attributes]) {
            let value = attr.value.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*))?\)/g,
              (_, name, fallback) => style.getPropertyValue(name).trim() || fallback?.trim() || '');
            value = value.replace(/currentColor/gi, style.color);
            node.setAttribute(attr.name, value);
          }
        }
        targetUse.replaceWith(group);
      }
      const section = document.createElement('section');
      section.innerHTML = clone.innerHTML;
      section.style.cssText = clone.style.cssText;
      // A presentation often paints its background on the stage or body.
      if (!section.style.backgroundColor || /^(transparent|rgba\(0,\s*0,\s*0,\s*0\))$/i.test(section.style.backgroundColor)) {
        for (let ancestor = slide.parentElement; ancestor; ancestor = ancestor.parentElement) {
          const color = getComputedStyle(ancestor).backgroundColor;
          if (color && !/^(transparent|rgba\(0,\s*0,\s*0,\s*0\))$/i.test(color)) {
            section.style.backgroundColor = color;
            break;
          }
        }
      }
      section.style.setProperty('position','relative','important');
      // Prevent first-child margins from shifting the slide away from (0,0).
      if (getComputedStyle(slide).display === 'block') section.style.setProperty('display', 'flow-root', 'important');
      section.style.setProperty('width',`${width}px`,'important');
      section.style.setProperty('height',`${width * 9 / 16}px`,'important');
      section.style.setProperty('left','0','important');
      section.style.setProperty('top','0','important');
      section.style.setProperty('margin','0','important');
      section.style.setProperty('transform','none','important');
      section.style.setProperty('visibility','visible','important');
      section.style.setProperty('opacity','1','important');
      section.setAttribute('data-desq-stage-width', String(width));
      section.setAttribute('data-desq-imported', '1');
      output.push(section.outerHTML);
      slide.classList.remove('active', 'visible');
    }
    parent.postMessage({ type:'desq-rendered-slides', token, slides:output }, '*');
  } catch (error) {
    parent.postMessage({ type:'desq-rendered-slides', token, error:String(error?.message || error) }, '*');
  }
}

// Scripts have an opaque origin, no editor/storage access, and no general network
// access. Only the Tailwind CDN and Google/Font Awesome style resources are allowed.
export function renderScriptedFrontendSlides(source, deck, { document = globalThis.document, signal, timeout = 15000, iconOptions = {} } = {}) {
  if (!document?.defaultView || typeof source !== 'string' || source.length > 1700000) throw Error('Invalid HTML presentation.');
  const width = /data-desq-stage-width="1920"/.test(deck.slides[0]?.html || '') ? 1920 : 1280;
  const frame = document.createElement('iframe');
  frame.setAttribute('sandbox', 'allow-scripts');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = `position:fixed;left:-20000px;top:0;width:${width}px;height:${width * 9 / 16}px;border:0;visibility:hidden;pointer-events:none`;
  const token = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2,'0')).join('');
  const csp = "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com; style-src 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src https://fonts.gstatic.com https://cdnjs.cloudflare.com; img-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'";
  const clean = source.trim().replace(/^```(?:html)?\s*/i, '').replace(/\s*```$/, '');
  frame.srcdoc = `<!doctype html><meta http-equiv="Content-Security-Policy" content="${csp}">${clean}<script>window.addEventListener('load',()=>(${snapshotSlides.toString()})(${JSON.stringify(token)},${width},${deck.slides.length}));<\/script>`;
  return new Promise((resolve, reject) => {
    let timer, settled = false;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      document.defaultView.removeEventListener('message', receive);
      signal?.removeEventListener('abort', aborted);
      frame.remove();
      error ? reject(error) : resolve(result);
    };
    const aborted = () => finish(signal.reason || new DOMException('Aborted', 'AbortError'));
    const receive = async event => {
      if (event.source !== frame.contentWindow || event.data?.type !== 'desq-rendered-slides' || event.data.token !== token) return;
      try {
        if (event.data.error) throw Error(`Could not render HTML: ${String(event.data.error).slice(0, 300)}`);
        if (!Array.isArray(event.data.slides) || event.data.slides.length !== deck.slides.length) throw Error('The rendered slide count did not match the original.');
        const sections = event.data.slides.map((html, index) => {
          if (typeof html !== 'string' || html.length > 2000000) throw Error(`Slide ${index + 1} rendered content exceeds the 2,000,000-character limit.`);
          const template = document.createElement('template');
          template.innerHTML = html;
          const section = template.content.firstElementChild;
          if (!section || section.localName !== 'section' || template.content.children.length !== 1) throw Error('Invalid rendered slide.');
          section.querySelectorAll('script,iframe,object,embed,link,style,video,audio,canvas').forEach(el => el.remove());
          for (const el of [section, ...section.querySelectorAll('*')]) {
            for (const attr of [...el.attributes]) if (/^on/i.test(attr.name) || ['contenteditable','href','xlink:href','srcset','action','formaction'].includes(attr.name.toLowerCase())) el.removeAttribute(attr.name);
            if (el.localName === 'a') el.replaceWith(...el.childNodes);
          }
          section.setAttribute('data-desq-stage-width', String(width));
          section.setAttribute('data-desq-imported', '1');
          return section;
        });
        await materializeFontAwesomeIcons(sections, clean, { ...iconOptions, document, signal });
        const slides = sections.map((section, index) => {
          const sanitized = section.outerHTML;
          parseSlideHTML(sanitized, document);
          return { ...deck.slides[index], html: sanitized };
        });
        finish(null, { ...deck, slides });
      } catch (error) { finish(error); }
    };
    timer = setTimeout(() => finish(Error('HTML rendering timed out. The presentation may need unsupported scripts or resources.')), timeout);
    document.defaultView.addEventListener('message', receive);
    if (signal?.aborted) return aborted();
    signal?.addEventListener('abort', aborted, { once:true });
    document.body.append(frame);
  });
}
