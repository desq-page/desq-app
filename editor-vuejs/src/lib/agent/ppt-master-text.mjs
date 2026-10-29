// Port of drawingml/text_baseline.py and utils.py font-family resolution.
// Copyright (c) 2025-2026 Hugo He, MIT. Metrics and notices retained in third_party/.
import { fontData, fontMetrics } from "./data/ppt-master-fonts.mjs";
const canonical = new Map(
  [...fontData.ea, ...Object.keys(fontData.fallback)].map((f) => [
    f.toLowerCase(),
    f,
  ]),
);
const ea = new Set(fontData.ea);
const isLang = (tag, prefix) => tag === prefix || tag.startsWith(prefix + "-");
export function fontFaces(stack = "", language = "en-US") {
  const lang = language.toLowerCase();
  let latin, east;
  for (let f of stack
    .split(",")
    .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))) {
    if (!f || ["system-ui", "-apple-system", "BlinkMacSystemFont"].includes(f))
      continue;
    const generic = {
      "sans-serif": "Segoe UI",
      serif: "Times New Roman",
      monospace: "Consolas",
    }[f];
    if (generic) {
      if (!latin && !east) latin = generic;
      continue;
    }
    f = canonical.get(f.toLowerCase()) || f;
    const mapped =
      (isLang(lang, "ja") && fontData.ja[f]) || fontData.fallback[f] || f;
    if (ea.has(f) || ea.has(mapped)) east ||= mapped;
    else latin ||= mapped;
  }
  latin ||= east || "Segoe UI";
  const serif = fontData.serif.includes(latin);
  east ||= isLang(lang, "ja")
    ? serif
      ? "Yu Mincho"
      : "Yu Gothic"
    : isLang(lang, "ko")
      ? serif
        ? "Batang"
        : "Malgun Gothic"
      : ["zh-hant", "zh-tw", "zh-hk", "zh-mo"].some((p) => isLang(lang, p))
        ? serif
          ? "PMingLiU"
          : "Microsoft JhengHei"
        : serif
          ? "SimSun"
          : "Microsoft YaHei";
  return { latin, ea: east };
}
export const isCJK = (ch) =>
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\u2e80-\u303f\u3100-\u312f\uff01-\uff60\uffe0-\uffe6]/u.test(
    ch,
  );
export function normalizeTextRuns(runs) {
  const result = runs.map((r) => ({ ...r, text: "" }));
  let pending = -1,
    emitted = false;
  for (const [i, run] of runs.entries()) {
    const mode = run.style?.["xml:space"] || "default";
    if (!["default", "preserve"].includes(mode))
      throw Error("xml:space must be default or preserve.");
    for (const char of String(run.text).replace(/[\t\r\n]/g, " ")) {
      if (char === " " && mode === "default") {
        if (pending < 0) pending = i;
        continue;
      }
      if (pending >= 0 && emitted) result[pending].text += " ";
      pending = -1;
      result[i].text += char;
      emitted = true;
    }
  }
  return result.filter((r) => r.text || r.formula);
}
// Exact rational arithmetic retains upstream whole-point half ties.
const gcd = (a, b) => (b ? gcd(b, a % b) : a < 0n ? -a : a);
const q = (n, d = 1n) => {
  n = BigInt(n);
  d = BigInt(d);
  const g = gcd(n, d);
  return [n / g, d / g];
};
const add = (a, b) => q(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
const mul = (a, b) => q(a[0] * b[0], a[1] * b[1]);
const div = (a, b) => q(a[0] * b[1], a[1] * b[0]);
const max = (a, b) => (a[0] * b[1] > b[0] * a[1] ? a : b);
const whole = (a) => (2n * a[0] + a[1]) / (2n * a[1]);
export function textBaseline(
  runs,
  {
    defaultSize = 24,
    language = "en-US",
    lineSpacingPx,
    lineSpacingRatio = 1,
  } = {},
) {
  let ascent = q(0),
    descent = q(0),
    largest = q(0);
  for (const r of runs) {
    if (r._line_break) break;
    if (!r.text) continue;
    const size = q(Math.round(Number(r.font_size ?? defaultSize) * 75), 100);
    const faces = r.font_faces || fontFaces(r.font_family, language);
    for (const family of new Set(
      [...r.text].map((ch) => (isCJK(ch) ? faces.ea : faces.latin)),
    )) {
      const bold = r.font_weight === "bold" || Number(r.font_weight) >= 600,
        italic = r.font_style === "italic";
      const f = fontMetrics[family.toLowerCase()] || {},
        m =
          f[
            bold
              ? italic
                ? "bold-italic"
                : "bold"
              : italic
                ? "italic"
                : "regular"
          ] ||
          (bold && f.bold) ||
          f.regular;
      const raw = m?.[m.fsSelection & 128 ? "typo" : "win"];
      const ratio = raw ? q(raw[0], raw[0] + Math.abs(raw[1])) : q(4, 5);
      ascent = max(ascent, mul(size, ratio));
      descent = max(descent, mul(size, add(q(1), mul(q(-1), ratio))));
    }
    largest = max(largest, size);
  }
  if (!largest[0]) return 0;
  const natural = mul(q(6, 5), largest);
  let baseline = div(mul(natural, ascent), add(ascent, descent));
  if (lineSpacingPx !== undefined || lineSpacingRatio !== 1) {
    const spacing =
      lineSpacingPx === undefined
        ? mul(natural, q(Math.round(lineSpacingRatio * 1000000), 1000000))
        : q(whole(q(Math.round(lineSpacingPx * 75), 100)));
    const minimum = mul(q(3, 4), spacing);
    baseline =
      spacing[0] * natural[1] <= natural[0] * spacing[1]
        ? max(minimum, add(spacing, add(baseline, mul(q(-1), natural))))
        : minimum;
  }
  return (Number(whole(baseline)) * 4) / 3;
}
