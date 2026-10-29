// Port of pptx_shapes/formula.py and registry.py's ordered adjustment evaluation.
// Copyright (c) 2025-2026 Hugo He, MIT. Preset default data retains separate Apache-2.0 provenance.
import defaults from "./data/ppt-master-adjustments.mjs";
const arity = {
  val: 1,
  "*/": 3,
  "+-": 3,
  "+/": 3,
  "?:": 3,
  abs: 1,
  at2: 2,
  cat2: 3,
  cos: 2,
  max: 2,
  min: 2,
  mod: 3,
  pin: 3,
  sat2: 3,
  sin: 2,
  sqrt: 1,
  tan: 2,
};
export function formulaContext(width, height) {
  if (![width, height].every((v) => Number.isFinite(v) && v >= 0))
    throw Error("Geometry dimensions must be finite and nonnegative.");
  return {
    l: 0,
    t: 0,
    r: width,
    b: height,
    w: width,
    h: height,
    hc: width / 2,
    vc: height / 2,
    ss: Math.min(width, height),
    ls: Math.max(width, height),
  };
}
export function evaluateFormula(formula, context) {
  const resolve = (raw) => {
    if (/^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.test(raw))
      return Number(raw);
    if (Object.hasOwn(context, raw)) return context[raw];
    const dim = /^(wd|hd|ssd)([1-9]\d*)$/.exec(raw);
    if (dim)
      return (
        context[dim[1] === "wd" ? "w" : dim[1] === "hd" ? "h" : "ss"] /
        Number(dim[2])
      );
    const angle = /^(?:(\d+))?cd([1-9]\d*)$/.exec(raw);
    if (angle) return (21600000 * Number(angle[1] || 1)) / Number(angle[2]);
    throw Error(`Unknown DrawingML guide: ${raw}`);
  };
  const parts = String(formula).trim().split(/\s+/),
    operator = parts[0],
    count = arity[operator];
  if (count === undefined) {
    if (parts.length === 1) return resolve(operator);
    throw Error(`Unsupported DrawingML formula: ${operator}`);
  }
  if (
    parts.length < count + 1 ||
    (parts.length > count + 1 &&
      !(operator === "+-" && parts.slice(count + 1).every((v) => v === "0")))
  )
    throw Error("Invalid DrawingML formula operand count.");
  const [x, y, z] = parts.slice(1, count + 1).map(resolve),
    radians = (value) => ((value / 60000) * Math.PI) / 180;
  const result =
    operator === "val"
      ? x
      : operator === "*/"
        ? z === 0
          ? 0
          : (x * y) / z
        : operator === "+-"
          ? x + y - z
          : operator === "+/"
            ? z === 0
              ? 0
              : (x + y) / z
            : operator === "?:"
              ? x > 0
                ? y
                : z
              : operator === "abs"
                ? Math.abs(x)
                : operator === "at2"
                  ? ((Math.atan2(y, x) * 180) / Math.PI) * 60000
                  : operator === "cat2"
                    ? x * Math.cos(Math.atan2(z, y))
                    : operator === "cos"
                      ? x * Math.cos(radians(y))
                      : operator === "max"
                        ? Math.max(x, y)
                        : operator === "min"
                          ? Math.min(x, y)
                          : operator === "mod"
                            ? Math.hypot(x, y, z)
                            : operator === "pin"
                              ? Math.max(x, Math.min(y, z))
                              : operator === "sat2"
                                ? x * Math.sin(Math.atan2(z, y))
                                : operator === "sin"
                                  ? x * Math.sin(radians(y))
                                  : operator === "sqrt"
                                    ? Math.sqrt(x)
                                    : x * Math.tan(radians(y));
  if (!Number.isFinite(result))
    throw Error("DrawingML formula result must be finite.");
  return result;
}
export function completePresetAdjustments(preset, overrides) {
  if (!Object.hasOwn(defaults, preset))
    throw Error(`Missing upstream preset definition: ${preset}`);
  const guides = defaults[preset],
    names = new Set(guides.map(([name]) => name));
  for (const name of Object.keys(overrides))
    if (!names.has(name))
      throw Error(`Preset ${preset} has no adjustment named ${name}.`);
  const context = formulaContext(100000, 100000);
  return guides.map(([name, defaultFormula]) => {
    const value = evaluateFormula(overrides[name] ?? defaultFormula, context);
    context[name] = value;
    if (value < -27273042329600 || value > 27273042316900)
      throw Error("Adjustment is outside the OOXML coordinate range.");
    return { $_name: name, $_fmla: `val ${Math.round(value)}` };
  });
}
