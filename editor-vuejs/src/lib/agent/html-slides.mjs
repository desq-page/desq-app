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
  "section div article header footer main aside h1 h2 h3 h4 h5 h6 p span strong b em i u s small br ul ol li table thead tbody tfoot tr th td img style".split(
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
  if (typeof html !== "string" || !html.trim() || html.length > 80000)
    throw Error("Return one complete HTML section, at most 80,000 characters.");
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
    .filter((el) => el.localName !== "style")
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
      ["textShadow", "text-shadow"],
      ["clipPath", "clip-path"],
      ["maskImage", "mask-image"],
      ["backgroundImage", "background-image"],
    ]) {
      if (cs[key] && cs[key] !== "none") {
        const value = cs[key];
        el.style.setProperty(css, "none", "important");
        if (
          key === "backgroundImage" &&
          /gradient\(/.test(value) &&
          transparent(cs.backgroundColor)
        ) {
          const color = value.match(/rgba?\([^)]*\)|#[\da-f]{3,8}\b/i)?.[0];
          if (color)
            el.style.setProperty("background-color", color, "important");
        }
        warn(
          `HTML ${key} was approximated or omitted; native content remains editable.`,
        );
      }
    }
    if (cs.mixBlendMode !== "normal" || cs.isolation === "isolate")
      warn("HTML blend/isolation effects were omitted.");
    if (cs.zIndex !== "auto" || cs.order !== "0")
      warn(
        "HTML stacking uses document paint order; positions retain browser layout.",
      );
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
    "position:fixed;left:-20000px;top:0;width:1280px;height:720px;border:0;visibility:hidden;pointer-events:none";
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
      "html,body{margin:0;padding:0;width:1280px;height:720px}*{box-sizing:border-box}h1,h2,h3,h4,h5,h6,p{margin:0}section{position:relative}img{display:block}";
    doc.head.append(reset);
    // Reuse already loaded host FontFaces so browser measurement and native text agree.
    document.fonts?.forEach((face) => {
      if (face.status === "loaded") doc.fonts.add(face);
    });
    const page = doc.importNode(root, true);
    doc.body.append(page);
    prepareLayout?.(page, doc);
    materializePseudoElements(page, doc, warn);
    approximatePresentationStyles(page, doc, warn);
    inspectLayout?.(page, doc);
    const view = doc.defaultView,
      origin = page.getBoundingClientRect();
    if (
      Math.abs(origin.width - 1280) > 1 ||
      Math.abs(origin.height - 720) > 1 ||
      origin.x !== 0 ||
      origin.y !== 0
    )
      throw Error(
        "HTML section must be positioned at 0,0 and measure exactly 1280×720 pixels.",
      );
    const parts = [],
      textGroups = new Map();
    let imageIndex = 0,
      id = 0;
    const bounds = (rect, label) => {
      if (
        rect.left < origin.left - 1 ||
        rect.top < origin.top - 1 ||
        rect.right > origin.right + 1 ||
        rect.bottom > origin.bottom + 1
      )
        throw Object.assign(new Error(
          `HTML ${label} overflows the 1280×720 canvas. Shorten it or adjust its box.`,
        ), { code: "HTML_SLIDE_OVERFLOW" });
    };
    const rectAttrs = (rect) =>
      `x="${n(rect.left - origin.left)}" y="${n(rect.top - origin.top)}" width="${n(rect.width)}" height="${n(rect.height)}"`;
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
        const attrs = `font-family="${escape(cs.fontFamily)}" font-size="${n(size)}" font-weight="${cs.fontWeight}" font-style="${cs.fontStyle}" fill="${escape(cs.color)}" opacity="${opacity}"${cs.textDecorationLine !== "none" ? ` text-decoration="${escape(cs.textDecorationLine)}"` : ""}`;
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
        el.clientWidth &&
        el.clientHeight &&
        ((cs.overflowX !== "visible" && el.scrollWidth > el.clientWidth + 1) ||
          (cs.overflowY !== "visible" && el.scrollHeight > el.clientHeight + 1))
      )
        throw Object.assign(new Error(
          `HTML ${el.localName} content overflows its clipped box (${el.scrollWidth}×${el.scrollHeight} inside ${el.clientWidth}×${el.clientHeight}). ${el === page ? "Keep the section exactly 1280×720; reduce content or vertical spacing rather than enlarging the canvas." : "Enlarge the inner box within the canvas or shorten its text."}`,
        ), { code: "HTML_SLIDE_OVERFLOW" });
      if (r.width && r.height) bounds(r, el.localName);
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
        const content = new view.XMLSerializer()
          .serializeToString(el)
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
      if (!transparent(cs.backgroundColor) || (uniformBorder && stroke.width)) {
        parts.push(
          `<rect${el.id.startsWith("!!") ? ` id="${escape(el.id)}:box"` : ""}${shadowFilter} ${rectAttrs(r)} rx="${rx}" ry="${ry}" fill="${transparent(cs.backgroundColor) ? "none" : escape(cs.backgroundColor)}" stroke="${uniformBorder && stroke.width ? escape(stroke.color) : "none"}" stroke-width="${uniformBorder ? stroke.width : 0}"${dash(stroke.style)} opacity="${opacity}"/>`,
        );
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
              `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${escape(b.color)}" stroke-width="${b.width}"${dash(b.style)} opacity="${opacity}"/>`,
            );
          }
      }
      for (const child of el.childNodes) walk(child, opacity);
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
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">${parts.join("")}</svg>`;
    if (svg.length > 80000)
      throw Error(
        "HTML slide produces too many native objects. Simplify its text and geometry.",
      );
    return svg;
  } finally {
    frame.remove();
  }
}
