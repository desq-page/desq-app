import { authoredTextWidthPadding } from "./deck-text.mjs";
import { getRunText, withRunText } from "shared-vuejs/api/lib-text-run-text";
import { fitGeneratedTextFrames } from './generated-text-frames.mjs';
import { imagePlaceholderCaption } from './image-search-caption.mjs';
import { mergeNativeParagraphs } from './ppt-master-native-paragraphs.mjs';
import { groupSVGParagraphs } from "./ppt-master-paragraphs.mjs";
// JavaScript native-object port of PPT Master's SVG traversal, affine geometry and paint pipeline.
// Upstream MIT: Hugo He. Sources pinned in third_party/ppt-master/PROVENANCE.json; license retained there.
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { SVGPathData } from "svg-pathdata";
import { editorColor } from "./colors.mjs";
import { resolveAutoshape } from "./autoshape-catalog.mjs";
import { wrapDeckText } from "./deck-text.mjs";
import { drawingmlEffects } from "./ppt-master-effects.mjs";
import { completePresetAdjustments } from "./ppt-master-formula.mjs";
import { nativeShapeStyle } from "./ppt-master-native.mjs";
import {
  fontFaces,
  textBaseline,
  normalizeTextRuns,
} from "./ppt-master-text.mjs";
import { nativeObject, nativePayload } from "./ppt-master-objects.mjs";
import { compileLatex } from "./ppt-master-math.mjs";
import { applyBooleanOperations, booleanPaths } from "./ppt-master-boolean.mjs";

const I = [1, 0, 0, 1, 0, 0];
// drawingml/utils.py: matrix_multiply (right applied before left).
export function multiply(l, r) {
  const [a, b, c, d, e, f] = l,
    [g, h, i, j, k, m] = r;
  return [
    a * g + c * h,
    b * g + d * h,
    a * i + c * j,
    b * i + d * j,
    a * k + c * m + e,
    b * k + d * m + f,
  ];
}
const point = (m, x, y) => [
  m[0] * x + m[2] * y + m[4],
  m[1] * x + m[3] * y + m[5],
];
const number = (raw, fallback = 0) => {
  if (raw === undefined) return fallback;
  if (!/^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?(?:px)?$/i.test(String(raw)))
    throw Error(`Unsupported SVG length: ${raw}`);
  const value = parseFloat(raw);
  if (!Number.isFinite(value) || Math.abs(value) > 1e6)
    throw Error("Invalid SVG number.");
  return value;
};
export function parseTransform(raw = "") {
  let matrix = I,
    end = 0;
  for (const match of raw.matchAll(/([a-z]+)\(([^()]*)\)/gi)) {
    if (raw.slice(end, match.index).replace(/[\s,]/g, ""))
      throw Error("Invalid SVG transform.");
    const n = match[2]
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map((v) => number(v));
    let op;
    if (match[1] === "translate" && [1, 2].includes(n.length))
      op = [1, 0, 0, 1, n[0], n[1] || 0];
    else if (match[1] === "scale" && [1, 2].includes(n.length))
      op = [n[0], 0, 0, n[1] ?? n[0], 0, 0];
    else if (match[1] === "matrix" && n.length === 6) op = n;
    else if (match[1] === "rotate" && [1, 3].includes(n.length)) {
      const angle = (n[0] * Math.PI) / 180,
        c = Math.cos(angle),
        s = Math.sin(angle),
        x = n[1] || 0,
        y = n[2] || 0;
      op = [c, s, -s, c, x - c * x + s * y, y - s * x - c * y];
    } else throw Error(`Unsupported SVG transform: ${match[1]}`);
    matrix = multiply(matrix, op);
    end = match.index + match[0].length;
  }
  if (raw.slice(end).replace(/[\s,]/g, ""))
    throw Error("Invalid SVG transform.");
  return matrix;
}
const tagOf = (node) => Object.keys(node).find((k) => k !== ":@");
const attr = (node) => node[":@"] || {};
const children = (node) => node[tagOf(node)] || [];
const parser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: "",
  trimValues: false,
  parseTagValue: false,
  processEntities: true,
  ignoreDeclaration: true,
});
export function parsePageSVG(svg) {
  if (typeof svg !== "string" || !svg.trim()) throw Error("Page SVG must be a nonempty string.");
  if (svg.length > 80000)
    throw Error(`Page SVG is too large (${svg.length.toLocaleString('en-US')} characters; maximum 80,000). Simplify the SVG and return the complete slide.`);
  if (/<!DOCTYPE|<!ENTITY/i.test(svg))
    throw Error("Page SVG cannot contain DOCTYPE or ENTITY declarations. Return a standalone SVG without document type or custom entities.");
  // Validate before parsing: the parser ignores ordinary comments and the XML
  // declaration, while malformed comments/XML must still fail. Never strip
  // comments with a regex, which could corrupt literal text inside CDATA.
  for (const [token] of svg.matchAll(/<!\[CDATA\[[\s\S]*?\]\]>|<!--[\s\S]*?-->/g)) {
    if (token.startsWith('<!--') && /--|-$/.test(token.slice(4, -3)))
      throw Error("Malformed page SVG comment. Comments cannot contain double hyphens.");
  }
  if (XMLValidator.validate(svg) !== true) throw Error("Malformed page SVG. Return well-formed XML with escaped text and closed tags.");
  const withoutHeader = svg.trim().replace(/^<\?xml\s[^?]*\?>/i, '');
  if (/<\?/.test(withoutHeader))
    throw Error("Page SVG cannot contain processing instructions other than a leading XML declaration.");
  const roots = parser.parse(svg);
  if (roots.length !== 1 || tagOf(roots[0]) !== "svg")
    throw Error("A page must contain exactly one SVG root.");
  const view = String(attr(roots[0]).viewBox || "")
    .trim()
    .split(/[\s,]+/)
    .map((v) => number(v));
  if (
    view.length !== 4 ||
    view[0] !== 0 ||
    view[1] !== 0 ||
    view[2] !== 1280 ||
    view[3] !== 720
  )
    throw Error('Page SVG requires viewBox="0 0 1280 720".');
  return roots[0];
}
const inheritedKeys = new Set([
  "fill",
  "fill-opacity",
  "stroke",
  "stroke-opacity",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "font-size",
  "font-family",
  "font-weight",
  "font-style",
  "text-decoration",
  "xml:space",
  "text-anchor",
  "letter-spacing",
  "filter",
  "stroke-dasharray",
  "marker-start",
  "marker-end",
  "vector-effect",
  "data-savanna-hyperlink",
  "visibility",
  "color",
]);
function style(a, parent) {
  const out = Object.fromEntries(
    Object.entries(parent).filter(([k]) => inheritedKeys.has(k)),
  );
  Object.assign(out, a);
  for (const declaration of String(a.style || "")
    .split(";")
    .filter((s) => s.trim())) {
    const split = declaration.indexOf(":");
    if (split < 1) throw Error("Invalid inline SVG style.");
    out[declaration.slice(0, split).trim()] = declaration
      .slice(split + 1)
      .trim();
  }
  for (const key of Object.keys(out))
    if (key === "mask")
      throw Error(
        "PPT Master's SVG contract rejects arbitrary masks; use native picture clip geometry or DrawingML effects.",
      );
    else if (/^on/i.test(key) || ["mask", "class"].includes(key))
      throw Error(`Unsupported SVG attribute: ${key}`);
  return out;
}
const opacity = (raw) => {
  const n = String(raw).endsWith("%")
    ? number(String(raw).slice(0, -1)) / 100
    : number(raw, 1);
  if (n < 0 || n > 1) throw Error("SVG opacity must be between zero and one.");
  return n;
};
function color(raw, alpha = 1) {
  let value = String(raw || "#000000");
  if (value === "transparent") {
    value = "#000000";
    alpha = 0;
  }
  if (/^#[a-f0-9]{4}$/i.test(value))
    value = "#" + [...value.slice(1)].map((c) => c + c).join("");
  if (/^#[a-f0-9]{8}$/i.test(value)) {
    alpha *= parseInt(value.slice(7), 16) / 255;
    value = value.slice(0, 7);
  }
  const rgb = /^rgba?\(([^)]+)\)$/i.exec(value);
  if (rgb) {
    const parts = rgb[1].split(/\s*[,/]\s*|\s+/).filter(Boolean);
    if (parts.length < 3 || parts.length > 4)
      throw Error("Invalid SVG RGB color.");
    const channels = parts
      .slice(0, 3)
      .map((v) =>
        Math.max(
          0,
          Math.min(
            255,
            Math.round(
              v.endsWith("%") ? number(v.slice(0, -1)) * 2.55 : number(v),
            ),
          ),
        ),
      );
    value = "#" + channels.map((v) => v.toString(16).padStart(2, "0")).join("");
    if (parts[3] !== undefined)
      alpha *= parts[3].endsWith("%")
        ? number(parts[3].slice(0, -1)) / 100
        : opacity(parts[3]);
  }
  if (/^#[a-f0-9]{3}$/i.test(value))
    value = "#" + [...value.slice(1)].map((c) => c + c).join("");
  const result = editorColor(value);
  alpha = Math.max(0, Math.min(1, alpha));
  if (alpha < 1) result.uniClr.alpha = { $_val: Math.round(alpha * 100000) };
  return result;
}
export function svgImageRequests(svg, page) {
  let imageIndex=0;
  const requests = [],
    root = parsePageSVG(svg),
    defs = new Map();
  const index = (n) => {
    if (attr(n).id) defs.set(attr(n).id, n);
    for (const c of children(n)) if (tagOf(c) !== "#text") index(c);
  };
  index(root);
  const walk = (n, depth = 0, parent = {}) => {
    if (depth > 32) throw Error("SVG use limit exceeded.");
    const presentation = style(attr(n), parent);
    if (
      presentation.display === "none" ||
      ["hidden", "collapse"].includes(presentation.visibility)
    )
      return;
    if (tagOf(n) === "defs") return;
    if (
      presentation["data-pptx-replace-with"] ||
      presentation["data-pptx-native"]
    )
      return;
    if (tagOf(n) === "use") {
      const href = attr(n).href || attr(n)["xlink:href"];
      const target = defs.get(String(href).slice(1));
      if (!String(href).startsWith("#") || !target)
        throw Error("Invalid local SVG use.");
      walk(target, depth + 1, presentation);
      return;
    }
    if (tagOf(n) === "image") {
      const a = attr(n),key=`${page}:svg:${imageIndex++}`;
      if (!a["data-query"]?.trim() || !(a["aria-label"] || a["data-alt"])?.trim())return;
      if (
        a["data-query"].length > 160 ||
        String(a["aria-label"] || a["data-alt"]).length > 200
      )
        return;
      requests.push({
        key,
        image: {
          query: a["data-query"],
          alt: a["aria-label"] || a["data-alt"],
        },
      });
    }
    for (const c of children(n))
      if (tagOf(c) !== "#text") walk(c, depth + 1, presentation);
  };
  walk(root);
  return requests;
}

export function compilePageSVG(
  svg,
  {
    width,
    height,
    genId,
    geometry,
    assets = new Map(),
    pageIndex = 0,
    measureText,
    booleans,
    outlineText,
    deferTextOutlines = false,
    language = "en-US",
  },
) {
  const root = groupSVGParagraphs(parsePageSVG(svg)),
    shapes = [],
    definitions = new Map(), textContainers = [];
  const imageWarnings=[],usedImageKeys=new Set();
  let visits = 0,
    imageIndex = 0;
  let sourceIds = [];
  const index = (n) => {
    const a = attr(n);
    if (a.id) {
      if (definitions.has(a.id)) throw Error("Duplicate SVG id.");
      definitions.set(a.id, n);
    }
    for (const c of children(n)) if (tagOf(c) !== "#text") index(c);
  };
  index(root);
  const baseMatrix = [width / 1280, 0, 0, height / 720, 0, 0];
  const paint = (raw, alpha) => {
    if (raw === "none") return { noFill: true };
    const ref = /^url\(#([^\s)]+)\)$/.exec(raw || "");
    if (!ref) return { solidFill: color(raw, alpha) };
    const def = definitions.get(ref[1]);
    if (def && tagOf(def) === "pattern") {
      const a = attr(def),
        entries = [];
      for (const node of children(def))
        if (tagOf(node) !== "#text") {
          const s = style(attr(node), {});
          for (const name of ["fill", "stroke"])
            if (s[name] && s[name] !== "none")
              entries.push({
                name,
                tag: tagOf(node),
                value: s[name],
                alpha:
                  alpha * opacity(s.opacity) * opacity(s[`${name}-opacity`]),
              });
        }
      const bg = entries.find((e) => e.name === "fill" && e.tag === "rect"),
        fg =
          entries.find((e) => e.name === "stroke") ||
          entries.find((e) => e !== bg);
      if (!a["data-pptx-fg"] && !fg)
        throw Error("Native pattern needs foreground metadata or child paint.");
      const prst = a["data-pptx-pattern"] || "ltUpDiag";
      if (!/^[A-Za-z][A-Za-z0-9]{1,32}$/.test(prst))
        throw Error("Invalid DrawingML pattern preset.");
      return {
        pattFill: {
          $_prst: prst,
          fgClr: color(a["data-pptx-fg"] || fg.value, fg?.alpha ?? alpha),
          bgClr: color(
            a["data-pptx-bg"] || bg?.value || "#FFFFFF",
            bg?.alpha ?? alpha,
          ),
        },
      };
    }
    if (!def || !["linearGradient", "radialGradient"].includes(tagOf(def)))
      throw Error("Paint requires a local gradient definition.");
    const a = attr(def);
    if (
      a.gradientTransform ||
      (a.gradientUnits && a.gradientUnits !== "objectBoundingBox")
    )
      throw Error("Unsupported gradient coordinate system.");
    const fraction = (v, d) =>
      v === undefined
        ? d
        : String(v).endsWith("%")
          ? number(String(v).slice(0, -1)) / 100
          : number(v);
    const dx = fraction(a.x2, 1) - fraction(a.x1, 0),
      dy = fraction(a.y2, 0) - fraction(a.y1, 0);
    const stops = children(def)
      .filter((n) => tagOf(n) === "stop")
      .map((n) => {
        const s = style(attr(n), {});
        const offset = fraction(s.offset, 0);
        if (offset < 0 || offset > 1) throw Error("Invalid gradient stop.");
        return {
          $_pos: Math.round(offset * 100000),
          ...color(s["stop-color"], alpha * opacity(s["stop-opacity"])),
        };
      });
    if (stops.length < 2 || stops.length > 16)
      throw Error("Gradient needs 2–16 stops.");
    if (tagOf(def) === "radialGradient") {
      const fx = fraction(a.fx ?? a.cx, 0.5),
        fy = fraction(a.fy ?? a.cy, 0.5);
      if ((fx - 0.5) ** 2 + (fy - 0.5) ** 2 > 0.25 + 1e-10)
        throw Error(
          "Radial gradient focus lies outside the upstream canonical circle.",
        );
      return {
        gradFill: {
          gsLst: { gs: stops },
          path: {
            $_path: "circle",
            fillToRect: {
              $_l: Math.round(fx * 100000),
              $_t: Math.round(fy * 100000),
              $_r: Math.round((1 - fx) * 100000),
              $_b: Math.round((1 - fy) * 100000),
            },
          },
        },
      };
    }
    return {
      gradFill: {
        gsLst: { gs: stops },
        lin: {
          $_ang: Math.round(
            (((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360) * 60000,
          ),
          $_scaled: 1,
        },
      },
    };
  };
  const hyperlink = (raw) => {
    if (!raw) return undefined;
    if (
      !/^(https?:\/\/|mailto:)/i.test(raw) &&
      !/^ppaction:\/\/hlinkshowjump\?jump=(firstslide|lastslide|nextslide|previousslide|endshow)$/.test(
        raw,
      )
    )
      throw Error("Unsupported or unsafe hyperlink target.");
    return raw;
  };
  const push = (s) => {
    if (shapes.length >= 500) throw Error("Page has too many native objects.");
    if (![s.x, s.y, s.w, s.h].every(Number.isFinite))
      throw Error("Invalid native SVG bounds.");
    // Preserve explicit Morph identity even when an image becomes a placeholder.
    const morphName = sourceIds.at(-1);
    shapes.push({ ...s, ...(morphName?.startsWith("!!") ? { name: morphName } : {}), sourceIds: [...sourceIds] });
  };
  const effects = (a, alpha) => {
    if (!a.filter || a.filter === "none") return undefined;
    const ref = /^url\(#([^\s)]+)\)$/.exec(a.filter),
      definition = ref && definitions.get(ref[1]);
    if (!definition || tagOf(definition) !== "filter")
      throw Error("Missing local SVG filter definition.");
    return drawingmlEffects(definition, alpha, color);
  };
  const frame = (m, x, y, w, h) => {
    const sx = Math.hypot(m[0], m[1]),
      sy = (m[0] * m[3] - m[1] * m[2]) / sx;
    if (
      !sx ||
      !sy ||
      Math.abs(m[0] * m[2] + m[1] * m[3]) > 1e-7 * sx * Math.abs(sy)
    )
      throw Error("Sheared frame requires upstream freeform conversion.");
    const [cx, cy] = point(m, x + w / 2, y + h / 2),
      nw = w * sx,
      nh = h * Math.abs(sy);
    return {
      x: cx - nw / 2,
      y: cy - nh / 2,
      w: nw,
      h: nh,
      rot: (Math.atan2(m[1], m[0]) * 180) / Math.PI,
      ...(sy < 0 ? { flipV: true } : {}),
    };
  };
  const pictureClip = (a, m) => {
    if (!a["clip-path"] || a["clip-path"] === "none") return {};
    const ref = /^url\(#([^\s)]+)\)$/.exec(a["clip-path"]),
      clip = ref && definitions.get(ref[1]);
    if (!clip || tagOf(clip) !== "clipPath")
      throw Error("Missing local picture clipPath.");
    const visible = children(clip).filter(
      (n) => !["#text", "title", "desc"].includes(tagOf(n)),
    );
    if (visible.length !== 1)
      throw Error("PPT Master picture clipping needs exactly one contour.");
    const node = visible[0],
      ca = style(attr(node), {}),
      tag = tagOf(node),
      obb = attr(clip).clipPathUnits === "objectBoundingBox";
    if(attr(clip).clipPathUnits&&!['objectBoundingBox','userSpaceOnUse'].includes(attr(clip).clipPathUnits))throw Error('Invalid picture clipPathUnits.');
    if (ca.transform || attr(clip).transform)
      throw Error("Clip transforms require upstream contour baking.");
    const x = obb ? 0 : number(a.x),
      y = obb ? 0 : number(a.y),
      w = obb ? 1 : number(a.width),
      h = obb ? 1 : number(a.height);
    const local = frame(m, 0, 0, number(a.width), number(a.height));
    let prstGeom, d, contour;
    const length=(value,fallback=0)=>obb&&String(value).endsWith('%')?number(String(value).slice(0,-1))/100:number(value,fallback);
    const close = (a, b) => Math.abs(a - b) < 1e-6;
    if (["rect", "circle", "ellipse"].includes(tag)) {
      let fits,rx,ry;
      if (tag === "rect"){
        const cx=length(ca.x),cy=length(ca.y),cw=length(ca.width),ch=length(ca.height);
        if(cw<=0||ch<=0)throw Error('Picture clip rectangles need positive dimensions.');
        rx=Math.min(length(ca.rx,length(ca.ry)),cw/2);
        ry=Math.min(length(ca.ry,length(ca.rx)),ch/2);
        if(rx<0||ry<0)throw Error('Picture clip corner radii must be nonnegative.');
        fits =
          close(cx, x) && close(cy, y) && close(cw, w) && close(ch, h) &&
          close(rx*(obb?number(a.width):1),ry*(obb?number(a.height):1));
        contour=rx&&ry?`M${cx+rx},${cy}H${cx+cw-rx}A${rx},${ry} 0 0 1 ${cx+cw},${cy+ry}V${cy+ch-ry}A${rx},${ry} 0 0 1 ${cx+cw-rx},${cy+ch}H${cx+rx}A${rx},${ry} 0 0 1 ${cx},${cy+ch-ry}V${cy+ry}A${rx},${ry} 0 0 1 ${cx+rx},${cy}Z`:`M${cx},${cy}H${cx+cw}V${cy+ch}H${cx}Z`;
      }else{
        const cx=length(ca.cx),cy=length(ca.cy);
        rx=length(ca.rx,length(ca.r));ry=length(ca.ry,length(ca.r));
        if(rx<=0||ry<=0)throw Error('Picture clip ellipses need positive radii.');
        fits =
          close(cx,x+w/2)&&close(cy,y+h/2)&&close(rx,w/2)&&close(ry,h/2);
        contour=`M${cx-rx},${cy}A${rx},${ry} 0 1 0 ${cx+rx},${cy}A${rx},${ry} 0 1 0 ${cx-rx},${cy}Z`;
      }
      if (fits&&tag === "rect") {
        const radius =
          rx * (obb ? number(a.width) : 1);
        prstGeom = {
          $_prst: radius ? "roundRect" : "rect",
          avLst: radius
            ? {
                gd: [
                  {
                    $_name: "adj",
                    $_fmla: `val ${Math.round(Math.min(radius / Math.min(number(a.width), number(a.height)), 0.5) * 100000)}`,
                  },
                ],
              }
            : {},
        };
      } else if(fits)prstGeom = { $_prst: "ellipse", avLst: {} };
      if(prstGeom)d = geometry(prstGeom, local.w, local.h)?.d;
    }
    if(!prstGeom&&["rect","circle","ellipse","path", "polygon"].includes(tag)) {
      let path = contour||ca.d;
      if (tag === "polygon") {
        const pts = String(ca.points || "")
          .trim()
          .split(/[\s,]+/)
          .map((v) => length(v));
        if (pts.length < 6 || pts.length % 2)
          throw Error("Invalid polygon clip.");
        path = `M${pts[0]},${pts[1]}`;
        for (let i = 2; i < pts.length; i += 2)
          path += `L${pts[i]},${pts[i + 1]}`;
        path += "Z";
      }
      const sx = local.w / (obb ? 1 : number(a.width)),
        sy = local.h / (obb ? 1 : number(a.height));
      d = new SVGPathData(path)
        .toAbs()
        .normalizeHVZ(false)
        .normalizeST()
        .qtToC()
        .aToC()
        .matrix(
          sx,
          0,
          0,
          sy,
          obb ? 0 : -number(a.x) * sx,
          obb ? 0 : -number(a.y) * sy,
        )
        .encode();
      const bounds=new SVGPathData(d).getBounds();
      if(contour&&(bounds.minX<0||bounds.minY<0||bounds.maxX>local.w||bounds.maxY>local.h)){
        const clipped=booleanPaths('intersect',[d,`M0 0H${local.w}V${local.h}H0Z`]);
        if(!clipped.length)throw Error('Picture clip does not intersect the picture frame.');
        d=clipped.join('');
      }
    } else if(!prstGeom)throw Error(`Unsupported upstream picture clip contour: ${tag}`);
    if (!d) throw Error("Cannot compile native picture clipping geometry.");
    return { d, ...(prstGeom ? { prstGeom } : {}) };
  };
  const lineDetails = (a) => {
    const result = {};
    if (a["stroke-dasharray"] && a["stroke-dasharray"] !== "none") {
      const values = a["stroke-dasharray"]
        .trim()
        .split(/[\s,]+/)
        .map((v) => number(v));
      if (values.length < 2 || values.some((v) => v <= 0))
        throw Error("Dash pattern needs positive dash/gap lengths.");
      const sw = Math.max(number(a["stroke-width"], 1), 0.001);
      const preset = {
        "4,4": "dash",
        "6,3": "dash",
        "2,2": "sysDot",
        "8,4": "lgDash",
        "8,4,2,4": "lgDashDot",
      }[values.join(",")];
      if (preset) result.prstDash = { $_val: preset };
      else
        result.custDash = {
          ds: [
            {
              $_d: Math.max(1, Math.round((values[0] / sw) * 100000)),
              $_sp: Math.max(1, Math.round((values[1] / sw) * 100000)),
            },
          ],
        };
    }
    for (const [attrName, dmlName] of [
      ["marker-start", "headEnd"],
      ["marker-end", "tailEnd"],
    ])
      if (a[attrName] && a[attrName] !== "none") {
        const ref = /^url\(#([^\s)]+)\)$/.exec(a[attrName]),
          marker = ref && definitions.get(ref[1]);
        if (!marker || tagOf(marker) !== "marker")
          throw Error("Missing local line marker.");
        const nodes = children(marker).filter(
          (n) => !["#text", "title", "desc"].includes(tagOf(n)),
        );
        if (nodes.length !== 1)
          throw Error("Native line marker needs one contour.");
        const kind = tagOf(nodes[0]);
        let type;
        if (["circle", "ellipse"].includes(kind)) type = "oval";
        else if (kind === "polygon") {
          const points = String(attr(nodes[0]).points || "")
            .trim()
            .split(/[\s,]+/)
            .map(Number);
          type =
            points.length === 6
              ? "triangle"
              : points.length === 8
                ? "diamond"
                : undefined;
        } else if (kind === "path") {
          const commands = new SVGPathData(attr(nodes[0]).d)
            .toAbs()
            .normalizeHVZ().commands;
          const count = commands.filter(
            (c) =>
              c.type === SVGPathData.MOVE_TO || c.type === SVGPathData.LINE_TO,
          ).length;
          type = count === 4 ? "triangle" : count === 3 ? "arrow" : undefined;
        }
        if (!type)
          throw Error(
            "Line marker is outside the upstream native contour vocabulary.",
          );
        const ma = attr(marker),
          bucket =
            ma.markerUnits === "userSpaceOnUse"
              ? (v) => (v < 6 ? "sm" : v > 12 ? "lg" : "med")
              : (v) => (v <= 2 ? "sm" : v >= 3.5 ? "lg" : "med");
        result[dmlName] = {
          $_type: type,
          $_w: bucket(number(ma.markerHeight, 3)),
          $_len: bucket(number(ma.markerWidth, 3)),
        };
      }
    return result;
  };
  const text = (node, a, m, alpha) => {
    // Paragraph normalization marks compatible rows; independently positioned
    // labels retain separate frames, as in upstream split-flow mode.
    if (
      children(node).some(
        (c) =>
          tagOf(c) === "tspan" &&
          ["x", "y", "dx", "dy"].some((k) => attr(c)[k] !== undefined),
      )
    ) {
      const startIndex = shapes.length,
        lineFlags = [];
      let cursorX = number(a.x),
        cursorY = number(a.y);
      for (const child of children(node)) {
        if (tagOf(child) === "#text" && !String(child["#text"]).trim())
          continue;
        const childAttrs = tagOf(child) === "tspan" ? attr(child) : {};
        cursorX = number(childAttrs.x, cursorX) + number(childAttrs.dx);
        cursorY = number(childAttrs.y, cursorY) + number(childAttrs.dy);
        const resolved = {
          ...a,
          ...style(childAttrs, a),
          x: String(cursorX),
          y: String(cursorY),
        };
        delete resolved.transform;
        const chunk = {
          text: tagOf(child) === "#text" ? [child] : children(child),
          ":@": resolved,
        };
        const begin = shapes.length;
        text(chunk, resolved, m, alpha);
        if (shapes.length > begin) lineFlags.push(childAttrs);
        const scale = Math.hypot(m[0], m[1]);
        if (shapes.length > begin)
          cursorX += Math.max(
            0,
            (shapes.at(-1).w - shapes.at(-1).svgTextWidthPadding) / scale,
          );
      }
      if (a["data-paragraph-line-height"] && shapes.length > startIndex) {
        const lineHeight = number(a["data-paragraph-line-height"]);
        if (lineHeight <= 0)
          throw Error("Paragraph line height must be positive.");
        const lines = shapes.splice(startIndex),
          first = lines[0],
          sx = Math.hypot(m[0], m[1]),
          sy = Math.abs((m[0] * m[3] - m[1] * m[2]) / sx),
          scale = Math.min(sx, sy),
          paragraphs = [];
        for (const [i, line] of lines.entries()) {
          const p = line.txBody.p[0],
            flag = lineFlags[i] || {},
            previous = paragraphs.at(-1);
          if (flag["data-paragraph-line-break"] === "1" && previous)
            previous.r.push({ $_otag: "br" }, ...p.r);
          else if (flag["data-paragraph-soft-break"] === "1" && previous) {
            const before = previous.r.at(-1)?.t || "",
              after = p.r[0]?.t || "";
            if (
              before &&
              !before.endsWith(" ") &&
              !after.startsWith(" ") &&
              !/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(
                before.at(-1) + after[0],
              )
            )
              previous.r.push({
                t: " ",
                rPr: { ...previous.r.at(-1).rPr, $_spc: 0 },
              });
            previous.r.push(...p.r);
          } else {
            p.pPr = {
              ...p.pPr,
              lnSpc: { spcPts: { $_val: Math.round(lineHeight * scale * 75) } },
              ...(flag["data-paragraph-space-before"]
                ? {
                    spcBef: {
                      spcPts: {
                        $_val: Math.round(
                          number(flag["data-paragraph-space-before"]) *
                            scale *
                            75,
                        ),
                      },
                    },
                  }
                : {}),
            };
            const bullet = /^([•●▪◦‣–-])\s+/.exec(getRunText(p.r[0]));
            if (bullet) {
              p.r[0] = withRunText(p.r[0], getRunText(p.r[0]).slice(bullet[0].length));
              p.pPr.buChar = { $_char: bullet[1] };
              p.pPr.$_marL = Math.round(lineHeight * scale * 0.6 * 9525);
              p.pPr.$_indent = -Math.round(lineHeight * scale * 0.4 * 9525);
            }
            paragraphs.push(p);
          }
        }
        const offset =
          textBaseline(
            first.txBody.p[0].r.map((r) => ({
              text: getRunText(r),
              font_size: (r.rPr?.$_sz || 1800) / 75 / scale,
              font_family: r.rPr?.latin?.$_typeface,
              font_weight: r.rPr?.$_b ? "bold" : "normal",
              font_style: r.rPr?.$_i ? "italic" : "normal",
            })),
            { lineSpacingPx: lineHeight, language },
          ) * sy;
        const w = Math.max(...lines.map((l) => l.w)),
          h = Math.max(first.h, ((lines.length - 1) * lineHeight +
            lineFlags.reduce((total, flag) => total + number(flag["data-paragraph-space-before"]), 0)) * sy + first.h),
          angle = ((first.rot || 0) * Math.PI) / 180,
          dx = ((w - first.w) / 2) *
            (a["text-anchor"] === "middle" ? 0 : a["text-anchor"] === "end" ? -1 : 1) +
            (lines.reduce((a, b) => a.w > b.w ? a : b).svgTextWidthPadding - first.svgTextWidthPadding) *
            (a["text-anchor"] === "middle" ? .5 : a["text-anchor"] === "end" ? 1 : 0),
          dy =
            ((h - first.h) / 2 + (first.svgTextBaselineOffset - offset)) *
            (first.flipV ? -1 : 1),
          cx =
            first.x + first.w / 2 + Math.cos(angle) * dx - Math.sin(angle) * dy,
          cy =
            first.y + first.h / 2 + Math.sin(angle) * dx + Math.cos(angle) * dy;
        push({
          ...first,
          x: cx - w / 2,
          y: cy - h / 2,
          w,
          h,
          svgTextBaselineOffset: offset,
          svgTextWidthPadding: lines.reduce((a, b) => a.w > b.w ? a : b).svgTextWidthPadding,
          txBody: {
            ...first.txBody,
            bodyPr: {
              ...first.txBody.bodyPr,
              // Individual SVG frames reserve trailing measurement padding.
              // Exclude it from paragraph alignment so the shared anchor stays put.
              ...(a["text-anchor"] === "middle" || a["text-anchor"] === "end"
                ? { $_rIns: Math.round(lines.reduce((widest, line) => line.w > widest.w ? line : widest, first).svgTextWidthPadding * 9525) }
                : {}),
            },
            p: paragraphs.map(p => ({ ...p, pPr: {
              ...p.pPr,
              $_algn: a["text-anchor"] === "middle" ? "ctr" : a["text-anchor"] === "end" ? "r" : "l",
            } })),
          },
        });
      }
      return;
    }
    const sx = Math.hypot(m[0], m[1]),
      sy = (m[0] * m[3] - m[1] * m[2]) / sx;
    if (
      !sx ||
      !sy ||
      Math.abs(m[0] * m[2] + m[1] * m[3]) > 1e-7 * sx * Math.abs(sy)
    )
      throw Error("Sheared text needs upstream text-outline conversion.");
    const rotation = (Math.atan2(m[1], m[0]) * 180) / Math.PI;
    let runs = [];
    const collect = (n, s) => {
      for (const c of children(n)) {
        if (tagOf(c) === "#text")
          runs.push({ text: String(c["#text"]), style: s });
        else if (tagOf(c) === "tspan") {
          const ca = attr(c);
          if (["x", "y", "dx", "dy", "rotate"].some((k) => k in ca))
            throw Error("Positioned tspan requires separate text elements.");
          if (ca["data-pptx-inline-formula"])
            runs.push({
              text: "\ufffc",
              style: style(ca, s),
              formula: compileLatex(ca["data-pptx-inline-formula"], {
                display: false,
              }),
            });
          else collect(c, style(ca, s));
        } else throw Error("Unsupported text child.");
      }
    };
    collect(node, a);
    runs = normalizeTextRuns(runs);
    if (!runs.some((r) => r.text.trim())) return;
    const font = number(a["font-size"], 24),
      textValue = runs.map((r) => r.text).join(""),
      fontScale = Math.min(sx, Math.abs(sy));
    const estimated =
      runs.reduce((w, r) => {
        const family = fontFaces(
          r.style["font-family"] || "Arial",
          language,
        ).latin;
        const pixels = measureText
          ? measureText(
              r.text,
              number(r.style["font-size"], font) * 0.75,
              family,
              r.style["font-weight"] || "normal",
              r.style["font-style"] || "normal",
            )
          : [...r.text].length * number(r.style["font-size"], font) * 0.6;
        return (
          w + pixels + [...r.text].length * number(r.style["letter-spacing"])
        );
      }, 0) * sx;
    const anchor = a["text-anchor"] || "start";
    if (!["start", "middle", "end"].includes(anchor))
      throw Error("Invalid text-anchor.");
    const size =
      Math.max(...runs.map((r) => number(r.style["font-size"], font))) *
      fontScale;
    const widthPadding = authoredTextWidthPadding(estimated, size);
    const nativeW = Math.max(1, estimated + widthPadding),
      nativeH = size * 1.5;
    const baseline = textBaseline(
      runs.map((r) => ({
        text: r.text,
        font_size: number(r.style["font-size"], font),
        font_family: r.style["font-family"] || "Arial",
        font_weight: r.style["font-weight"],
        font_style: r.style["font-style"],
      })),
      { defaultSize: font, language },
    );
    const localLeft =
      number(a.x) -
      (anchor === "middle" ? estimated / 2 : anchor === "end" ? estimated : 0) /
        sx;
    const [centerX, centerY] = point(
      m,
      localLeft + nativeW / sx / 2,
      number(a.y) - baseline + nativeH / Math.abs(sy) / 2,
    );
    push({
      id: genId(),
      name: a.id || textValue.slice(0, 80),
      type: "text",
      $_otag: "sp",
      x: centerX - nativeW / 2,
      y: centerY - nativeH / 2,
      w: nativeW,
      h: nativeH,
      svgTextBaselineOffset: baseline * Math.abs(sy),
      svgTextWidthPadding: widthPadding,
      paragraphTextAnchor: anchor,
      paragraphInferenceBlocked: !!(a.id || Object.keys(a).some(key => key.startsWith('data-'))),
      ...(Math.abs(rotation) > 1e-8 ? { rot: rotation } : {}),
      ...(sy < 0 ? { flipV: true } : {}),
      noFill: true,
      ...(a["data-pptx-shape-style"]
        ? { style: nativeShapeStyle(a["data-pptx-shape-style"]) }
        : {}),
      ln: { noFill: true },
      txBody: {
        bodyPr: {
          $_anchor: "t",
          $_wrap: "none",
          $_lIns: 0,
          $_rIns: 0,
          $_tIns: 0,
          $_bIns: 0,
        },
        p: [
          {
            pPr: { $_algn: "l" },
            r: runs.map((r) => ({
              t: r.formula?.mathML || r.text,
              ...(r.formula
                ? {
                    $_otag: "m",
                    docOmml: r.formula.omml,
                    docMathML: r.formula.mathML,
                  }
                : {}),
              rPr: {
                $_sz: Math.round(
                  number(r.style["font-size"], font) * fontScale * 75,
                ),
                ...(r.style["font-weight"] === "bold" ||
                Number(r.style["font-weight"]) >= 600
                  ? { $_b: 1 }
                  : {}),
                ...(r.style["font-style"] === "italic" ? { $_i: 1 } : {}),
                ...(r.style["text-decoration"]
                  ? {
                      $_u: r.style["text-decoration"]
                        .split(" ")
                        .includes("underline")
                        ? "sng"
                        : "none",
                      $_strike: r.style["text-decoration"]
                        .split(" ")
                        .includes("line-through")
                        ? "sngStrike"
                        : "noStrike",
                    }
                  : {}),
                ...(r.style["baseline-shift"]
                  ? {
                      $_baseline:
                        { super: 30000, sub: -25000 }[
                          r.style["baseline-shift"]
                        ] ??
                        (() => {
                          throw Error("baseline-shift must be super or sub.");
                        })(),
                    }
                  : {}),
                $_spc: Math.round(
                  number(r.style["letter-spacing"]) * fontScale * 75,
                ),
                latin: {
                  $_typeface: fontFaces(
                    r.style["font-family"] || "Arial",
                    language,
                  ).latin,
                },
                ea: {
                  $_typeface: fontFaces(
                    r.style["font-family"] || "Arial",
                    language,
                  ).ea,
                },
                ...paint(
                  r.style.fill || "#000000",
                  alpha * opacity(r.style["fill-opacity"]),
                ),
                ...(effects(a, alpha) ? { effectLst: effects(a, alpha) } : {}),
                ...(a["data-savanna-hyperlink"]
                  ? {
                      hlinkClick: {
                        $_target: hyperlink(a["data-savanna-hyperlink"]),
                      },
                    }
                  : {}),
              },
            })),
          },
        ],
      },
    });
  };
  const walkNode = (
    node,
    parent = {},
    parentMatrix = baseMatrix,
    parentAlpha = 1,
    depth = 0,
  ) => {
    if (++visits > 3000 || depth > 32)
      throw Error("SVG nesting/use limit exceeded.");
    const tag = tagOf(node),
      raw = attr(node),
      a = style(raw, parent),
      m = multiply(parentMatrix, parseTransform(a.transform)),
      alpha = parentAlpha * opacity(a.opacity);
    if (a.display === "none" || ["hidden", "collapse"].includes(a.visibility))
      return;
    const replacement = a["data-pptx-replace-with"] || a["data-pptx-native"];
    if (replacement) {
      const payload = nativePayload(node, replacement);
      const bounds = ["x", "y", "width", "height"].map((k) =>
        number(payload[k] ?? a["data-pptx-" + k] ?? a[k]),
      );
      if (bounds[2] <= 0 || bounds[3] <= 0)
        throw Error("Native replacement requires positive frame width/height.");
      const base = {
        id: genId(),
        name: a.id || replacement,
        ...frame(m, ...bounds),
      };
      push(
        nativeObject(
          replacement,
          payload,
          base,
          Math.min(Math.hypot(m[0], m[1]), Math.hypot(m[2], m[3])),
        ),
      );
      return;
    }
    if (a["data-pptx-custgeom"] || a["data-pptx-ref"])
      throw Error(
        "Preserved native geometry/text payloads need the source metadata/relationship bridge; this port will not silently discard them.",
      );
    if (a["clip-path"] && a["clip-path"] !== "none" && tag !== "image")
      throw Error(
        "PPT Master maps clip-path to native picture geometry; non-picture clips require contour conversion.",
      );
    if (
      [
        "defs",
        "linearGradient",
        "radialGradient",
        "filter",
        "clipPath",
        "stop",
        "title",
        "desc",
        "metadata",
      ].includes(tag)
    )
      return;
    if (tag === "a") {
      a["data-savanna-hyperlink"] = hyperlink(a.href || a["xlink:href"]);
      for (const child of children(node))
        if (tagOf(child) !== "#text") walk(child, a, m, alpha, depth + 1);
      return;
    }
    if (["svg", "g"].includes(tag)) {
      if (a["data-pptx-prst"]) {
        const parts = String(a["data-pptx-frame"] || "")
          .trim()
          .split(/[\s,]+/)
          .map((v) => number(v));
        if (parts.length !== 4 || parts[2] <= 0 || parts[3] <= 0)
          throw Error("Preset group requires a valid data-pptx-frame.");
        const leaf = {
          rect: [],
          ":@": {
            ...a,
            x: String(parts[0]),
            y: String(parts[1]),
            width: String(parts[2]),
            height: String(parts[3]),
            transform: undefined,
          },
        };
        walk(leaf, {}, m, alpha, depth + 1);
        return;
      }
      for (const c of children(node))
        if (tagOf(c) !== "#text") walk(c, a, m, alpha, depth + 1);
      return;
    }
    if (tag === "use") {
      const href = a.href || a["xlink:href"];
      if (!/^#[\w.-]+$/.test(href || ""))
        throw Error("Only local use references are supported.");
      const target = definitions.get(href.slice(1));
      if (!target) throw Error("Missing SVG definition.");
      walk(
        target,
        a,
        multiply(m, [1, 0, 0, 1, number(a.x), number(a.y)]),
        alpha,
        depth + 1,
      );
      return;
    }
    if (tag === "text") {
      text(node, a, m, alpha);
      return;
    }
    if (tag === "image") {
      const begin=shapes.length,key=`${pageIndex}:svg:${imageIndex++}`;
      try{
      if ((a.href || a["xlink:href"]) && !a["data-query"]?.trim())
        throw Error("SVG image URLs are not accepted; use data-query.");
      if(!a['data-query']?.trim()||!(a['aria-label']||a['data-alt'])?.trim())throw Error('Image description is missing.');
      if(a['data-query'].length>160||String(a['aria-label']||a['data-alt']).length>200)throw Error('Image description is too long.');
      const asset = assets.get(key),
        targetFrame = frame(
          m,
          number(a.x),
          number(a.y),
          number(a.width),
          number(a.height),
        ),
        { x, y, w, h } = targetFrame,
        clip = pictureClip(a, m);
      if (w <= 0 || h <= 0) throw Error("SVG images need positive dimensions.");
      // Only host-resolved media is used; model-authored hrefs are ignored.
      if (asset?.media) {
        if(![asset.media.w,asset.media.h].every(v=>Number.isFinite(v)&&v>0)||!asset.media.name)throw Error('Image media has invalid dimensions or no stored file.');
        const aspect = a.preserveAspectRatio || "xMidYMid meet",
          slice = /\bslice$/.test(aspect),
          stretch =
            aspect === "none" ||
            (clip.prstGeom?.$_prst && clip.prstGeom.$_prst !== "rect") ||
            (clip.d && !clip.prstGeom);
        if (
          !/^(none|x(?:Min|Mid|Max)Y(?:Min|Mid|Max)(?: (?:meet|slice))?)$/.test(
            aspect,
          )
        )
          throw Error("Invalid SVG picture aspect ratio.");
        const ax = aspect.includes("xMin")
            ? 0
            : aspect.includes("xMax")
              ? 1
              : 0.5,
          ay = aspect.includes("YMin") ? 0 : aspect.includes("YMax") ? 1 : 0.5;
        const ratio = (slice ? Math.max : Math.min)(
            w / asset.media.w,
            h / asset.media.h,
          ),
          iw = stretch || slice ? w : asset.media.w * ratio,
          ih = stretch || slice ? h : asset.media.h * ratio;
        const fitted = frame(
          m,
          number(a.x) + ((w - iw) / Math.hypot(m[0], m[1])) * ax,
          number(a.y) + ((h - ih) / Math.hypot(m[2], m[3])) * ay,
          iw / Math.hypot(m[0], m[1]),
          ih / Math.hypot(m[2], m[3]),
        );
        const cropX = slice ? 1 - w / (asset.media.w * ratio) : 0,
          cropY = slice ? 1 - h / (asset.media.h * ratio) : 0;
        push({
          id: genId(),
          name: a.id || a["aria-label"],
          type: "image",
          $_otag: "pic",
          ...fitted,
          w: iw,
          h: ih,
          blipFill: {
            blip: {
              $_target: asset.media.name,
              $_w: asset.media.w,
              $_h: asset.media.h,
            },
            ...(slice
              ? {
                  srcRect: {
                    $_l: Math.round(cropX * ax * 100000),
                    $_r: Math.round(cropX * (1 - ax) * 100000),
                    $_t: Math.round(cropY * ay * 100000),
                    $_b: Math.round(cropY * (1 - ay) * 100000),
                  },
                  stretch: { fillRect: {} },
                }
              : {}),
          },
          ...clip,
          ...(a["data-pptx-shape-style"]
            ? { style: nativeShapeStyle(a["data-pptx-shape-style"]) }
            : {}),
          ...(a["data-savanna-hyperlink"]
            ? { link: hyperlink(a["data-savanna-hyperlink"]) }
            : {}),
          ...(effects(a, alpha) ? { effectLst: effects(a, alpha) } : {}),
          imageSource: {
            title: asset.title,
            author: asset.author,
            license: asset.license,
            url: asset.sourceUrl,
            ...(asset.generation ? { generation: asset.generation } : {}),
          },
        });
        usedImageKeys.add(key);
      } else {
        push({
          id: genId(),
          name: "Image placeholder",
          type: "rectangle",
          $_otag: "sp",
          x,
          y,
          w,
          h,
          d: `R0,0,${w},${h}`,
          ...targetFrame,
          ...clip,
          ...(effects(a, alpha) ? { effectLst: effects(a, alpha) } : {}),
          solidFill: color("#E6EDF2"),
          ln: { noFill: true },
          imagePlaceholder: {
            description: a["data-query"],
            alt: a["aria-label"],
            searchQueries: asset?.searchQueries || [],
          },
        });
        const caption = imagePlaceholderCaption(a["data-query"] || a["aria-label"] || "description missing", asset, 'Image');
        let size = 16,
          lines;
        do {
          lines = wrapDeckText(
            caption,
            Math.max(1, number(a.width) - 24),
            size * 0.75,
          );
          if (lines.length * size * 1.4 <= number(a.height) - 24) break;
          size--;
        } while (size > 8);
        for (const [lineIndex, line] of lines.entries()) {
          const label = {
            text: [{ "#text": line }],
            ":@": {
              x: String(number(a.x) + 12),
              y: String(number(a.y) + 16 + size + lineIndex * size * 1.4),
              "font-size": String(size),
              fill: "#334455",
            },
          };
          text(label, attr(label), m, 1);
        }
      }
      }catch(error){
        shapes.splice(begin);
        const description=String(a['data-query']||a['aria-label']||a['data-alt']||'Image unavailable').slice(0,200);
        imageWarnings.push(`Image placeholder for “${description}”: ${error.message||'Image conversion failed.'}`);
        let fallback;
        try{const sw=number(a.width),sh=number(a.height);if(sw<=0||sh<=0)throw Error();fallback=frame(m,number(a.x),number(a.y),sw,sh);}catch{fallback={x:width*.1,y:height*.2,w:width*.3,h:height*.3};}
        const font=Math.max(1.34,Math.min(16,fallback.w/20,fallback.h/4));
        push({id:genId(),name:'Image placeholder',type:'rectangle',$_otag:'sp',...fallback,d:`R0,0,${fallback.w},${fallback.h}`,solidFill:color('#E6EDF2'),ln:{noFill:true},imagePlaceholder:{description,alt:a['aria-label']||a['data-alt']||description,searchQueries:assets.get(key)?.searchQueries||[]},txBody:{bodyPr:{$_anchor:'ctr',$_lIns:0,$_rIns:0,$_tIns:0,$_bIns:0},p:[{pPr:{$_algn:'ctr'},r:[{t:imagePlaceholderCaption(description,assets.get(key),'Image unavailable'),rPr:{$_sz:Math.round(font*75),latin:{$_typeface:'Arial'},solidFill:color('#334455')}}]}]}});
      }
      return;
    }
    let d, preset;
    const x = number(a.x),
      y = number(a.y),
      w = number(a.width),
      h = number(a.height);
    if (tag === "rect") {
      if (w <= 0 || h <= 0)
        throw Error("SVG rectangles need positive dimensions.");
      const r = Math.min(
        number(a.rx, a.ry === undefined ? 0 : number(a.ry)),
        w / 2,
        h / 2,
      );
      if (r < 0) throw Error("Invalid SVG corner radius.");
      const ry = Math.min(number(a.ry, number(a.rx)), h / 2);
      if (ry < 0) throw Error("Invalid elliptical corner radius.");
      d =
        r && ry
          ? `M${x + r},${y}H${x + w - r}A${r},${ry} 0 0 1 ${x + w},${y + ry}V${y + h - ry}A${r},${ry} 0 0 1 ${x + w - r},${y + h}H${x + r}A${r},${ry} 0 0 1 ${x},${y + h - ry}V${y + ry}A${r},${ry} 0 0 1 ${x + r},${y}Z`
          : `M${x},${y}H${x + w}V${y + h}H${x}Z`;
      preset = a["data-pptx-preset"] || a["data-pptx-prst"];
    } else if (["circle", "ellipse"].includes(tag)) {
      const cx = number(a.cx),
        cy = number(a.cy),
        rx = number(a.rx, a.r === undefined ? 0 : number(a.r)),
        ry = number(a.ry, a.r === undefined ? 0 : number(a.r));
      if (rx <= 0 || ry <= 0) throw Error("Invalid ellipse radius.");
      d = `M${cx - rx},${cy}A${rx},${ry} 0 1 0 ${cx + rx},${cy}A${rx},${ry} 0 1 0 ${cx - rx},${cy}Z`;
    } else if (tag === "line")
      d = `M${number(a.x1)},${number(a.y1)}L${number(a.x2)},${number(a.y2)}`;
    else if (["polygon", "polyline"].includes(tag)) {
      const pts = String(a.points || "")
        .trim()
        .split(/[\s,]+/)
        .map((v) => number(v));
      if (pts.length < 4 || pts.length % 2) throw Error("Invalid SVG points.");
      d = `M${pts[0]},${pts[1]}`;
      for (let i = 2; i < pts.length; i += 2) d += `L${pts[i]},${pts[i + 1]}`;
      if (tag === "polygon") d += "Z";
    } else if (tag === "path") d = a.d;
    else throw Error(`Unsupported SVG element: ${tag}`);
    if (!d || d.length > 30000) throw Error("Invalid SVG path.");
    const path = new SVGPathData(d)
        .toAbs()
        .normalizeHVZ(false)
        .normalizeST()
        .qtToC()
        .aToC()
        .matrix(...m),
      bounds = path.getBounds();
    const bw = Math.max(0.01, bounds.maxX - bounds.minX),
      bh = Math.max(0.01, bounds.maxY - bounds.minY);
    const strokeWidth =
      number(a["stroke-width"], 1) *
      (a["vector-effect"] === "non-scaling-stroke"
        ? 1
        : Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])));
    if (
      a["vector-effect"] &&
      !["none", "non-scaling-stroke"].includes(a["vector-effect"])
    )
      throw Error("Invalid vector-effect.");
    if (tag === 'rect' && !Math.abs(number(a.rotate)) && Math.abs(m[1]) < 1e-8 && Math.abs(m[2]) < 1e-8)
      textContainers.push({ x: bounds.minX, y: bounds.minY, w: bw, h: bh });
    const shape = {
      id: genId(),
      name: a.id || tag,
      type: "path",
      $_otag: "sp",
      x: bounds.minX,
      y: bounds.minY,
      w: bw,
      h: bh,
      d: path.translate(-bounds.minX, -bounds.minY).encode(),
      ...paint(a.fill || "#000000", alpha * opacity(a["fill-opacity"])),
      ...(a["data-pptx-shape-style"]
        ? { style: nativeShapeStyle(a["data-pptx-shape-style"]) }
        : {}),
      ...(a["data-savanna-hyperlink"]
        ? { link: hyperlink(a["data-savanna-hyperlink"]) }
        : {}),
      ...(effects(a, alpha) ? { effectLst: effects(a, alpha) } : {}),
      ln:
        a.stroke && a.stroke !== "none"
          ? {
              $_w: Math.round(strokeWidth * 9525),
              ...paint(a.stroke, alpha * opacity(a["stroke-opacity"])),
              ...lineDetails(a),
              ...(a["stroke-linecap"]
                ? {
                    $_cap:
                      { round: "rnd", square: "sq", butt: "flat" }[
                        a["stroke-linecap"]
                      ] || "flat",
                  }
                : {}),
              ...(a["stroke-linejoin"] === "round"
                ? { round: {} }
                : a["stroke-linejoin"] === "bevel"
                  ? { bevel: {} }
                  : a["stroke-linejoin"] === "miter"
                    ? { miter: { $_lim: 800000 } }
                    : {}),
            }
          : { noFill: true },
    };
    preset ||= a["data-pptx-prst"];
    if (preset) {
      const resolved = resolveAutoshape(preset);
      const nativeFrame = a["data-pptx-frame"]
        ? String(a["data-pptx-frame"])
            .trim()
            .split(/[\s,]+/)
            .map((v) => number(v))
        : [x, y, w, h];
      if (nativeFrame.length !== 4 || nativeFrame[2] < 0 || nativeFrame[3] < 0)
        throw Error("Invalid native preset frame.");
      Object.assign(shape, frame(m, ...nativeFrame));
      const overrides = Object.fromEntries(
        Object.entries(a)
          .filter(([k]) => k.startsWith("data-pptx-av-"))
          .map(([k, v]) => [k.slice("data-pptx-av-".length), v]),
      );
      const guides = completePresetAdjustments(resolved.id, overrides);
      shape.prstGeom = {
        $_prst: resolved.id,
        avLst: guides.length ? { gd: guides } : {},
      };
      const info = geometry(shape.prstGeom, shape.w, shape.h);
      if (!info?.d) throw Error("Cannot compile Office preset.");
      shape.d = info.d;
      if (info.pathTransform) shape.pathTransform = info.pathTransform;
      if (info.prstTxMargin) shape.prstTxMargin = info.prstTxMargin;
      shape.type = resolved.name.toLowerCase();
      if (a["data-pptx-object"] === "connector") shape.$_otag = "cxnSp";
    }
    push(shape);
  };
  const walk = (...args) => {
    const previous = sourceIds;
    const id = attr(args[0]).id;
    sourceIds = id ? [...previous, id] : previous;
    try {
      return walkNode(...args);
    } finally {
      sourceIds = previous;
    }
  };
  walk(root);
  const composed = applyBooleanOperations(mergeNativeParagraphs(shapes, language), booleans, genId, {
    outlineText,
    deferTextOutlines,
  });
  if (!shapes.length) throw Error("SVG page has no visible objects.");
  return {
    shapes: fitGeneratedTextFrames(composed, { width, containers: textContainers, measureText }),
    usedImageKeys:[...usedImageKeys],
    warnings: [...imageWarnings,...[...assets.entries()]
      .filter(
        ([key, a]) =>
          key.startsWith(`${pageIndex}:svg:`) && a.placeholder && a.warning,
      )
      .map(([, a]) => a.warning)],
    svgSource: svg,
  };
}
