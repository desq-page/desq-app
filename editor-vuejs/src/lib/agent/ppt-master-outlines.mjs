import { getRunText } from "shared-vuejs/api/lib-text-run-text";
import { SVGPathData } from "svg-pathdata";
export function outlineNativeText(shape, fonts) {
  const paths = [];
  let y = shape.svgTextBaselineOffset || 0;
  for (const paragraph of shape.txBody?.p || []) {
    let x = 0;
    for (const run of paragraph.r || []) {
      if (run.$_otag === "m")
        throw Error("Math operands require their own glyph outline stage.");
      const rp = run.rPr || {},
        family = rp.latin?.$_typeface || "Arial",
        size = (rp.$_sz || 1800) / 75,
        font = fonts.get(family.toLowerCase());
      if (!font)
        throw Error(
          `Boolean text requires the actual ${family} font. Embed it in the document or choose Carlito.`,
        );
      const text = getRunText(run);
      const path = font.getPath(text, x, y, size);
      paths.push(path.toPathData(5));
      x +=
        font.getAdvanceWidth(text, size) +
        ((rp.$_spc || 0) / 75) * [...text].length;
    }
    y += ((paragraph.r?.[0]?.rPr?.$_sz || 1800) / 75) * 1.2;
  }
  if (!paths.length) throw Error("Text outline has no glyphs.");
  const angle = ((shape.rot || 0) * Math.PI) / 180,
    c = Math.cos(angle),
    s = Math.sin(angle),
    fx = shape.flipH ? -1 : 1,
    fy = shape.flipV ? -1 : 1;
  const cx = shape.x + shape.w / 2,
    cy = shape.y + shape.h / 2;
  return new SVGPathData(paths.join(""))
    .toAbs()
    .matrix(
      c * fx,
      s * fx,
      -s * fy,
      c * fy,
      cx - (c * fx * shape.w) / 2 + (s * fy * shape.h) / 2,
      cy - (s * fx * shape.w) / 2 - (c * fy * shape.h) / 2,
    )
    .encode();
}
export async function loadOutlineFonts(
  file,
  { readFonts, fetchFont, signal } = {},
) {
  const { default: opentype } = await import("opentype.js");
  const fonts = new Map();
  const records = (await readFonts?.(file.id)) || [];
  for (const font of file.fonts || []) {
    const record = records.find((r) => r.name === font.name);
    let data = record?.data;
    if (!data && font.type === "local" && font.name)
      data = new Uint8Array(
        await fetchFont(
          `/res/${encodeURIComponent(file.id)}/fonts/${encodeURIComponent(font.name)}`,
          signal,
        ),
      );
    if (data) {
      try {
        fonts.set(
          font.family.toLowerCase(),
          opentype.parse(
            data.buffer.slice(
              data.byteOffset,
              data.byteOffset + data.byteLength,
            ),
          ),
        );
      } catch {
        /* Other font formats remain available for rendering; try the next TTF/OTF. */
      }
    }
  }
  if (!fonts.has("carlito") && fetchFont) {
    const data = await fetchFont("/fonts/Carlito-Regular.ttf", signal);
    fonts.set("carlito", opentype.parse(data));
  }
  return fonts;
}
