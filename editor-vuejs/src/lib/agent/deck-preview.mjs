// Bounded, inert layout proofs from compiled native objects. No model-authored SVG/HTML.
import { wrapDeckText } from "./deck-text.mjs";
const escape = (value) =>
  String(value ?? "").replace(
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
const hex = (value) =>
  value?.uniClr?.$_val ? `#${value.uniClr.$_val}` : "none";
const fill = (value) => {
  const color = hex(value),
    alpha = value?.uniClr?.alpha?.$_val;
  if (color === "none" || alpha === undefined) return color;
  return `rgba(${parseInt(color.slice(1, 3), 16)},${parseInt(color.slice(3, 5), 16)},${parseInt(color.slice(5, 7), 16)},${alpha / 100000})`;
};

export function deckLayoutPreviews(
  compiled,
  { width = 1280, height = 720, limit = 6 } = {},
) {
  return compiled.pages.slice(0, limit).map((page) => {
    const elements = [],
      definitions = [];
    const paint = (object) => {
      if (object?.gradFill?.gsLst?.gs) {
        const id = `gradient-${definitions.length}`,
          gradient = object.gradFill,
          angle = (((gradient.lin?.$_ang || 0) / 60000) * Math.PI) / 180;
        const stops = gradient.gsLst.gs
          .map(
            (gs) =>
              `<stop offset="${gs.$_pos / 100000}" stop-color="${hex(gs)}" stop-opacity="${(gs.uniClr?.alpha?.$_val ?? 100000) / 100000}"/>`,
          )
          .join("");
        if (gradient.path?.$_path === "circle") {
          const focus = gradient.path.fillToRect || {};
          definitions.push(
            `<radialGradient id="${id}" cx=".5" cy=".5" r=".5" fx="${(focus.$_l ?? 50000) / 100000}" fy="${(focus.$_t ?? 50000) / 100000}">${stops}</radialGradient>`,
          );
        } else
          definitions.push(
            `<linearGradient id="${id}" x1="0" y1="0" x2="${Math.cos(angle)}" y2="${Math.sin(angle)}">${stops}</linearGradient>`,
          );
        return `url(#${id})`;
      }
      if (object?.pattFill) {
        const id = `pattern-${definitions.length}`,
          p = object.pattFill,
          foreground = fill(p.fgClr),
          background = fill(p.bgClr);
        // Schematic pattern preview; native JSON retains the exact DrawingML pattern preset.
        definitions.push(
          `<pattern id="${id}" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="${background}"/><path d="M0 8L8 0M-4 4L4 -4M4 12L12 4" stroke="${foreground}" stroke-width="1"/></pattern>`,
        );
        return `url(#${id})`;
      }
      return fill(object?.solidFill);
    };
    const effect = (effects) => {
      if (!effects?.outerShdw && !effects?.glow) return "";
      const id = `effect-${definitions.length}`;
      if (effects.outerShdw) {
        const shadow = effects.outerShdw,
          angle = (((shadow.$_dir || 0) / 60000) * Math.PI) / 180,
          distance = (shadow.$_dist || 0) / 9525;
        definitions.push(
          `<filter id="${id}" x="-100%" y="-100%" width="300%" height="300%"><feDropShadow dx="${Math.cos(angle) * distance}" dy="${Math.sin(angle) * distance}" stdDeviation="${(shadow.$_blurRad || 0) / 9525 / 2}" flood-color="${hex(shadow)}" flood-opacity="${(shadow.uniClr?.alpha?.$_val ?? 100000) / 100000}"/></filter>`,
        );
      } else {
        const glow = effects.glow;
        definitions.push(
          `<filter id="${id}" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur in="SourceAlpha" stdDeviation="${(glow.$_rad || 0) / 9525}" result="blur"/><feFlood flood-color="${hex(glow)}" flood-opacity="${(glow.uniClr?.alpha?.$_val ?? 100000) / 100000}"/><feComposite in2="blur" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>`,
        );
      }
      return ` filter="url(#${id})"`;
    };
    const background = page.bg?.bgPr;
    if (background?.blipFill) elements.push(`<rect width="${width}" height="${height}" fill="#E6EDF2"/><text x="16" y="28" font-size="18" fill="#334455">Background image</text>`);
    else if (background) elements.push(`<rect width="${width}" height="${height}" fill="${paint(background)}"/>`);
    for (const shape of page.shapes) {
      const start = elements.length;
      const { x, y, w, h } = shape,
        preset = shape.prstGeom?.$_prst;
      let color = paint(shape);
      if (shape.type === "image") {
        elements.push(
          `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#E6EDF2"/><text x="${x + 12}" y="${y + 28}" font-size="18" fill="#334455">Image: ${escape(shape.name)}</text>`,
        );
      } else if (shape.d && !shape.d.startsWith("R")) {
        const dash = shape.ln?.custDash?.ds?.[0],
          sw = (shape.ln?.$_w || 0) / 9525;
        const dasharray = dash
          ? `${(dash.$_d / 100000) * sw} ${(dash.$_sp / 100000) * sw}`
          : shape.ln?.prstDash
            ? "8 4"
            : "";
        elements.push(
          `<path d="${escape(shape.d)}" transform="translate(${x} ${y})" fill="${color}" stroke="${paint(shape.ln)}" stroke-width="${sw}"${dasharray ? ` stroke-dasharray="${dasharray}"` : ""}/>`,
        );
      } else if (color !== "none") {
        if (preset === "ellipse")
          elements.push(
            `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" fill="${color}"/>`,
          );
        else if (preset === "chevron")
          elements.push(
            `<polygon points="${x},${y} ${x + w * 0.8},${y} ${x + w},${y + h / 2} ${x + w * 0.8},${y + h} ${x},${y + h} ${x + w * 0.2},${y + h / 2}" fill="${color}"/>`,
          );
        else
          elements.push(
            `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${preset === "roundRect" ? 12 : 0}" fill="${color}"/>`,
          );
      }
      if (shape.txBody) {
        const inset = shape.txBody.bodyPr || {},
          textX = x + (inset.$_lIns || 0) / 9525;
        const textW = w - ((inset.$_lIns || 0) + (inset.$_rIns || 0)) / 9525;
        let baseline = y + (inset.$_tIns || 0) / 9525;
        let paragraphIndex = 0;
        for (const p of shape.txBody.p) {
          const first = p.r[0]?.rPr || {},
            size = (((first.$_sz || 1800) / 100) * 4) / 3;
          const content =
            (p.pPr?.buChar ? "• " : "") + p.r.map((r) => r.t).join("");
          if (p.r.some((r) => r.$_otag === "m")) {
            const align =
              { ctr: "center", r: "right", l: "left" }[p.pPr?.$_algn] || "left";
            const body = p.r
              .map((r) =>
                r.$_otag === "m"
                  ? `<math xmlns="http://www.w3.org/1998/Math/MathML" display="inline">${r.t}</math>`
                  : escape(r.t),
              )
              .join("");
            elements.push(
              `<foreignObject x="${x}" y="${y}" width="${w}" height="${h}"><div xmlns="http://www.w3.org/1999/xhtml" style="font-size:${size}px;color:${hex(first.solidFill)};text-align:${align}">${body}</div></foreignObject>`,
            );
            continue;
          }
          if (inset.$_wrap === "none") {
            baseline +=
              paragraphIndex++ === 0
                ? shape.svgTextBaselineOffset ?? size * 0.8
                : (p.pPr?.lnSpc?.spcPts?.$_val || 0) / 75 || size * 1.2;
            elements.push(
              `<text x="${textX}" y="${baseline}" font-family="${escape(first.latin?.$_typeface || "Arial")}">${p.r.map((r) => (r.$_otag === "br" ? `<tspan x="${textX}" dy="${size * 1.2}">&#8203;</tspan>` : `<tspan font-size="${(((r.rPr?.$_sz || 1800) / 100) * 4) / 3}" letter-spacing="${(r.rPr?.$_spc || 0) / 75}" font-weight="${r.rPr?.$_b ? "700" : "400"}" font-style="${r.rPr?.$_i ? "italic" : "normal"}" fill="${paint(r.rPr)}">${escape(r.t)}</tspan>`)).join("")}</text>`,
            );
            continue;
          }
          const lines = wrapDeckText(content, textW, (size * 3) / 4);
          for (const line of lines) {
            baseline += size * 1.15;
            if (baseline <= y + h + 1)
              elements.push(
                `<text x="${textX}" y="${baseline}" font-size="${size}" font-family="${escape(first.latin?.$_typeface || "Arial")}" font-weight="${first.$_b ? "700" : "400"}" fill="${paint(first)}">${escape(line)}</text>`,
              );
          }
          baseline += size * 0.25;
        }
      }
      if (["table", "chart"].includes(shape.type))
        elements.push(
          `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#E6EDF2" stroke="#72869A"/><text x="${x + 16}" y="${y + 32}" font-family="Arial" font-size="22" fill="#334455">Editable ${shape.type} (layout preview)</text>`,
        );
      if (shape.pendingNative)
        elements.push(
          `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#72869A" stroke-dasharray="4 4"/><text x="${x + 8}" y="${y + 20}" font-size="14">Text contour preview requires document fonts</text>`,
        );
      const transform = [
        shape.rot ? `rotate(${shape.rot} ${x + w / 2} ${y + h / 2})` : "",
        shape.flipV ? `translate(0 ${2 * y + h}) scale(1 -1)` : "",
        shape.flipH ? `translate(${2 * x + w} 0) scale(-1 1)` : "",
      ]
        .filter(Boolean)
        .join(" ");
      const effects =
        shape.effectLst || shape.txBody?.p?.[0]?.r?.[0]?.rPr?.effectLst;
      if (transform || effects) {
        const content = elements.splice(start).join("");
        elements.push(
          `<g${transform ? ` transform="${transform}"` : ""}${effect(effects)}>${content}</g>`,
        );
      }
    }
    return {
      title: page.name,
      url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><defs>${definitions.join("")}</defs>${elements.join("")}</svg>`)}`,
    };
  });
}
