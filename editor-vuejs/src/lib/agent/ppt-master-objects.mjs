// Native replacement metadata contract from PPT Master (Hugo He, MIT).
// JSON data is authoritative; SVG fallback children are never duplicated.
import { editorColor } from "./colors.mjs";
import { fontFaces } from "./ppt-master-text.mjs";
import { compileLatex } from "./ppt-master-math.mjs";
import { compileNativeChart } from "./ppt-master-charts.mjs";
const tag = (n) => Object.keys(n).find((k) => k !== ":@");
const text = (n) =>
  typeof n === "string"
    ? n
    : "#text" in n
      ? String(n["#text"])
      : (n[tag(n)] || []).map(text).join("");
const object = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
export const nativeNumber = (v, name, fallback) => {
  v ??= fallback;
  if (typeof v !== "number" || !Number.isFinite(v) || Math.abs(v) > 1e8)
    throw Error(`Native ${name} must be finite numeric data.`);
  return v;
};
export function nativePayload(node, kind) {
  const a = node[":@"] || {};
  if (
    a["data-pptx-native"] &&
    a["data-pptx-replace-with"] &&
    a["data-pptx-native"] !== a["data-pptx-replace-with"]
  )
    throw Error("Conflicting native replacement kinds.");
  let raw = a["data-pptx-json"] || a["data-pptx-data"];
  if (!raw) {
    for (const child of node[tag(node)] || []) {
      if (tag(child) !== "metadata") continue;
      const ca = child[":@"] || {};
      const declared = ca["data-pptx-native"] || ca["data-pptx-kind"];
      if (declared && declared !== kind)
        throw Error("Native metadata kind conflicts with parent.");
      if (!ca.type || ca.type === "application/json") {
        raw = text(child);
        break;
      }
    }
  }
  if (!raw || raw.length > 70000)
    throw Error(`Native ${kind} requires bounded JSON metadata.`);
  let result;
  try {
    result = JSON.parse(raw);
  } catch {
    throw Error(`Invalid native ${kind} JSON.`);
  }
  if (!object(result)) throw Error("Native metadata must be a JSON object.");
  const check = (v, depth = 0) => {
    if (depth > 40) throw Error("Native metadata nesting limit exceeded.");
    if (object(v))
      for (const [k, item] of Object.entries(v)) {
        if (["__proto__", "constructor", "prototype"].includes(k))
          throw Error("Invalid native metadata key.");
        check(item, depth + 1);
      }
    else if (Array.isArray(v)) v.forEach((item) => check(item, depth + 1));
    else if (typeof v === "number" && !Number.isFinite(v))
      throw Error("Native metadata has a non-finite number.");
  };
  check(result);
  return result;
}
function weighted(total, count, weights, name) {
  weights ??= Array(count).fill(1);
  if (!Array.isArray(weights) || weights.length !== count)
    throw Error(`Native table ${name} length mismatch.`);
  weights = weights.map((v) => nativeNumber(v, name));
  if (weights.some((v) => v < 0) || !weights.some((v) => v > 0))
    throw Error("Table weights must be nonnegative with a positive total.");
  const available = Math.round(total) - count;
  if (available < 0) throw Error("Table dimensions are too small.");
  const sum = weights.reduce((a, b) => a + b, 0),
    quotas = weights.map((v) => (available * v) / sum),
    parts = quotas.map(Math.floor),
    remainder = available - parts.reduce((a, b) => a + b, 0);
  const order = quotas
    .map((v, i) => ({ i, f: v - parts[i], w: weights[i] }))
    .sort((a, b) => b.f - a.f || b.w - a.w || a.i - b.i);
  for (const { i } of order.slice(0, remainder)) parts[i]++;
  return parts.map((v) => v + 1);
}
function run(value, defaults, scale) {
  const r = object(value) ? value : { text: String(value ?? "") },
    s = { ...defaults, ...r };
  const faces = fontFaces(s.font_family || "Arial", s.lang);
  return {
    t: String(r.text ?? ""),
    rPr: {
      $_sz: Math.round(nativeNumber(s.font_size, "font_size", 18) * 75 * scale),
      $_b: s.bold ? 1 : 0,
      $_i: s.italic ? 1 : 0,
      ...(s.underline !== undefined
        ? { $_u: s.underline ? "sng" : "none" }
        : {}),
      ...(s.strike !== undefined
        ? { $_strike: s.strike ? "sngStrike" : "noStrike" }
        : {}),
      ...(s.baseline !== undefined
        ? { $_baseline: nativeNumber(s.baseline, "baseline") }
        : {}),
      latin: { $_typeface: faces.latin },
      ea: { $_typeface: faces.ea },
      $_lang: s.lang || "en-US",
      solidFill: editorColor(s.color || "#1F2937"),
    },
  };
}
export function nativeTable(payload, base, scale = 1) {
  const rows = [
    ...(payload.columns?.length ? [payload.columns] : []),
    ...(payload.rows || []),
  ];
  if (
    !rows.length ||
    rows.length > 100 ||
    !Array.isArray(rows[0]) ||
    !rows[0].length ||
    rows[0].length > 40 ||
    rows.some((r) => !Array.isArray(r) || r.length !== rows[0].length)
  )
    throw Error("Native table rows must be a bounded rectangular array.");
  const cols = rows[0].length,
    style = payload.style || {},
    head = payload.header_rows ?? (payload.columns?.length ? 1 : 0);
  if (!Number.isInteger(head) || head < 0 || head > rows.length)
    throw Error("Invalid table header_rows.");
  const widths = weighted(
      base.w * 9525,
      cols,
      payload.column_widths,
      "column_widths",
    ),
    heights = weighted(
      base.h * 9525,
      rows.length,
      payload.row_heights,
      "row_heights",
    );
  const merges = new Map();
  for (let ri = 0; ri < rows.length; ri++)
    for (let ci = 0; ci < cols; ci++) {
      const cell = rows[ri][ci],
        rs = object(cell) ? cell.row_span ?? cell.rowSpan ?? 1 : 1,
        cs = object(cell) ? cell.col_span ?? cell.colSpan ?? 1 : 1;
      if (
        !Number.isInteger(rs) ||
        !Number.isInteger(cs) ||
        rs < 1 ||
        cs < 1 ||
        ri + rs > rows.length ||
        ci + cs > cols
      )
        throw Error("Invalid table merge span.");
      if (rs > 1 || cs > 1)
        for (let r = ri; r < ri + rs; r++)
          for (let c = ci; c < ci + cs; c++) {
            const key = `${r}:${c}`;
            if (merges.has(key)) throw Error("Overlapping table merges.");
            merges.set(key, { ri, ci, rs, cs });
          }
    }
  const tr = rows.map((row, ri) => ({
    $_h: heights[ri],
    tc: row.map((value, ci) => {
      const cell = object(value) ? value : { text: value },
        header = ri < head,
        m = merges.get(`${ri}:${ci}`),
        continuation = m && (ri !== m.ri || ci !== m.ci);
      const defaults = {
        ...style,
        ...cell,
        color:
          cell.color ||
          (header ? style.header_text : style.body_text) ||
          "#1F2937",
        font_size:
          cell.font_size ||
          (header ? style.header_font_size : undefined) ||
          style.font_size ||
          18,
        bold: cell.bold ?? header,
      };
      const paragraphs = cell.paragraphs || String(cell.text ?? "").split("\n");
      if (cell.paragraphs && cell.text !== undefined)
        throw Error("Table cell text and paragraphs are mutually exclusive.");
      if (!Array.isArray(paragraphs) || !paragraphs.length)
        throw Error("Table paragraphs must be a nonempty list.");
      const p = continuation
        ? [{ r: [] }]
        : paragraphs.map((item) => {
            const para = object(item) ? item : { text: item };
            return {
              pPr: {
                $_algn: para.align || cell.align || style.align || "l",
                ...(para.line_spacing_percent !== undefined
                  ? {
                      lnSpc: {
                        spcPct: {
                          $_val: Math.round(
                            nativeNumber(
                              para.line_spacing_percent,
                              "line spacing",
                            ) * 1000,
                          ),
                        },
                      },
                    }
                  : {}),
              },
              r: (para.runs || [{ text: para.text }]).map((r) =>
                run(r, defaults, scale),
              ),
            };
          });
      const fill =
        cell.fill ??
        (header
          ? style.header_fill
          : style.band_row !== false && ri % 2
            ? style.band_fill
            : undefined) ??
        style.body_fill;
      const tcPr = {
        ...(fill ? { solidFill: editorColor(fill) } : { noFill: true }),
        $_anchor:
          { top: "t", middle: "ctr", bottom: "b" }[
            cell.vertical_align || style.vertical_align
          ] || "t",
      };
      for (const [side, key] of Object.entries({
        left: "L",
        right: "R",
        top: "T",
        bottom: "B",
      })) {
        const padding =
          cell[`padding_${side}`] ??
          (object(cell.padding) ? cell.padding[side] : cell.padding) ??
          style[`padding_${side}`] ??
          (object(style.padding) ? style.padding[side] : style.padding);
        if (padding !== undefined)
          tcPr[`$_mar${key}`] = Math.round(
            nativeNumber(padding, "padding") * scale * 9525,
          );
        const border =
          cell.borders?.[side] ??
          style.borders?.[side] ??
          cell.border ??
          style.border;
        if (border) {
          tcPr[`ln${key}`] =
            border.style === "none"
              ? { noFill: true }
              : {
                  $_w: Math.round(
                    nativeNumber(border.width, "border width", 1) *
                      scale *
                      9525,
                  ),
                  solidFill: editorColor(border.color || "#000000"),
                  prstDash: {
                    $_val:
                      border.style === "dashed"
                        ? "dash"
                        : border.style === "dotted"
                          ? "sysDot"
                          : "solid",
                  },
                };
        }
      }
      return {
        ...(m
          ? {
              ...(ri === m.ri && m.rs > 1 ? { $_rowSpan: m.rs } : {}),
              ...(ci === m.ci && m.cs > 1 ? { $_gridSpan: m.cs } : {}),
              ...(ci > m.ci ? { $_hMerge: 1 } : {}),
              ...(ri > m.ri ? { $_vMerge: 1 } : {}),
            }
          : {}),
        txBody: { bodyPr: {}, p },
        tcPr,
      };
    }),
  }));
  return {
    ...base,
    type: "table",
    $_otag: "graphicFrame",
    graphic: {
      graphicData: {
        $_uri: "http://schemas.openxmlformats.org/drawingml/2006/table",
        tbl: {
          tblPr: {
            $_firstRow: head > 0 ? 1 : 0,
            $_bandRow: style.band_row === false ? 0 : 1,
          },
          tblGrid: { gridCol: widths.map((w) => ({ $_w: w })) },
          tr,
        },
      },
    },
  };
}
export function nativeObject(kind, payload, base, scale) {
  if (kind === "table") return nativeTable(payload, base, scale);
  if (kind === "chart") return { ...base, ...compileNativeChart(payload) };
  if (kind === "formula") {
    if (payload.display && payload.display !== "block")
      throw Error("Block formula metadata display must be block.");
    const size = nativeNumber(payload.font_size, "formula font_size", 28);
    if (size <= 0 || size > 400) throw Error("Formula size must be in 0..400.");
    const formula = compileLatex(payload.latex);
    return {
      ...base,
      type: "text",
      $_otag: "sp",
      noFill: true,
      ln: { noFill: true },
      txBody: {
        bodyPr: { $_anchor: "ctr", $_lIns: 0, $_rIns: 0, $_tIns: 0, $_bIns: 0 },
        p: [
          {
            pPr: {
              $_algn:
                { center: "ctr", left: "l", right: "r" }[
                  payload.align || "center"
                ] || "ctr",
            },
            r: [
              {
                $_otag: "m",
                t: formula.mathML,
                docMathML: formula.mathML,
                docOmml: formula.omml,
                rPr: {
                  $_sz: Math.round(size * scale * 75),
                  latin: { $_typeface: "Cambria Math" },
                  solidFill: editorColor(payload.color || "#000000"),
                },
              },
            ],
          },
        ],
      },
    };
  }
  throw Error(`Unknown native replacement kind ${kind}.`);
}
