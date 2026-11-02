// Browser layout -> a bounded SVG geometry transport -> existing native editor compiler.
// The iframe never runs model code or loads resources; only measured primitives leave it.
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c],
  );
const n = (value) => Math.round(value * 1000) / 1000;
const htmlTags = new Set(
  "section div article header footer main aside button blockquote pre code kbd samp mark sub sup figure figcaption dl dt dd h1 h2 h3 h4 h5 h6 p span strong b em i u s small br ul ol li table thead tbody tfoot tr th td img style".split(
    " ",
  ),
);
const svgTags = new Set(
  "svg g defs rect circle ellipse line polygon polyline path text tspan linearGradient radialGradient stop"
    .toLowerCase()
    .split(" "),
);
const cssCheck = (value) => {
  if (
    /@|url\s*\(|expression\s*\(|image-set\s*\(|-moz-binding|behavior\s*:/i.test(
      value,
    )
  )
    throw Error("HTML slides cannot load resources or use CSS imports.");
};
export function parseSlideHTML(html, document = globalThis.document) {
  if (typeof html !== "string" || !html.trim() || html.length > 2000000)
    throw Error("Return one complete HTML section, at most 2,000,000 characters.");
  if (!document?.defaultView?.DOMParser)
    throw Error(
      "HTML slides require browser layout. Open the presentation in the editor.",
    );
  // Template contents are inert, including images; validation happens before mounting.
  const template = document.createElement("template");
  template.innerHTML = html;
  const parsed = template.content;
  const roots = [...parsed.children];
  if (
    roots.length !== 1 ||
    roots[0].localName !== "section" ||
    [...parsed.childNodes].some(
      (node) => node.nodeType === 3 && node.textContent.trim(),
    )
  )
    throw Error("Return exactly one complete HTML section per slide.");
  const all = [...parsed.querySelectorAll("*")];
  if (all.length > 1500) throw Error("HTML slide has too many elements.");
  for (const element of all) {
    const tag = element.localName.toLowerCase();
    if (
      !(
        element.namespaceURI === "http://www.w3.org/2000/svg"
          ? svgTags
          : htmlTags
      ).has(tag)
    )
      throw Error(`Unsupported HTML slide element: ${tag}.`);
    // Models sometimes emit ordinary <img src> markup despite the image-slot
    // contract. Discard resource attributes while still in the inert template;
    // only the description reaches the host image resolver.
    if (tag === "img" && element.namespaceURI === "http://www.w3.org/1999/xhtml" &&
        (element.hasAttribute("src") || element.hasAttribute("srcset"))) {
      const query = element.getAttribute("data-query")?.trim() || element.getAttribute("alt")?.trim();
      if (!query) throw Error("Image description is missing. Replace src/srcset with data-query and descriptive alt text.");
      element.removeAttribute("src");
      element.removeAttribute("srcset");
      element.setAttribute("data-query", query);
      if (!element.getAttribute("alt")?.trim()) element.setAttribute("alt", query);
    }
    for (const attribute of element.attributes) {
      const key = attribute.name.toLowerCase();
      if (
        /^on/.test(key) ||
        [
          "src",
          "srcset",
          "href",
          "xlink:href",
          "action",
          "formaction",
          "contenteditable",
        ].includes(key)
      )
        throw Error(
          `HTML slides cannot use ${key}; images use data-query and alt.`,
        );
      if (key === "style") cssCheck(attribute.value);
    }
    if (tag === "style") cssCheck(element.textContent);
  }
  if (roots[0].textContent.length > 16000)
    throw Error("HTML slide has too much text.");
  return roots[0];
}
const transparent = (color) =>
  !color || color === "transparent" || /^rgba\([^)]*,\s*0\s*\)$/.test(color);

// Freeze generated content into ordinary nodes before measuring layout. The saved
// presentation contains only editable geometry/text, never live CSS pseudo-elements.
export function generatedContentText(content, readAttribute = () => "") {
  const tokens =
    /"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|attr\(\s*([\w-]+)\s*\)/g;
  const values = [];
  let end = 0;
  for (const token of content.matchAll(tokens)) {
    if (content.slice(end, token.index).trim())
      throw Error(
        "Unsupported CSS generated-content expression. Use literal text or attr(name).",
      );
    const raw = token[3] ? readAttribute(token[3]) || "" : token[1] ?? token[2];
    values.push(
      token[3]
        ? raw
        : raw.replace(
            /\\([0-9a-f]{1,6})(?:\r\n|[ \t\r\n\f])?|\\([^\r\n])/gi,
            (_, hex, char) =>
              hex
                ? String.fromCodePoint(
                    Math.min(parseInt(hex, 16) || 0xfffd, 0x10ffff),
                  )
                : char,
          ),
    );
    end = token.index + token[0].length;
  }
  if (content.slice(end).trim())
    throw Error(
      "Unsupported CSS generated-content expression. Use literal text or attr(name).",
    );
  return values.join("");
}
function materializePseudoElements(page, doc, onWarning) {
  const pending = [];
  for (const element of [page, ...page.querySelectorAll("*")]) {
    if (
      element.localName === "style" ||
      element.namespaceURI !== "http://www.w3.org/1999/xhtml"
    )
      continue;
    for (const pseudo of ["::before", "::after"]) {
      const computed = doc.defaultView.getComputedStyle(element, pseudo);
      if (
        computed.display === "none" ||
        !computed.content ||
        ["none", "normal"].includes(computed.content)
      )
        continue;
      let text;
      try {
        text = generatedContentText(computed.content, (name) =>
          element.getAttribute(name),
        );
      } catch {
        text = `[${computed.content}]`;
        onWarning(
          "Unresolved CSS generated content is retained as an editable expression label.",
        );
      }
      const style = Array.from(computed, (property) => [
        property,
        computed.getPropertyValue(property),
      ]);
      pending.push({ element, pseudo, text, style });
      if (pending.length > 1500)
        throw Error("HTML slide has too many generated elements.");
    }
  }
  // Snapshot all computed styles before suppressing the originals or changing flow.
  const disable = doc.createElement("style");
  doc.documentElement.id = "desq-html-layout-root";
  const scope = "#desq-html-layout-root#desq-html-layout-root";
  disable.textContent = `${scope} *::before,${scope} *::after{content:none!important;display:none!important}`;
  doc.body.append(disable);
  for (const { element, pseudo, text, style } of pending) {
    const node = doc.createElement("span");
    node.setAttribute("data-html-generated", pseudo.slice(2));
    for (const [property, value] of style)
      if (property !== "content")
        node.style.setProperty(property, value, "important");
    node.textContent = text;
    if (pseudo === "::before") element.prepend(node);
    else element.append(node);
  }
}

// Fidelity limitations are warnings. Disable effects before measuring so the
// resulting editable geometry matches the chosen approximation, not rotated bounds.
function approximatePresentationStyles(page, doc, warn) {
  const snapshots = [page, ...page.querySelectorAll("*")]
    .filter((el) => el.localName !== "style" && el.namespaceURI !== "http://www.w3.org/2000/svg")
    .map((el) => ({
      el,
      cs: doc.defaultView.getComputedStyle(el),
      transform: doc.defaultView.getComputedStyle(el).textTransform,
    }));
  const transforms = new Map(
    snapshots.map(({ el, transform }) => [el, transform]),
  );
  const textWalker = doc.createTreeWalker(
    page,
    doc.defaultView.NodeFilter.SHOW_TEXT,
  );
  while (textWalker.nextNode()) {
    const node = textWalker.currentNode,
      mode = transforms.get(node.parentElement);
    if (node.parentElement?.localName === "style") continue;
    if (mode === "uppercase")
      node.textContent = node.textContent.toLocaleUpperCase();
    else if (mode === "lowercase")
      node.textContent = node.textContent.toLocaleLowerCase();
    else if (mode === "capitalize")
      node.textContent = node.textContent.replace(
        /(^|\s)(\S)/gu,
        (_, space, char) => space + char.toLocaleUpperCase(),
      );
  }
  for (const { el, cs, transform } of snapshots) {
    if (cs.transform !== 'none' || cs.isolation === 'isolate' || Number(cs.opacity) < 1)
      el.setAttribute('data-desq-stacking-context', '1');
    if (transform !== "none") {
      el.style.setProperty("text-transform", "none", "important");
      warn("CSS text-transform was frozen into editable literal text.");
    }
    if (
      cs.animationName !== "none" ||
      cs.transitionDuration.split(",").some((v) => parseFloat(v) > 0)
    ) {
      el.style.setProperty("animation", "none", "important");
      el.style.setProperty("transition", "none", "important");
      warn("CSS animation/transition was frozen to a static slide.");
    }
    for (const [key, css] of [
      ["transform", "transform"],
      ["filter", "filter"],
      ["backdropFilter", "backdrop-filter"],
      ["clipPath", "clip-path"],
      ["maskImage", "mask-image"],
      ["backgroundImage", "background-image"],
    ]) {
      if (cs[key] && cs[key] !== "none") {
        const value = cs[key];
        if (key === 'transform' && page.hasAttribute('data-desq-imported') && el !== page) {
          try {
            const matrix = new doc.defaultView.DOMMatrix(value);
            const angle = Math.atan2(matrix.b, matrix.a) * 180 / Math.PI;
            if (Math.abs(angle) > .01 && Math.abs(matrix.a * matrix.c + matrix.b * matrix.d) < .001)
              el.setAttribute('data-desq-rotation', String(angle));
          } catch {}
        }
        const textGradient = key === "backgroundImage" && /(?:^|,)\s*text(?:\s*,|$)/.test(cs.backgroundClip) && /gradient\(/.test(value);
        const slideGradients = key === "backgroundImage" && el === page && /gradient\(/.test(value);
        if (slideGradients) el.setAttribute("data-desq-background-gradients", value);
        if (textGradient) el.setAttribute("data-desq-text-gradient", value);
        el.style.setProperty(css, "none", "important");
        if (
          key === "backgroundImage" &&
          !textGradient && !slideGradients &&
          /gradient\(/.test(value) &&
          transparent(cs.backgroundColor)
        ) {
          const color = value.match(/rgba?\([^)]*\)|#[\da-f]{3,8}\b/i)?.[0];
          if (color)
            el.style.setProperty("background-color", color, "important");
        }
        if (!textGradient && !slideGradients) warn(
          `HTML ${key} was approximated or omitted; native content remains editable.`,
        );
      }
    }
    if (cs.mixBlendMode !== "normal" || cs.isolation === "isolate")
      warn("HTML blend/isolation effects were omitted.");
    if (cs.position === "fixed" || cs.position === "sticky") {
      el.style.setProperty("position", "absolute", "important");
      warn(
        "HTML fixed/sticky positioning was approximated as absolute positioning.",
      );
    }
    if (cs.writingMode !== "horizontal-tb") {
      el.style.setProperty("writing-mode", "horizontal-tb", "important");
      warn("HTML vertical text was approximated as editable horizontal text.");
    }
    if (el.localName === "li" && cs.listStyleType !== "none") {
      const ordered = el.parentElement?.localName === "ol";
      const index =
        [...el.parentElement.children]
          .filter((child) => child.localName === "li")
          .indexOf(el) + (Number(el.parentElement.getAttribute("start")) || 1);
      el.prepend(
        doc.createTextNode(
          ordered ? `${el.getAttribute("value") || index}. ` : "• ",
        ),
      );
      el.style.setProperty("list-style", "none", "important");
      warn("HTML list markers were converted into editable literal text.");
    }
  }
}

// Convert computed linear gradients into native SVG gradient definitions.
// CSS supplies the direction clockwise from up; SVG uses clockwise from right.
export function cssTextGradient(value, doc = globalThis.document) {
  const match = /^linear-gradient\((.*)\)$/i.exec(value || '');
  if (!match) return null;
  const tokens = match[1].match(/(?:[^,()]|\([^()]*\))+/g)?.map(v => v.trim()) || [];
  let angle = 90;
  const direction = tokens[0];
  if (/^to\s+/i.test(direction)) {
    const dirs = direction.toLowerCase().split(/\s+/).slice(1);
    if (dirs.some(d => !['left','right','top','bottom'].includes(d))) return null;
    const x = (dirs.includes('right') ? 1 : 0) - (dirs.includes('left') ? 1 : 0);
    const y = (dirs.includes('bottom') ? 1 : 0) - (dirs.includes('top') ? 1 : 0);
    if (!x && !y) return null;
    angle = Math.atan2(y, x) * 180 / Math.PI;
    tokens.shift();
  } else if (/^-?[\d.]+deg$/i.test(direction)) {
    angle = parseFloat(direction) - 90;
    tokens.shift();
  }
  if (tokens.length < 2 || tokens.length > 16) return null;
  const stops = [];
  for (const token of tokens) {
    const stop = /^(rgba?\([^)]*\)|#[\da-f]{3,8}|[a-z]+)(?:\s+(-?[\d.]+)%)?$/i.exec(token);
    if (!stop) return null;
    const probe = doc.createElement('span').style;
    probe.color = stop[1];
    if (!probe.color) return null;
    stops.push({ color: probe.color, offset: stop[2] === undefined ? null : Math.max(0, Math.min(1, Number(stop[2]) / 100)) });
  }
  if (stops[0].offset === null) stops[0].offset = 0;
  if (stops.at(-1).offset === null) stops.at(-1).offset = 1;
  let previous = 0;
  while (previous < stops.length - 1) {
    let next = previous + 1;
    while (stops[next].offset === null) next++;
    stops[next].offset = Math.max(stops[previous].offset, stops[next].offset);
    for (let i = previous + 1; i < next; i++) stops[i].offset = stops[previous].offset + (stops[next].offset - stops[previous].offset) * (i - previous) / (next - previous);
    previous = next;
  }
  return { angle, stops };
}

// Split CSS layers without splitting commas inside color/gradient functions.
function splitCssLayers(value) {
  const result = [];
  let depth = 0, start = 0;
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '(') depth++;
    else if (value[i] === ')') depth--;
    else if (value[i] === ',' && depth === 0) { result.push(value.slice(start, i).trim()); start = i + 1; }
    if (depth < 0) return [];
  }
  if (depth) return [];
  result.push(value.slice(start).trim());
  return result;
}

function slideBackgroundLayers(value, doc) {
  const layers = [];
  for (const layer of splitCssLayers(value)) {
    if (/^linear-gradient\(/i.test(layer)) {
      const gradient = cssTextGradient(layer, doc);
      if (!gradient) return null;
      layers.push({ ...gradient, type: 'linear' });
      continue;
    }
    const radial = /^radial-gradient\((.*)\)$/i.exec(layer);
    if (!radial) return null;
    const tokens = splitCssLayers(radial[1]);
    let cx = .5, cy = .5, circle = false;
    if (/^(?:circle|ellipse|at\s)/i.test(tokens[0])) {
      const header = tokens.shift();
      circle = /^circle\b/i.test(header);
      const match = /\bat\s+([\d.]+)%\s+([\d.]+)%$/i.exec(header);
      if (header.includes(' at ') || header.startsWith('at ')) {
        if (!match) return null;
        cx = Number(match[1]) / 100; cy = Number(match[2]) / 100;
        if (cx < 0 || cx > 1 || cy < 0 || cy > 1) return null;
      } else if (!/^(?:circle|ellipse)$/i.test(header)) return null;
    }
    const gradient = cssTextGradient(`linear-gradient(to right, ${tokens.join(', ')})`, doc);
    if (!gradient) return null;
    layers.push({ type: 'radial', cx, cy, circle, stops: gradient.stops });
  }
  return layers.reverse();
}

// Computed CSS serializes colors as rgb()/rgba() and lengths as pixels.
// DrawingML has one native shadow per object; retain the first outer shadow.
export function parseHTMLBoxShadows(value) {
  if (!value || value === "none") return [];
  const layers = value.match(/(?:[^,()]|\([^)]*\))+/g) || [];
  return layers.map((layer) => {
    const color = layer.match(/rgba?\([^)]*\)|#[\da-f]+/i)?.[0] || "#000000";
    const lengths = layer
      .replace(color, "")
      .replace(/\binset\b/g, "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(parseFloat);
    if (
      lengths.length < 2 ||
      lengths.length > 4 ||
      !lengths.every(Number.isFinite)
    )
      throw Error("Invalid computed HTML box shadow.");
    return {
      color,
      dx: lengths[0],
      dy: lengths[1],
      blur: Math.max(0, lengths[2] || 0),
      spread: lengths[3] || 0,
      inset: /\binset\b/.test(layer),
    };
  });
}

export function htmlToSVG(
  html,
  { document = globalThis.document, onWarning = () => {}, prepareLayout, inspectLayout } = {},
) {
  const root = parseSlideHTML(html, document);
  const stageWidth = Number(root.getAttribute('data-desq-stage-width') || 1280);
  if (![1280, 1920].includes(stageWidth)) throw Error('Unsupported HTML slide size.');
  const stageHeight = stageWidth * 9 / 16;
  const seenWarnings = new Set();
  const warn = (message) => {
    if (!seenWarnings.has(message)) {
      seenWarnings.add(message);
      onWarning(message);
    }
  };
  const frame = document.createElement("iframe");
  frame.setAttribute("sandbox", "allow-same-origin");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText =
    `position:fixed;left:-20000px;top:0;width:${stageWidth}px;height:${stageHeight}px;border:0;visibility:hidden;pointer-events:none`;
  document.body.append(frame);
  try {
    const doc = frame.contentDocument;
    if (!doc) throw Error("Cannot initialize isolated HTML slide layout.");
    // CSP precedes imported markup. No model scripts, network requests, or fonts are accepted.
    doc.open();
    doc.write(
      "<!doctype html><html><head><meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; font-src 'none'\"></head><body></body></html>",
    );
    doc.close();
    const reset = doc.createElement("style");
    reset.textContent =
      `html,body{margin:0;padding:0;width:${stageWidth}px;height:${stageHeight}px}*{box-sizing:border-box}h1,h2,h3,h4,h5,h6,p{margin:0}section{position:relative}img{display:block}`;
    doc.head.append(reset);
    // Reuse already loaded host FontFaces so browser measurement and native text agree.
    document.fonts?.forEach((face) => {
      if (face.status === "loaded") doc.fonts.add(face);
    });
    const page = doc.importNode(root, true);
    doc.body.append(page);
    if (page.hasAttribute('data-desq-imported')) {
      const isolation = doc.createElement('style');
      isolation.textContent = 'html,body{display:block!important;margin:0!important;padding:0!important;overflow:hidden!important;position:static!important;transform:none!important}';
      doc.head.append(isolation);
    }
    prepareLayout?.(page, doc);
    materializePseudoElements(page, doc, warn);
    approximatePresentationStyles(page, doc, warn);
    inspectLayout?.(page, doc);
    const view = doc.defaultView,
      origin = page.getBoundingClientRect();
    if (
      Math.abs(origin.width - stageWidth) > 1 ||
      Math.abs(origin.height - stageHeight) > 1 ||
      origin.x !== 0 ||
      origin.y !== 0
    )
      throw Error(
        `HTML section must be positioned at 0,0 and measure exactly ${stageWidth}×${stageHeight} pixels (got ${n(origin.x)},${n(origin.y)} ${n(origin.width)}×${n(origin.height)}).`,
      );
    const parts = [],
      textGroups = new Map(), textGradients = new Map(), textShadows = new Map();
    let imageIndex = 0,
      id = 0;
    const bounds = (rect, label) => {
      if (
        rect.left < origin.left - 1 ||
        rect.top < origin.top - 1 ||
        rect.right > origin.right + 1 ||
        rect.bottom > origin.bottom + 1
      ) {
        if (page.hasAttribute('data-desq-imported')) { warn('An element extends beyond the slide; content outside the canvas may be clipped.'); return; }
        throw Object.assign(new Error(
          `HTML ${label} overflows the slide canvas (${Math.round(rect.left-origin.left)}, ${Math.round(rect.top-origin.top)}, ${Math.round(rect.width)}×${Math.round(rect.height)}). Shorten it or adjust its box.`,
        ), { code: "HTML_SLIDE_OVERFLOW" });
      }
    };
    const rectAttrs = (rect) =>
      `x="${n(rect.left - origin.left)}" y="${n(rect.top - origin.top)}" width="${n(rect.width)}" height="${n(rect.height)}"`;
    function gradientFor(element) {
      const owner = element.closest('[data-desq-text-gradient]');
      if (!owner || !page.contains(owner)) return null;
      if (textGradients.has(owner)) return textGradients.get(owner);
      const gradient = cssTextGradient(owner.getAttribute('data-desq-text-gradient'), doc);
      if (!gradient) {
        warn('Unsupported CSS text gradient was approximated with a solid color.');
        const fallback = owner.getAttribute('data-desq-text-gradient').match(/rgba?\([^)]*\)|#[\da-f]{3,8}\b/i)?.[0] || '#000000';
        textGradients.set(owner, { fallback });
        return { fallback };
      }
      const gradientId = `html-text-gradient-${++id}`;
      const radians = gradient.angle * Math.PI / 180;
      const dx = Math.cos(radians) / 2, dy = Math.sin(radians) / 2;
      parts.push(`<defs><linearGradient id="${gradientId}" x1="${n(.5-dx)}" y1="${n(.5-dy)}" x2="${n(.5+dx)}" y2="${n(.5+dy)}">${gradient.stops.map(stop => `<stop offset="${n(stop.offset)}" stop-color="${escape(stop.color)}"/>`).join('')}</linearGradient></defs>`);
      textGradients.set(owner, gradientId);
      return gradientId;
    }
    function textShadowFor(value) {
      if (!value || value === 'none') return '';
      if (textShadows.has(value)) return textShadows.get(value);
      const shadows = parseHTMLBoxShadows(value);
      if (shadows.length > 1) warn('Layered HTML text shadows use the first shadow in native text.');
      const shadow = shadows[0];
      if (!shadow) return '';
      const filterId = `html-text-shadow-${++id}`;
      parts.push(`<defs><filter id="${filterId}"><feDropShadow dx="${shadow.dx}" dy="${shadow.dy}" stdDeviation="${shadow.blur / 2}" flood-color="${escape(shadow.color)}" flood-opacity="1"/></filter></defs>`);
      const attr = ` filter="url(#${filterId})"`;
      textShadows.set(value, attr);
      return attr;
    }
    function text(node, owner, opacity) {
      if (!node.textContent.trim()) return;
      const parent = node.parentElement,
        cs = view.getComputedStyle(parent),
        range = doc.createRange();
      let block = parent;
      while (
        block !== owner &&
        ["inline", "contents"].includes(view.getComputedStyle(block).display)
      )
        block = block.parentElement;
      let group = textGroups.get(block);
      if (!group) {
        group = { index: parts.length, rows: [], id: ++id };
        textGroups.set(block, group);
        parts.push("");
      }
      // Character ranges retain real browser wrapping and inline styling, including CJK.
      for (let i = 0; i < node.length; i++) {
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        const r = range.getBoundingClientRect(),
          char = node.textContent[i];
        if (!r.width || !r.height) continue;
        if (!/\s/.test(char)) bounds(r, "text");
        const size = parseFloat(cs.fontSize),
          baseline = r.top - origin.top + (r.height - size) / 2 + size * 0.8;
        // Imported standalone slides retain the authored CSS number in the
        // editor's point-size control, even when the slide canvas is scaled.
        const editorSize = page.hasAttribute('data-desq-imported') ? size * (4 / 3) * (stageWidth / 1280) : size;
        const letterSpacing = parseFloat(cs.letterSpacing);
        const gradientId = gradientFor(parent);
        const shadowAttr = textShadowFor(cs.textShadow);
        const attrs = `font-family="${escape(cs.fontFamily)}" font-size="${n(editorSize)}" font-weight="${cs.fontWeight}" font-style="${cs.fontStyle}"${Number.isFinite(letterSpacing) && letterSpacing !== 0 ? ` letter-spacing="${n(letterSpacing)}"` : ""} fill="${typeof gradientId === 'string' ? `url(#${gradientId})` : escape(gradientId?.fallback || cs.color)}" opacity="${opacity}"${shadowAttr}${cs.textDecorationLine !== "none" ? ` text-decoration="${escape(cs.textDecorationLine)}"` : ""}`;
        const last = group.rows.at(-1);
        if (
          last &&
          Math.abs(last.y - baseline) < 0.5 &&
          Math.abs(last.right - (r.left - origin.left)) < 1 &&
          last.attrs === attrs
        ) {
          last.value += char;
          last.right = r.right - origin.left;
        } else
          group.rows.push({
            x: r.left - origin.left,
            y: baseline,
            right: r.right - origin.left,
            attrs,
            value: char,
          });
      }
    }
    function walk(el, opacity = 1) {
      const reveal = el.nodeType === 1 && el.getAttribute('data-desq-reveal');
      if (reveal && /^html-reveal-\d+$/.test(reveal)) {
        const animatedSvg = el.localName === 'svg';
        parts.push(`<g id="${reveal}">${animatedSvg ? `<g id="desq-html-group-${++id}">` : ''}`);
        walkElement(el, opacity);
        parts.push(animatedSvg ? '</g></g>' : '</g>');
      } else walkElement(el, opacity);
    }
    function walkElement(el, opacity = 1) {
      if (el.nodeType === 3) {
        text(el, page, opacity);
        return;
      }
      if (el.nodeType !== 1 || el.localName === "style") return;
      const cs = view.getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") return;
      opacity *= Number(cs.opacity);
      if (!opacity) return;
      const r = el.getBoundingClientRect();
      if (
        el.localName !== "img" &&
        !(el === page && page.hasAttribute("data-desq-imported")) &&
        !page.hasAttribute('data-desq-imported') &&
        el.clientWidth &&
        el.clientHeight &&
        ((cs.overflowX !== "visible" && el.scrollWidth > el.clientWidth + 1) ||
          (cs.overflowY !== "visible" && el.scrollHeight > el.clientHeight + 1))
      )
        throw Object.assign(new Error(
          `HTML ${el.localName} content overflows its clipped box (${el.scrollWidth}×${el.scrollHeight} inside ${el.clientWidth}×${el.clientHeight}). ${el === page ? "Keep the section exactly 1280×720; reduce content or vertical spacing rather than enlarging the canvas." : "Enlarge the inner box within the canvas or shorten its text."}`,
        ), { code: "HTML_SLIDE_OVERFLOW" });
      if (r.width && r.height) {
        if (page.hasAttribute('data-desq-imported') && (r.left < origin.left - 1 || r.top < origin.top - 1 || r.right > origin.right + 1 || r.bottom > origin.bottom + 1))
          warn('An element extends beyond the slide; content outside the canvas may be clipped.');
        else bounds(r, el.localName);
      }
      // Group only semantic list rows and visibly painted text containers from
      // rendered HTML. Layout-only wrappers should not become editor groups.
      const isGroup = page.hasAttribute('data-desq-imported') && el !== page &&
        !['svg', 'img'].includes(el.localName) && !['inline', 'contents'].includes(cs.display) &&
        (el.hasAttribute('data-desq-rotation') || el.localName === 'li' || (el.textContent.trim() &&
          (!transparent(cs.backgroundColor) || ['Top','Right','Bottom','Left'].some(side =>
            parseFloat(cs[`border${side}Width`]) > 0 && !['none','hidden'].includes(cs[`border${side}Style`])))));
      if (isGroup) {
        const angle = Number(el.getAttribute('data-desq-rotation'));
        const pivot = cs.transformOrigin.split(' ').map(parseFloat);
        const rotation = angle ? `-rot-${n(angle)}-${n((r.left - origin.left + (pivot[0] || 0)) * 1280 / stageWidth)}-${n((r.top - origin.top + (pivot[1] || 0)) * 1280 / stageWidth)}` : '';
        parts.push(`<g id="desq-html-group-${++id}${rotation}">`);
      }
      let shadowFilter = "";
      if (cs.boxShadow !== "none") {
        let shadows = [];
        try {
          shadows = parseHTMLBoxShadows(cs.boxShadow);
        } catch {
          warn("HTML box shadow could not be represented and was omitted.");
        }
        const shadow = shadows.find((item) => !item.inset);
        if (shadows.some((item) => item.inset))
          warn(
            "HTML inset box shadows are omitted; slide content remains editable.",
          );
        if (shadows.filter((item) => !item.inset).length > 1)
          warn(
            "HTML layered box shadows use the first outer shadow in native slides.",
          );
        if (shadow) {
          if (shadow.spread)
            warn(
              "HTML box-shadow spread is approximated by the native blur radius.",
            );
          const filterId = `html-shadow-${++id}`;
          const sigma = Math.max(0, shadow.blur / 2 + shadow.spread / 2);
          parts.push(
            `<defs><filter id="${filterId}"><feDropShadow dx="${shadow.dx}" dy="${shadow.dy}" stdDeviation="${sigma}" flood-color="${escape(shadow.color)}" flood-opacity="1"/></filter></defs>`,
          );
          shadowFilter = ` filter="url(#${filterId})"`;
        }
      }
      if (el.localName === "svg") {
        const vb = (el.getAttribute("viewBox") || `0 0 ${r.width} ${r.height}`)
          .trim()
          .split(/[ ,]+/)
          .map(Number);
        if (
          vb.length !== 4 ||
          !vb.every(Number.isFinite) ||
          vb[2] <= 0 ||
          vb[3] <= 0
        )
          throw Error("Inline SVG needs a valid viewBox.");
        const svgClone = el.cloneNode(true);
        for (const node of [svgClone, ...svgClone.querySelectorAll('[data-desq-drop-shadow]')]) {
          const value = node.getAttribute('data-desq-drop-shadow');
          if (!value) continue;
          node.removeAttribute('data-desq-drop-shadow');
          const match = /^drop-shadow\((.*)\)$/.exec(value);
          if (!match) { warn('Layered SVG drop shadows could not be converted.'); continue; }
          try {
            const shadow = parseHTMLBoxShadows(match[1])[0];
            if (!shadow) continue;
            const filterId = `html-svg-shadow-${++id}`;
            // CSS Gaussian blur distributes the source alpha over a wider
            // area; the native glow keeps more of its peak color. Approximate
            // that softening by attenuating opacity as the blur grows. Color
            // alpha remains in flood-color and is multiplied by this factor.
            const softnessAlpha = 1 / (1 + Math.max(0, shadow.blur) / 8);
            parts.push(`<defs><filter id="${filterId}"><feDropShadow dx="${shadow.dx}" dy="${shadow.dy}" stdDeviation="${shadow.blur}" flood-color="${escape(shadow.color)}" flood-opacity="${n(softnessAlpha)}"/></filter></defs>`);
            if (node === svgClone) shadowFilter = ` filter="url(#${filterId})"`;
            else node.setAttribute('filter', `url(#${filterId})`);
          } catch { warn('An SVG drop shadow could not be converted.'); }
        }
        const content = new view.XMLSerializer()
          .serializeToString(svgClone)
          .replace(/^<svg\b[^>]*>/, "")
          .replace(/<\/svg>$/, "");
        parts.push(
          `<g${shadowFilter} opacity="${opacity}" transform="translate(${n(r.left - origin.left)} ${n(r.top - origin.top)}) scale(${n(r.width / vb[2])} ${n(r.height / vb[3])}) translate(${-vb[0]} ${-vb[1]})">${content}</g>`,
        );
        return;
      }
      if (el.localName === "img") {
        const query = el.getAttribute("data-query"),
          alt = el.getAttribute("alt") || query;
        if (!query?.trim())
          throw Error("HTML images require data-query and alt, without src.");
        const radius =
          (parseFloat(cs.borderTopLeftRadius) || 0) *
          (cs.borderTopLeftRadius.includes("%") ? r.width / 100 : 1);
        const radiusY =
          (parseFloat(cs.borderTopLeftRadius) || 0) *
          (cs.borderTopLeftRadius.includes("%") ? r.height / 100 : 1);
        if (
          [
            "borderTopRightRadius",
            "borderBottomRightRadius",
            "borderBottomLeftRadius",
          ].some((key) => cs[key] !== cs.borderTopLeftRadius)
        )
          warn(
            "Nonuniform image corner radii use the top-left corner radius in native slides.",
          );
        const clipId = `html-image-clip-${imageIndex}`;
        if (radius)
          parts.push(
            `<defs><clipPath id="${clipId}"><rect ${rectAttrs(r)} rx="${radius}" ry="${radiusY}"/></clipPath></defs>`,
          );
        parts.push(
          `<image${el.id.startsWith("!!") ? ` id="${escape(el.id)}:image"` : ""}${shadowFilter} ${rectAttrs(r)} opacity="${opacity}" ${radius ? `clip-path="url(#${clipId})"` : ""} data-query="${escape(query)}" aria-label="${escape(alt)}" preserveAspectRatio="${cs.objectFit === "contain" ? "xMidYMid meet" : cs.objectFit === "fill" ? "none" : "xMidYMid slice"}"/>`,
        );
        if (++imageIndex > 8)
          throw Error("Use at most eight images in a deck.");
        return;
      }
      const border = ["Top", "Right", "Bottom", "Left"].map((side) => ({
        width: parseFloat(cs[`border${side}Width`]),
        style: cs[`border${side}Style`],
        color: cs[`border${side}Color`],
      }));
      const stroke = border[0];
      const uniformBorder = border.every(
        (b) =>
          b.width === stroke.width &&
          (!b.width || (b.color === stroke.color && b.style === stroke.style)),
      );
      const dash = (style) =>
        style === "dashed"
          ? ' stroke-dasharray="8 5"'
          : style === "dotted"
            ? ' stroke-dasharray="1 3"'
            : "";
      if (
        border.some(
          (b) =>
            b.width &&
            !["solid", "dashed", "dotted", "none", "hidden"].includes(b.style),
        )
      )
        warn(
          "Decorative border styles were approximated as solid editable borders.",
        );
      if (!uniformBorder)
        warn(
          "Nonuniform HTML borders were converted to separate editable edge lines.",
        );
      const radii = ["TopLeft", "TopRight", "BottomRight", "BottomLeft"].map(
        (c) => cs[`border${c}Radius`],
      );
      if (
        radii.some((v) => v !== radii[0]) ||
        radii.some((v) => v.includes(" "))
      )
        warn(
          "Nonuniform corner radii use the top-left corner radius in native slides.",
        );
      const radius = parseFloat(radii[0]) || 0;
      const rx = radius * (radii[0].includes("%") ? r.width / 100 : 1);
      const ry = radius * (radii[0].includes("%") ? r.height / 100 : 1);
      if (n(r.width) > 0 && n(r.height) > 0 && (!transparent(cs.backgroundColor) || (uniformBorder && stroke.width))) {
        const shapeId = el.id.startsWith('!!') ? ` id="${escape(el.id)}:box"` : el.localName === 'div' && !el.textContent.trim() && !transparent(cs.backgroundColor) ? ` id="html-decoration-${++id}"` : '';
        const geometry = `rect ${rectAttrs(r)} rx="${rx}" ry="${ry}"`;
        parts.push(`<${geometry}${shapeId}${shadowFilter} fill="${transparent(cs.backgroundColor) ? 'none' : escape(cs.backgroundColor)}" stroke="${uniformBorder && stroke.width ? escape(stroke.color) : 'none'}" stroke-width="${uniformBorder ? stroke.width : 0}"${dash(stroke.style)} opacity="${opacity}"/>`);
      }
      if (el === page && el.hasAttribute('data-desq-background-gradients')) {
        const layers = slideBackgroundLayers(el.getAttribute('data-desq-background-gradients'), doc);
        if (!layers) warn('Some slide background gradients could not be converted.');
        else for (const layer of layers) {
          const gradientId = `html-background-gradient-${++id}`;
          const stops = layer.stops.map(stop => `<stop offset="${n(stop.offset)}" stop-color="${escape(stop.color)}"/>`).join('');
          let x = 0, y = 0, width = r.width, height = r.height, definition;
          if (layer.type === 'linear') {
            const angle = layer.angle * Math.PI / 180, dx = Math.cos(angle) / 2, dy = Math.sin(angle) / 2;
            definition = `<linearGradient id="${gradientId}" x1="${n(.5-dx)}" y1="${n(.5-dy)}" x2="${n(.5+dx)}" y2="${n(.5+dy)}">${stops}</linearGradient>`;
          } else {
            const cx = layer.cx * r.width, cy = layer.cy * r.height;
            let rx = Math.max(cx, r.width - cx), ry = Math.max(cy, r.height - cy);
            if (layer.circle) rx = ry = Math.hypot(rx, ry);
            else { rx *= Math.SQRT2; ry *= Math.SQRT2; }
            x = cx - rx; y = cy - ry; width = rx * 2; height = ry * 2;
            definition = `<radialGradient id="${gradientId}" cx=".5" cy=".5" fx=".5" fy=".5" r=".5">${stops}</radialGradient>`;
          }
          parts.push(`<defs>${definition}</defs><rect x="${n(x)}" y="${n(y)}" width="${n(width)}" height="${n(height)}" fill="url(#${gradientId})"/>`);
        }
      }
      if (!uniformBorder) {
        const x = r.left - origin.left,
          y = r.top - origin.top;
        const edges = [
          [x, y + border[0].width / 2, x + r.width, y + border[0].width / 2],
          [
            x + r.width - border[1].width / 2,
            y,
            x + r.width - border[1].width / 2,
            y + r.height,
          ],
          [
            x,
            y + r.height - border[2].width / 2,
            x + r.width,
            y + r.height - border[2].width / 2,
          ],
          [x + border[3].width / 2, y, x + border[3].width / 2, y + r.height],
        ];
        for (const [i, b] of border.entries())
          if (b.width && !["none", "hidden"].includes(b.style)) {
            const [x1, y1, x2, y2] = edges[i];
            parts.push(
              `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" fill="none" stroke="${escape(b.color)}" stroke-width="${b.width}"${dash(b.style)} opacity="${opacity}"/>`,
            );
          }
      }
      // CSS paints positioned decorations after normal-flow content, even
      // when those decorations appear earlier in the DOM (e.g. calendar holes).
      const paintOrder = node => {
        if (node.nodeType !== 1) return [1, 0];
        const style = view.getComputedStyle(node);
        const positioned = style.position !== 'static';
        const stackingContext = node.hasAttribute('data-desq-stacking-context');
        const parentDisplay = view.getComputedStyle(node.parentElement).display;
        const canStack = positioned || /flex|grid/.test(parentDisplay);
        const z = canStack && style.zIndex !== 'auto' ? Number(style.zIndex) : 0;
        if (Number.isFinite(z) && z < 0) return [0, z];
        if (Number.isFinite(z) && z > 0) return [3, z];
        return [positioned || stackingContext || (canStack && style.zIndex !== 'auto') ? 2 : 1, 0];
      };
      const children = [...el.childNodes].map((node, index) => ({ node, index, order: paintOrder(node) }));
      children.sort((a, b) => a.order[0] - b.order[0] || a.order[1] - b.order[1] || a.index - b.index);
      for (const { node } of children) walk(node, opacity);
      if (isGroup) parts.push("</g>");
    }
    walk(page);
    for (const [block, group] of textGroups) {
      const lineHeight =
        parseFloat(view.getComputedStyle(block).lineHeight) ||
        parseFloat(view.getComputedStyle(block).fontSize) * 1.2;
      const lines = [];
      for (const run of group.rows) {
        let line = lines.at(-1);
        if (!line || Math.abs(line.y - run.y) > 0.5) {
          line = { x: run.x, y: run.y, right: run.right, runs: [] };
          lines.push(line);
        }
        line.right = Math.max(line.right, run.right);
        line.runs.push(run);
      }
      const align = view.getComputedStyle(block).textAlign;
      const anchor = ["center", "-webkit-center"].includes(align)
        ? "middle"
        : ["right", "end", "-webkit-right"].includes(align)
          ? "end"
          : "start";
      const xFor = (line) =>
        anchor === "middle"
          ? (line.x + line.right) / 2
          : anchor === "end"
            ? line.right
            : line.x;
      parts[group.index] =
        `<text id="${block.id.startsWith("!!") ? escape(block.id) + ":text" : "html-text-" + group.id}" xml:space="preserve" text-anchor="${anchor}" data-paragraph-line-height="${n(lineHeight)}">${lines.map((line) => `<tspan x="${n(xFor(line))}" y="${n(line.y)}">${line.runs.map((run) => `<tspan ${run.attrs}>${escape(run.value)}</tspan>`).join("")}</tspan>`).join("")}</text>`;
    }
    if (!parts.length) throw Error("HTML slide is empty.");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">${stageWidth === 1280 ? parts.join("") : `<g transform="scale(${1280 / stageWidth})">${parts.join("")}</g>`}</svg>`;
    if (svg.length > 80000)
      throw Error(
        "HTML slide produces too many native objects. Simplify its text and geometry.",
      );
    return svg;
  } finally {
    frame.remove();
  }
}
