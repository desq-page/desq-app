// PPT Master shape_boolean operation contract; Paper.js supplies the curve engine
// in place of Python skia-pathops. Results remain editable native freeform paths.
import paper from "paper";
import { SVGPathData } from "svg-pathdata";
const operations = {
  union: "unite",
  intersect: "intersect",
  subtract: "subtract",
  combine: "exclude",
};
export function booleanPaths(operation, paths) {
  if (!Array.isArray(paths) || paths.length < 2 || paths.length > 32)
    throw Error("Boolean operations need 2..32 closed operands.");
  if (!["fragment", ...Object.keys(operations)].includes(operation))
    throw Error("Unknown Boolean operation.");
  const scope = new paper.PaperScope();
  scope.setup(new scope.Size(1, 1));
  try {
    const operands = paths.map((d) => {
      if (typeof d !== "string" || d.length > 60000)
        throw Error("Invalid Boolean contour.");
      const p = scope.PathItem.create(d);
      p.fillRule = "nonzero";
      const contours = p.children || [p];
      if (contours.some((c) => !c.closed))
        throw Error("Boolean operands must be closed filled contours.");
      return p;
    });
    let result;
    if (operation === "fragment") {
      let fragments = [operands[0]];
      for (const operand of operands.slice(1)) {
        const next = [];
        let remainder = operand;
        for (const part of fragments) {
          const inside = part.intersect(operand, { insert: false }),
            outside = part.subtract(operand, { insert: false });
          if (inside.pathData) next.push(inside);
          if (outside.pathData) next.push(outside);
          remainder = remainder.subtract(part, { insert: false });
        }
        if (remainder.pathData) next.push(remainder);
        fragments = next;
        if (fragments.length > 500)
          throw Error("Boolean fragment limit exceeded.");
      }
      result = fragments;
    } else
      result = [
        operands
          .slice(1)
          .reduce(
            (a, b) => a[operations[operation]](b, { insert: false }),
            operands[0],
          ),
      ];
    return result.filter((p) => p.pathData).map((p) => p.pathData);
  } finally {
    scope.project.remove();
  }
}
export function applyBooleanOperations(
  shapes,
  commands,
  genId,
  { outlineText, deferTextOutlines = false } = {},
) {
  if (!commands?.length) return shapes;
  let result = [...shapes];
  for (const command of commands) {
    const ids = command.source_ids;
    if (!Array.isArray(ids) || new Set(ids).size !== ids.length)
      throw Error("Boolean source_ids must be distinct.");
    const selected = ids.map((id) => {
      const matches = result.filter(
        (s) => s.sourceIds?.includes(id) || s.name === id,
      );
      if (!matches.length) throw Error(`Missing Boolean operand ${id}.`);
      return matches;
    });
    const all = selected.flat();
    if (new Set(all).size !== all.length)
      throw Error("Boolean operands must not overlap by ancestry.");
    if (deferTextOutlines && all.some((s) => s.type === "text")) {
      const x = Math.min(...all.map((s) => s.x)),
        y = Math.min(...all.map((s) => s.y)),
        right = Math.max(...all.map((s) => s.x + s.w)),
        bottom = Math.max(...all.map((s) => s.y + s.h)),
        name = command.output_id || "Boolean";
      const insert = Math.min(...all.map((s) => result.indexOf(s)));
      result = result.filter((s) => !all.includes(s));
      result.splice(insert, 0, {
        id: genId(),
        name,
        sourceIds: [name],
        type: "pendingBoolean",
        pendingNative: true,
        x,
        y,
        w: right - x,
        h: bottom - y,
      });
      continue;
    }
    const pathFor = (s) => {
      if (s.type === "text") {
        if (!outlineText)
          throw Error("Boolean text needs loaded font contours.");
        return outlineText(s);
      }
      if (s.type === "image" || !s.d)
        throw Error("Boolean image operands need resolved contour outlines.");
      if (s.rot || s.flipV || s.flipH)
        throw Error("Boolean preset transforms need baked path coordinates.");
      return new SVGPathData(s.d).toAbs().matrix(1, 0, 0, 1, s.x, s.y).encode();
    };
    const paths = selected.map((list) => list.map(pathFor).join(""));
    const outputs = booleanPaths(command.operation, paths),
      base = all[0],
      insert = Math.min(...all.map((s) => result.indexOf(s)));
    result = result.filter((s) => !all.includes(s));
    const generated = outputs.map((d, i) => {
      const p = new SVGPathData(d),
        b = p.getBounds();
      const name = command.output_id || "Boolean result";
      return {
        ...base,
        ...(base.type === "text"
          ? {
              noFill: false,
              solidFill: base.txBody.p[0].r[0].rPr.solidFill,
              gradFill: base.txBody.p[0].r[0].rPr.gradFill,
            }
          : {}),
        id: genId(),
        name: outputs.length > 1 ? `${name}-${i + 1}` : name,
        sourceIds: [name],
        type: "path",
        $_otag: "sp",
        x: b.minX,
        y: b.minY,
        w: b.maxX - b.minX,
        h: b.maxY - b.minY,
        d: p.matrix(1, 0, 0, 1, -b.minX, -b.minY).encode(),
        prstGeom: undefined,
        txBody: undefined,
        rot: undefined,
        flipV: undefined,
        flipH: undefined,
      };
    });
    result.splice(insert, 0, ...generated);
  }
  return result;
}
