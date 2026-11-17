// Runs in the source template's document. Capture content geometry, not demo copy.
export function measureTemplateLayouts() {
  const slides = [...document.querySelectorAll('.slide, section[data-screen-label], section[data-label]')]
    .filter(el => !el.parentElement.closest('.slide, section[data-screen-label], section[data-label]'));
  const ignored = /(?:^|[-_\s])(footer|eyebrow|kicker|tag|meta|pagenum|page-number|counter|pagedot|signoff|copyright|stamp|badge|chip|ed-row|ed-label|actions|chrome|nav|deco|win-titlebar|win-buttons|hourglass|marquee|progress|btn)(?:$|[-_\s])/i;
  const repeated = /(?:^|[-_\s])(card|pillar|step|agenda-item|toc-item|index-item|list-item|phase|milestone|column|col|panel|principle|feature|feat|bullet-item|item|row|entry|service|node|side)(?:$|[-_\s])/i;
  const rounded = value => Math.round(value * 10) / 10;
  const output = [], rejected = [];
  for (const [index, slide] of slides.entries()) {
    const statistic = slide.matches('.s-stat') ? slide.querySelector('.stat > .num') : null;
    slide.classList.add('active', 'visible');
    slide.style.setProperty('opacity', '1', 'important');
    slide.style.setProperty('visibility', 'visible', 'important');
    slide.style.setProperty('transform', 'none', 'important');
    if (getComputedStyle(slide).display === 'none') slide.style.setProperty('display', 'flex', 'important');
    const stage = slide.closest('deck-stage');
    if (stage) {
      slide.style.position = 'relative';
      slide.style.boxSizing = 'border-box';
      slide.style.width = (stage.getAttribute('width') || '1920') + 'px';
      slide.style.height = (stage.getAttribute('height') || '1080') + 'px';
    }
    const rect = slide.getBoundingClientRect();
    if (rect.width < 200 || rect.height < 200) continue;
    const sx = 1280 / rect.width, sy = 720 / rect.height;
    const box = el => {
      const r = el.getBoundingClientRect();
      return { x: rounded((r.x - rect.x) * sx), y: rounded((r.y - rect.y) * sy),
        w: rounded(r.width * sx), h: rounded(r.height * sy) };
    };
    const visible = el => { const s = getComputedStyle(el), b = box(el);
      return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) !== 0 &&
        b.w > 8 && b.h > 6 && b.x >= -1 && b.y >= -1 && b.x + b.w <= 1281 && b.y + b.h <= 721;
    };
    const elements = [...slide.querySelectorAll('*')].filter(visible);
    const chrome = el => { for (let e = el; e && e !== slide; e = e.parentElement) {
      if (statistic && (e === statistic || e.matches('.topbar, .ribbon, .source'))) return true;
      if (e.matches('[data-desq-role="content"], [data-desq-role="title"]')) return false;
      if (e.matches('[data-desq-role="decoration"], footer, .head > .label, .topbar > .label, header .label, .slide-head .label, .slide-foot .label, .topic > .foot, .s-compare .side > .label')) return true;
      if (/(?:^|[-_\s])(decor|decoration|motif|ornament|logo|wordmark)(?:$|[-_\s])/i.test(String(e.className))) return true;
      if (ignored.test(String(e.className))) return true;
    } return false; };
    const candidates = [...new Set(elements.filter(el =>
      [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) &&
      !chrome(el) && !el.closest('svg,button') &&
      !/(?:^|[-_\s])(num|number|icon)(?:$|[-_\s])/i.test(String(el.className)) &&
      !el.matches('[data-desq-role="decoration"]'))
      .map(el => getComputedStyle(el).display === 'inline' && el.parentElement !== slide ? el.parentElement : el))]
      .filter(el => visible(el) && box(el).w >= 70 && box(el).h >= 16 && parseFloat(getComputedStyle(el).fontSize) * sx >= 12);
    let title = elements.find(el => el.matches('[data-desq-role="title"]'));
    title ||= candidates.filter(el => /^H[1-4]$/.test(el.tagName))
      .sort((a, b) => box(a).y - box(b).y || Number(a.tagName[1]) - Number(b.tagName[1]))[0];
    // Some poster templates use divs for their display heading.
    title ||= elements.filter(el => /(?:title|headline)/i.test(String(el.className)) &&
      !chrome(el) && el.textContent.trim() && !el.querySelector('h1,h2,h3'))
      .sort((a,b) => parseFloat(getComputedStyle(b).fontSize) - parseFloat(getComputedStyle(a).fontSize))[0];
    title ||= candidates.filter(el => /(?:opener|display|heading)/i.test(String(el.className)))[0];
    title ||= candidates.filter(el => !el.closest('li')).sort((a,b) => parseFloat(getComputedStyle(b).fontSize)-parseFloat(getComputedStyle(a).fontSize))[0];
    if (!title) { rejected.push({index:index+1,reason:'no heading'}); continue; }
    const imageRegion = el => el.tagName === 'IMG' ||
      /(?:^|[-_\s])(?:image|img|photo)(?:$|[-_\s])/i.test(String(el.className)) ||
      /(?:image|img|photo)[-_ ]?(?:placeholder|frame|box|panel)/i.test(String(el.className));
    let images = elements.filter(imageRegion)
      .filter(el => !elements.some(other => other !== el && other.contains(el) &&
        imageRegion(other)));
    // Data graphics and tables need semantic data bindings; do not turn their sample
    // numbers into decorative artwork or silently substitute a generic text layout.
    const chartRegions = elements.filter(el => /(?:^|[-_\s])(chart|graph)(?:$|[-_\s])/i.test(String(el.className)))
      .filter(el => !elements.some(parent => parent !== el && parent.contains(el) &&
        /(?:^|[-_\s])(chart|graph)(?:$|[-_\s])/i.test(String(parent.className))));
    const structuredData = elements.some(el => el.tagName === 'TABLE' ||
      /(?:^|[-_\s])(metrics|stat-grid|stats-grid|metric-card)(?:$|[-_\s])/i.test(String(el.className)));
    if (structuredData || images.length > 1 || chartRegions.length > 1 || (images.length && chartRegions.length)) {
      rejected.push({index:index+1,reason:'requires structured data or multiple visuals'}); continue;
    }
    const visualKind = chartRegions.length ? 'chart' : 'photo';
    if (chartRegions.length) images = chartRegions;
    let bodies = candidates.filter(el => el !== title && !title.contains(el) && !el.contains(title) &&
      !images.some(image => image.contains(el)) &&
      !candidates.some(parent => parent !== title && parent !== el && parent.contains(el)));
    // Repeated card/column containers form a single semantic slot, allowing an
    // original bullet with multiple paragraphs to fill the complete card.
    const grouped = bodies.map(el => {
      let target = el;
      for (let parent = el.parentElement; parent && parent !== slide; parent = parent.parentElement) {
        if (parent.contains(title) || images.some(image => parent.contains(image))) break;
        if ((repeated.test(String(parent.className)) || parent.matches('.topic, .grid-cols > div')) &&
            getComputedStyle(parent).display !== 'none') { target = parent; break; }
      }
      return target;
    });
    bodies = [...new Set(grouped)].filter(el => !grouped.some(parent => parent !== el && parent.contains(el)));
    bodies.sort((a,b) => {
      const first = box(a), second = box(b);
      const sameRow = slide.classList.contains('s-notes') && Math.abs(first.y - second.y) < 6;
      return sameRow ? first.x - second.x : first.y - second.y || first.x - second.x;
    });
    if (bodies.length > 16) { rejected.push({index:index+1,reason:'too many text groups', count:bodies.length}); continue; }
    const wordNumber = /^(?:one|two|three|four|five|six)$/i;
    const numberText = /^(?:(Step|Phase|Stage)\s+)?(\d{1,2}|[IVX]{1,4}|[A-F])[.)]?$/i;
    const sourceMarkers = bodies.map(el => [...el.querySelectorAll('*')].find(child => visible(child) &&
      ((/^(H3|H4)$/.test(child.tagName) && wordNumber.test(child.textContent.trim())) ||
      (/(?:^|[-_\s])(num|number|step-num|agenda-num)(?:$|[-_\s])/i.test(String(child.className)) &&
      numberText.test(child.textContent.trim())))));
    const textSlot = (el, heading) => {
      let b = box(el), style = getComputedStyle(el);
      b = { x: Math.max(0,b.x), y: Math.max(0,b.y), w: Math.min(1280,b.x+b.w)-Math.max(0,b.x), h: Math.min(720,b.y+b.h)-Math.max(0,b.y) };
      const paragraphs = [...el.querySelectorAll('p,li')].filter(visible);
      if (!heading && paragraphs.length) style = getComputedStyle(paragraphs[0]);
      // Padding belongs to the source geometry; don't add the generic card inset.
      const insetX = parseFloat(getComputedStyle(el).paddingLeft) * sx || 0;
      const insetY = parseFloat(getComputedStyle(el).paddingTop) * sy || 0;
      b = { x: b.x + insetX, y: b.y + insetY, w: b.w - insetX * 2, h: b.h - insetY * 2 };
      const marker = !heading && sourceMarkers[bodies.indexOf(el)];
      if (!heading) {
        const content = candidates.filter(child => child !== el && el.contains(child) && !marker?.contains(child));
        if (content.length) {
          const boxes = content.map(box), x = Math.min(...boxes.map(b=>b.x)), y = Math.min(...boxes.map(b=>b.y));
          b = { x, y, w: Math.max(...boxes.map(b=>b.x+b.w))-x, h: Math.max(...boxes.map(b=>b.y+b.h))-y };
        }
      }
      const size = rounded(parseFloat(style.fontSize) * sx * .75);
      const lineHeight = parseFloat(style.lineHeight) * sy || size * 1.6;
      const shadow = /^(rgba?\([^)]*\))\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px/.exec(style.textShadow);
      return { ...b, role: heading ? 'title' : 'content', size, lineHeight: rounded(lineHeight / size), inset: 0, transparent: true,
        ...(shadow ? { textShadow: { sourceColor: shadow[1], x: Number(shadow[2]) * sx,
          y: Number(shadow[3]) * sy, blur: Number(shadow[4]) * Math.min(sx, sy) } } : {}),
        sourceColor: style.color,
        fontWeight: Number(style.fontWeight) || 400,
        align: style.textAlign === 'center' ? 'ctr' : style.textAlign === 'right' ? 'r' : 'l',
        regularHeading: Number(style.fontWeight) < 600,
        optional: !heading && /(?:^|[-_\s])(lede|subtitle|sub|intro)(?:$|[-_\s])/i.test(String(el.className)) };
    };
    const slots = [textSlot(title, true), ...bodies.map(el => textSlot(el, false))];
    // Exclude source overflow and tiny metadata boxes; never shrink content to fit.
    if (slots.some(s => s.size < 7 || s.w < 70 || s.h < 16)) { rejected.push({index:index+1,reason:'small slot',slots:slots.filter(s=>s.size<7||s.w<70||s.h<16)}); continue; }
    const panelElements = [...new Set([...elements, ...bodies, ...bodies.map(el => el.parentElement)])].filter(Boolean);
    const artwork = panelElements.flatMap(el => {
      const coverDecoration = el.matches('.hero-frame > .deco-pink-rect, .hero-frame > .deco-green-circle');
      if (images.some(image => image === el || image.contains(el)) || (chrome(el) && !coverDecoration && !statistic) || el.closest('svg')) return [];
      const style = getComputedStyle(el), b = box(el);
      b.h = Math.min(b.h, 720 - Math.max(0, b.y));
      b.w = Math.min(b.w, 1280 - Math.max(0, b.x));
      if (b.w <= 0 || b.h <= 0) return [];
      const transform = coverDecoration && style.transform !== 'none' ? new DOMMatrix(style.transform) : null;
      if (transform) {
        const w = el.offsetWidth * sx, h = el.offsetHeight * sy;
        b.x += (b.w - w) / 2;
        b.y += (b.h - h) / 2;
        b.w = w;
        b.h = h;
      }
      const fill = style.backgroundColor;
      const sides = ['Top', 'Right', 'Bottom', 'Left'].map(side => ({
        side, width: parseFloat(style['border' + side + 'Width']) || 0,
        color: style['border' + side + 'Color'], style: style['border' + side + 'Style'],
      }));
      const top = sides[0];
      const uniformBorder = sides.every(side => side.width === top.width && side.color === top.color && side.style === top.style);
      const border = uniformBorder ? top.width : 0;
      const rules = uniformBorder ? [] : sides.filter(side => side.width > 0 && side.style !== 'none').map(side => {
        const horizontal = side.side === 'Top' || side.side === 'Bottom';
        const thickness = rounded(side.width * (horizontal ? sy : sx));
        return {
          name: 'Template rule',
          x: b.x + (side.side === 'Right' ? b.w - thickness : 0),
          y: b.y + (side.side === 'Bottom' ? b.h - thickness : 0),
          w: horizontal ? b.w : thickness, h: horizontal ? thickness : b.h,
          sourceFill: side.color,
        };
      });
      if (fill === 'rgba(0, 0, 0, 0)' && !border) return rules;
      if (b.w >= 1270 && b.h >= 710) return []; // Native layout background owns this.
      const shadow = /^(rgba?\([^)]*\)) (-?[\d.]+)px (-?[\d.]+)px 0px 0px$/.exec(style.boxShadow);
      return [...rules, { ...b, name: 'Source panel', sourceFill: fill, sourceBorder: style.borderTopColor,
        border: rounded(border * sx), radius: rounded(parseFloat(style.borderTopLeftRadius) * sx || 0),
        ...(coverDecoration ? { uniform: true, ...(el.classList.contains('deco-green-circle') ? { ellipse: true } : {}) } : {}),
        ...(transform ? { rot: rounded(Math.atan2(transform.b, transform.a) * 180 / Math.PI) } : {}),
        ...(el.matches('.hero-frame > .hero-label') ? { optionalSlot: 'cover-label' } : {}),
        ...(shadow ? { offsetShadow: { x: rounded(Number(shadow[2]) * sx), y: rounded(Number(shadow[3]) * sy),
          sourceColor: shadow[1] } } : {}) }];
    }).slice(0, 40);
    // Layout chrome is retained independently of the title and body slots.
    // Its text remains editable, but never becomes content on reapplication.
    const layoutElements = [];
    const hasText = el => [...el.childNodes].some(node => node.nodeType === 3 && node.textContent.trim());
    for (const el of elements) {
      if (!hasText(el) || el.closest('svg,button,nav') ||
          images.some(image => image === el || image.contains(el)) ||
          sourceMarkers.some(marker => marker && (marker === el || marker.contains(el)))) continue;
      const decorative = chrome(el) ||
        /(?:^|[-_\s])(num|number|icon)(?:$|[-_\s])/i.test(String(el.className));
      if (!decorative || el === title || title.contains(el)) continue;
      const style = getComputedStyle(el);
      const direct = [...el.childNodes].filter(node => node.nodeType === 3).map(node => node.textContent).join('').trim();
      if (!direct) continue;
      let text = style.textTransform === 'uppercase' ? direct.toUpperCase()
        : style.textTransform === 'lowercase' ? direct.toLowerCase() : direct;
      const bounds = box(el);
      if (el === statistic) text = '?';
      if (statistic && el.parentElement === statistic && el.localName === 'sup') {
        const context = document.createElement('canvas').getContext('2d');
        context.font = getComputedStyle(statistic).font;
        const original = [...statistic.childNodes].filter(node => node.nodeType === 3).map(node => node.textContent).join('').trim();
        bounds.x -= (context.measureText(original).width - context.measureText('?').width) * sx;
      }
      const shadow = /^(rgba?\([^)]*\))\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px/.exec(style.textShadow);
      layoutElements.push({
        ...bounds, role: 'decoration', name: el === statistic || el.parentElement === statistic ? 'Statistic placeholder' : 'Template label', text,
        ...(shadow ? { textShadow: { sourceColor: shadow[1], x: Number(shadow[2]) * sx,
          y: Number(shadow[3]) * sy, blur: Number(shadow[4]) * Math.min(sx, sy) } } : {}),
        size: rounded(parseFloat(style.fontSize) * sx * .75),
        fontFamily: style.fontFamily.split(',')[0].trim().replace(/^['"]|['"]$/g, ''),
        fontWeight: Number(style.fontWeight) || 400,
        sourceColor: style.color, lineHeight: parseFloat(style.lineHeight) * sy,
        align: style.textAlign === 'center' ? 'ctr' : style.textAlign === 'right' ? 'r' : 'l',
        letterSpacing: parseFloat(style.letterSpacing) * sx || 0,
        ...(new RegExp('^0?' + (index + 1) + '\\s*[/]\\s*0?' + slides.length + '$').test(text)
          ? { pageCounter: true } : {}),
      });
    }
    // Capture visible SVG artwork as exact paths. Chart/image regions remain
    // content bindings, and the pin symbols below retain their existing form.
    for (const svg of slide.querySelectorAll('svg')) {
      if (svg.parentElement.closest('svg')) continue;
      if (images.some(image => image === svg || image.contains(svg)) ||
          svg.querySelector('use[href="#pin"], use[href="#pin-open"]')) continue;
      const expanded = [];
      for (const use of svg.querySelectorAll('use')) {
        const href = use.getAttribute('href') || use.getAttribute('xlink:href');
        const symbol = href?.startsWith('#') && document.getElementById(href.slice(1));
        if (!symbol) continue;
        const clone = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        for (const name of ['x', 'y', 'width', 'height', 'transform']) {
          if (use.hasAttribute(name)) clone.setAttribute(name, use.getAttribute(name));
        }
        if (symbol.hasAttribute('viewBox')) clone.setAttribute('viewBox', symbol.getAttribute('viewBox'));
        const style = getComputedStyle(use);
        clone.style.color = style.color;
        clone.style.fill = style.fill;
        clone.style.stroke = style.stroke;
        clone.innerHTML = symbol.localName === 'symbol' ? symbol.innerHTML : symbol.outerHTML;
        use.after(clone);
        expanded.push(clone);
      }
      for (const el of svg.querySelectorAll('path,rect,circle,ellipse,line,polyline,polygon')) {
        if (el.closest('defs,symbol,clipPath,mask') || !visible(svg)) continue;
        const matrix = el.getScreenCTM(), style = getComputedStyle(el);
        if (!matrix) continue;
        const attr = name => Number(el.getAttribute(name) || 0);
        let d = el.getAttribute('d');
        if (el.localName === 'rect') {
          const x = attr('x'), y = attr('y'), w = attr('width'), h = attr('height');
          const rx = Math.min(attr('rx') || attr('ry'), w / 2), ry = Math.min(attr('ry') || rx, h / 2);
          d = rx ? `M${x+rx} ${y}H${x+w-rx}Q${x+w} ${y} ${x+w} ${y+ry}V${y+h-ry}Q${x+w} ${y+h} ${x+w-rx} ${y+h}H${x+rx}Q${x} ${y+h} ${x} ${y+h-ry}V${y+ry}Q${x} ${y} ${x+rx} ${y}Z`
            : `M${x} ${y}h${w}v${h}h${-w}Z`;
        } else if (el.localName === 'circle' || el.localName === 'ellipse') {
          const x = attr('cx'), y = attr('cy'), rx = attr('rx') || attr('r'), ry = attr('ry') || attr('r');
          d = `M${x-rx} ${y}a${rx} ${ry} 0 1 0 ${2*rx} 0a${rx} ${ry} 0 1 0 ${-2*rx} 0Z`;
        } else if (el.localName === 'line') {
          d = `M${attr('x1')} ${attr('y1')}L${attr('x2')} ${attr('y2')}`;
        } else if (el.localName === 'polyline' || el.localName === 'polygon') {
          const points = (el.getAttribute('points') || '').match(/-?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi)?.map(Number) || [];
          d = points.flatMap((value, i) => i % 2 === 0 ? [(i === 0 ? 'M' : 'L') + value + ' ' + points[i + 1]] : []).join('') +
            (el.localName === 'polygon' ? 'Z' : '');
        }
        if (!d || (style.fill === 'none' && style.stroke === 'none')) continue;
        layoutElements.push({
          ...box(el), name: 'Template vector', svgPath: d,
          matrix: [matrix.a * sx, matrix.b * sy, matrix.c * sx, matrix.d * sy,
            (matrix.e - rect.x) * sx, (matrix.f - rect.y) * sy],
          sourceFill: style.fill === 'none' ? 'rgba(0, 0, 0, 0)' : style.fill,
          sourceBorder: style.stroke === 'none' ? undefined : style.stroke,
          border: parseFloat(style.strokeWidth) * Math.hypot(matrix.a, matrix.b) * sx,
          opacity: Number(style.opacity) * Number(style.fillOpacity),
        });
      }
      expanded.forEach(element => element.remove());
    }
    // Resolve the reusable pin symbols into editable paths, including CSS rotation.
    for (const svg of slide.querySelectorAll('svg')) {
      const href = svg.querySelector('use')?.getAttribute('href');
      if (href !== '#pin' && href !== '#pin-open') continue;
      const matrix = svg.getScreenCTM();
      if (!matrix || !svg.getBoundingClientRect().width) continue;
      const symbol = document.getElementById(href.slice(1));
      if (!symbol) continue;
      const paths = [...symbol.querySelectorAll('path,ellipse')].flatMap(node => {
        const transform = node.transform.baseVal.consolidate()?.matrix;
        const pieces = node.tagName === 'path' ? node.getAttribute('d').split(/(?=M)/).filter(Boolean) : [null];
        return pieces.map(piece => {
          const path = node.cloneNode();
          if (piece) path.setAttribute('d', piece);
          svg.append(path);
          const length = path.getTotalLength();
          const count = Math.max(4, Math.ceil(length / 8));
          const points = Array.from({ length: count + 1 }, (_, i) => {
            let point = path.getPointAtLength(length * i / count);
            if (transform) point = point.matrixTransform(transform);
            point = point.matrixTransform(matrix);
            return [rounded((point.x - rect.x) * sx), rounded((point.y - rect.y) * sy)];
          });
          path.remove();
          return points;
        });
      });
      const points = paths.flat();
      if (!points.length || points.some(([x,y]) => x < 0 || y < 0 || x > 1280 || y > 720)) continue;
      const x = Math.min(...points.map(p => p[0])), y = Math.min(...points.map(p => p[1]));
      const w = Math.max(...points.map(p => p[0])) - x, h = Math.max(...points.map(p => p[1])) - y;
      if (w <= 0 || h <= 0) continue;
      artwork.push({ name: 'Safety pin', x, y, w, h, stroke: rounded(5 * Math.hypot(matrix.a, matrix.b) * sx),
        paths: paths.map(path => path.map(([px,py]) => [rounded(px-x), rounded(py-y)])) });
    }
    // A row of sibling content panels represents interchangeable point columns.
    const rows = [...new Set([slide, ...elements, ...bodies.map(el => el.parentElement)])].filter(Boolean)
      .map(parent => [...parent.children]
      .filter(child => !child.contains(title) && bodies.some(body => child === body || child.contains(body))))
      .filter(children => children.length >= 2 && children.length <= 6)
      .filter(children => {
        const boxes = children.map(box), first = boxes[0];
        return boxes.every((b, i) => Math.abs(b.y - first.y) < 8 &&
          b.w > 90 && b.h >= 80 && Math.abs(b.w - first.w) < first.w * .25 &&
          (i === 0 || b.x >= boxes[i - 1].x + boxes[i - 1].w - 2));
      }).sort((a, b) => b.length - a.length);
    const columnCells = index !== 0 && !images.length && rows[0]?.map(element => {
      const bounds = box(element);
      const slotIndexes = bodies.flatMap((body, index) =>
        element === body || element.contains(body) ? [index + 1] : []);
      // Unboxed columns may grow into the remaining row space. Fixed panels
      // and later labels define their own lower boundary.
      const panel = artwork.some(art => Math.abs(art.x - bounds.x) < 2 &&
        Math.abs(art.y - bounds.y) < 2 && Math.abs(art.w - bounds.w) < 2);
      if (!panel) {
        const bottom = Math.min(720 - (parseFloat(getComputedStyle(slide).paddingBottom) * sy || 32),
          ...[...layoutElements, ...artwork].filter(art => art.y > bounds.y + bounds.h).map(art => art.y - 12));
        bounds.h = Math.max(bounds.h, bottom - bounds.y);
      }
      bounds.h = Math.min(bounds.h, 720 - Math.max(0, bounds.y));
      return { ...bounds, slotIndexes };
    });
    if (statistic && slots.length === 2) {
      const ribbon = slide.querySelector('.ribbon');
      const footerY = (ribbon ? box(ribbon).y : 720) - 72;
      slots[1] = { ...slots[1], h: Math.max(slots[1].h, footerY - 24 - slots[1].y), alignTop: true };
      for (const art of layoutElements) {
        if (art.text && art.text.startsWith('SOURCE')) art.y = footerY;
      }
    }
    const columns = columnCells && columnCells.every(cell => cell.slotIndexes.length)
      ? { cells: columnCells } : undefined;
    output.push({ index: index + 1, label: slide.getAttribute('data-screen-label') || slide.getAttribute('data-label') ||
      title.textContent.replace(/\s+/g, ' ').trim().slice(0,100),
      sourceClass: slide.className.replace(/\b(active|visible)\b/g, '').trim(),
      layoutRole: slide.getAttribute('data-desq-layout-role') || undefined,
      defaultTitle: (title.innerText || title.textContent).trim(),
      ...(statistic ? { preferredContent: 'title-short-text' } : {}),
      sourceBackground: getComputedStyle(slide).backgroundColor,
      slots, artwork, layoutElements, ...(columns ? { columns } : {}),
      markerSlots: [null, ...sourceMarkers.map((el, index) => el ? {
        ...box(el), size: rounded(parseFloat(getComputedStyle(el).fontSize) * sx * .75),
        sourceColor: getComputedStyle(el).color,
        fontWeight: Number(getComputedStyle(el).fontWeight) || 400,
        uppercase: getComputedStyle(el).textTransform === 'uppercase',
        fontFamily: getComputedStyle(el).fontFamily.split(',')[0].trim().replace(/^['"]|['"]$/g, ''),
        ...(wordNumber.test(el.textContent.trim()) ? {
          wordNumber: true, defaultNumber: index + 1, sourceColor: getComputedStyle(el).color,
        } : { defaultNumber: index + 1,
          prefix: numberText.exec(el.textContent.trim())?.[1],
          alphabetic: /^[A-F][.)]?$/i.test(el.textContent.trim()),
          roman: /^[IVX]{1,4}[.)]?$/.test(el.textContent.trim()),
          digits: /^\D*0\d/.test(el.textContent.trim()) ? 2 : 1,
        }),
      } : null)], ...(images.length ? { image: box(images[0]), visualKind } : {}) });
  }
  return { layouts: [...output, ...rejected.map(record => {
    const slide=slides[record.index-1];
    return {index:record.index,label:slide.getAttribute('data-screen-label')||slide.getAttribute('data-label')||
      slide.querySelector('h1,h2,h3')?.textContent.trim().slice(0,100)||`Slide ${record.index}`,
      sourceClass:slide.className.replace(/\b(active|visible)\b/g,'').trim(),
      unavailableReason:record.reason,slots:[],artwork:[]};
  })].sort((a,b)=>a.index-b.index), rejected };
}
