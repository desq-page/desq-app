// Resolve only known Font Awesome CDN font files; never fetch URLs supplied by scripts.
const fonts = new Map();
function fontVersion(source, document) {
  const template = document.createElement('template');
  template.innerHTML = source;
  for (const link of template.content.querySelectorAll('link[href]')) {
    try {
      const url = new URL(link.getAttribute('href'));
      const match = url.hostname === 'cdnjs.cloudflare.com' && url.protocol === 'https:' &&
        url.pathname.match(/^\/ajax\/libs\/font-awesome\/(\d+\.\d+\.\d+)\/css\/(?:all|fontawesome|font-awesome)(?:\.min)?\.css$/);
      if (match) return match[1];
    } catch { /* Ignore non-absolute URLs. */ }
  }
  return null;
}
async function loadFont(version, kind, { signal, fetchImpl, parseFont }) {
  const major = Number(version.split('.')[0]);
  const filename = `fa-${kind}-${kind === 'solid' ? '900' : '400'}.ttf`;
  const path = major === 4 ? `fonts/fontawesome-webfont.ttf` : `webfonts/${filename}`;
  const url = `https://cdnjs.cloudflare.com/ajax/libs/font-awesome/${version}/${path}`;
  if (fonts.has(url)) return fonts.get(url);
  const response = await fetchImpl(url, { credentials:'omit', signal, redirect:'error' });
  if (!response.ok) throw Error(`Font Awesome ${kind} font could not be loaded (HTTP ${response.status}).`);
  const length = Number(response.headers.get('content-length'));
  if (length > 5_000_000) throw Error('Font Awesome font is too large.');
  const data = await response.arrayBuffer();
  if (data.byteLength > 5_000_000 || data.byteLength < 100) throw Error('Invalid Font Awesome font size.');
  const font = await parseFont(data);
  fonts.set(url, font);
  return font;
}

export async function materializeFontAwesomeIcons(sections, source, { document = globalThis.document, signal, fetchImpl = globalThis.fetch, parseFont } = {}) {
  const icons = sections.flatMap(section => [...section.querySelectorAll('[data-desq-fa-code]')]);
  if (!icons.length) return 0;
  if (icons.length > 1000) throw Error('Too many Font Awesome icons.');
  const version = fontVersion(source, document);
  if (!version) throw Error('Font Awesome icons require a supported cdnjs stylesheet to identify their font.');
  if (!parseFont) {
    const module = await import('opentype.js');
    const opentype = module.default || module;
    parseFont = data => opentype.parse(data);
  }
  for (const icon of icons) {
    signal?.throwIfAborted();
    const code = icon.getAttribute('data-desq-fa-code');
    const kind = icon.getAttribute('data-desq-fa-kind');
    if (!/^[0-9a-f]{4,6}$/i.test(code || '') || !['solid','regular','brands'].includes(kind)) throw Error('Invalid Font Awesome icon.');
    const point = Number.parseInt(code, 16);
    if (!((point >= 0xe000 && point <= 0xf8ff) || (point >= 0xf0000 && point <= 0xffffd))) throw Error('Invalid Font Awesome glyph.');
    const font = await loadFont(version, kind, {signal,fetchImpl,parseFont});
    const glyph = font.charToGlyph(String.fromCodePoint(point));
    if (!glyph || !glyph.index) throw Error(`Font Awesome glyph U+${code.toUpperCase()} is unavailable.`);
    const path = glyph.getPath(0, 0, font.unitsPerEm);
    const box = path.getBoundingBox();
    const width = box.x2 - box.x1, height = box.y2 - box.y1;
    if (![box.x1,box.y1,width,height].every(Number.isFinite) || width <= 0 || height <= 0) throw Error('Invalid Font Awesome glyph geometry.');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    // A font glyph occupies only part of its line box. Mapping its tight
    // outline to that box stretches short icons to the full line height.
    // Use the browser-measured box and font ascent/descent to retain the glyph
    // scale and baseline instead.
    const size = parseFloat(icon.getAttribute('data-desq-fa-font-size'));
    const boxWidth = Number(icon.getAttribute('data-desq-fa-width'));
    const boxHeight = Number(icon.getAttribute('data-desq-fa-height'));
    const units = font.unitsPerEm;
    const ascent = font.ascender, descent = font.descender;
    if ([size, boxWidth, boxHeight, units, ascent, descent].every(Number.isFinite) &&
        size > 0 && boxWidth > 0 && boxHeight > 0 && units > 0 && ascent > descent) {
      const scale = size / units;
      const baseline = (boxHeight - (ascent - descent) * scale) / 2 + ascent * scale;
      svg.setAttribute('viewBox', `0 ${-baseline / scale} ${boxWidth / scale} ${boxHeight / scale}`);
      svg.style.width = `${boxWidth}px`;
      svg.style.height = `${boxHeight}px`;
    } else {
      svg.setAttribute('viewBox', `${box.x1} ${box.y1} ${width} ${height}`);
    }
    const measuredWidth = svg.style.width, measuredHeight = svg.style.height;
    svg.setAttribute('style', icon.getAttribute('style') || '');
    if (measuredWidth && measuredHeight) { svg.style.width = measuredWidth; svg.style.height = measuredHeight; }
    svg.style.setProperty('display', 'inline-block');
    const pathNode = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathNode.setAttribute('d', path.toPathData(3));
    const paint = document.createElement('span').style;
    paint.color = icon.getAttribute('data-desq-fa-color') || icon.style.color;
    pathNode.setAttribute('fill', paint.color || '#000000');
    svg.append(pathNode);
    icon.replaceWith(svg);
  }
  return icons.length;
}
