// Port of drawingml/styles.py build_shadow_xml/build_glow_xml and utils.py filter parameter mapping.
// Copyright (c) 2025-2026 Hugo He, MIT. Output is the corresponding Savanna JSON subtree.
const tag = (n) => Object.keys(n).find((k) => k !== ":@");
const children = (n) => n[tag(n)] || [];
const attrs = (n) => {
  const a = { ...n[":@"] };
  for (const declaration of String(a.style || "").split(";")) {
    const i = declaration.indexOf(":");
    if (i > 0)
      a[declaration.slice(0, i).trim()] = declaration.slice(i + 1).trim();
  }
  return a;
};
const finite = (raw, fallback) => {
  if (raw === undefined && fallback !== undefined) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n))
    throw Error("Effect parameters must be explicit finite numbers.");
  return n;
};
const alpha = (raw) =>
  String(raw).endsWith("%")
    ? finite(String(raw).slice(0, -1)) / 100
    : finite(raw);
export function drawingmlEffects(filter, opacity, makeColor) {
  if (!filter) return undefined;
  const root = attrs(filter);
  if (root.primitiveUnits && root.primitiveUnits !== "userSpaceOnUse")
    throw Error("Filter primitiveUnits must be userSpaceOnUse.");
  let sigma,
    dx = 0,
    dy = 0,
    paintAlpha,
    transferAlpha,
    color = "#000000",
    hasOffset = false;
  const walk = (n) => {
    const name = tag(n),
      a = attrs(n);
    if (["feDropShadow", "feGaussianBlur"].includes(name)) {
      sigma = finite(a.stdDeviation);
      if (sigma < 0 || a.edgeMode)
        throw Error("Unsupported native blur parameters.");
    }
    if (["feDropShadow", "feOffset"].includes(name)) {
      dx = finite(a.dx, name === "feOffset" ? 0 : undefined);
      dy = finite(a.dy, name === "feOffset" ? 0 : undefined);
      hasOffset = hasOffset || Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01;
    }
    if (["feDropShadow", "feFlood"].includes(name)) {
      paintAlpha = alpha(a["flood-opacity"]);
      color = a["flood-color"] || "#000000";
    }
    if (name === "feFuncA") {
      if (a.type !== "linear" || a.intercept !== undefined)
        throw Error("Native filter alpha transfer requires linear slope only.");
      transferAlpha = (transferAlpha ?? 1) * finite(a.slope);
    }
    if (
      ![
        "filter",
        "feDropShadow",
        "feGaussianBlur",
        "feOffset",
        "feFlood",
        "feFuncA",
        "feComponentTransfer",
        "feMerge",
        "feMergeNode",
        "feComposite",
        "feBlend",
      ].includes(name)
    )
      throw Error(`Unsupported native filter primitive: ${name}`);
    for (const child of children(n)) if (tag(child) !== "#text") walk(child);
  };
  walk(filter);
  if (sigma === undefined)
    throw Error("Native filter requires feDropShadow or feGaussianBlur.");
  const opacityValue = Math.max(
    0,
    Math.min(
      1,
      (paintAlpha ?? (transferAlpha === undefined ? 0.3 : 1)) *
        (transferAlpha ?? 1) *
        opacity,
    ),
  );
  if (!hasOffset)
    return {
      glow: {
        $_rad: Math.round(sigma * 9525),
        ...makeColor(color, opacityValue),
      },
    };
  const direction =
    (((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360) * 60000;
  const alignment =
    Math.abs(dx) < 0.5
      ? "ctr"
      : Math.abs(dy) < 0.5
        ? dx > 0
          ? "l"
          : "r"
        : dy > 0
          ? dx > 0
            ? "tl"
            : "tr"
          : dx > 0
            ? "bl"
            : "br";
  return {
    outerShdw: {
      $_blurRad: Math.round(sigma * 2 * 9525),
      $_dist: Math.round(Math.hypot(dx, dy) * 9525),
      $_dir: Math.trunc(direction),
      $_algn: alignment,
      $_rotWithShape: 0,
      ...makeColor(color, opacityValue * 0.75),
    },
  };
}
