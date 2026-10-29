import { readFile, writeFile, copyFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const source = "tmp/ppt-master-upstream/skills/ppt-master/scripts/";
const dest = "third_party/ppt-master/";
const manifest = JSON.parse(await readFile(dest + "FILES.json", "utf8"));
for (const [from, to] of [
  ["svg_to_pptx/drawingml/font_metrics.json", "data/font-metrics.json"],
  ["svg_to_pptx/drawingml/text_baseline.py", "python/text_baseline.py"],
  ["pptx_animation_presets.json", "data/animation-presets.json"],
  ["svg_to_pptx/shape_boolean.py", "python/shape_boolean.py"],
  ["svg_to_pptx/animation_config.py", "python/animation_config.py"],
  [
    "svg_to_pptx/native_objects/formula_profile.py",
    "python/formula_profile.py",
  ],
  ["pptx_transitions.py", "python/pptx_transitions.py"],
]) {
  await copyFile(source + from, dest + to);
  const content = await readFile(dest + to, "utf8");
  const entry = {
    file: to,
    upstream: "skills/ppt-master/scripts/" + from,
    sha256LF: createHash("sha256")
      .update(content.replace(/\r\n/g, "\n"))
      .digest("hex"),
  };
  const idx = manifest.findIndex((e) => e.file === to);
  if (idx < 0) manifest.push(entry);
  else manifest[idx] = entry;
}
const utils = await readFile(source + "svg_to_pptx/drawingml/utils.py", "utf8");
const block = (name) =>
  utils.match(new RegExp("^" + name + " = \\{([\\s\\S]*?)^\\}", "m"))?.[1] ||
  "";
const strings = (s) =>
  [...s.replace(/^\s*#.*$/gm, "").matchAll(/'([^']*)'/g)].map((m) => m[1]);
const pairs = (s) =>
  Object.fromEntries(
    [...s.matchAll(/'([^']*)':\s*'([^']*)'/g)].map((m) => [m[1], m[2]]),
  );
const fonts = {
  ea: strings(block("EA_FONTS")),
  fallback: pairs(block("FONT_FALLBACK_WIN")),
  ja: pairs(block("_JA_FONT_FALLBACK_WIN")),
  serif: strings(block("_SERIF_LATIN")),
};
const metrics = JSON.parse(
  await readFile(dest + "data/font-metrics.json", "utf8"),
);
await writeFile(
  "editor-vuejs/src/lib/agent/data/ppt-master-fonts.mjs",
  "// Derived from pinned PPT Master; Hugo He, MIT. See third_party/ppt-master/FILES.json.\nexport const fontData=" +
    JSON.stringify(fonts) +
    ";\nexport const fontMetrics=" +
    JSON.stringify(metrics.families) +
    ";\n",
);
const presets = JSON.parse(
  await readFile(dest + "data/animation-presets.json", "utf8"),
);
await writeFile(
  "editor-vuejs/src/lib/agent/data/ppt-master-animations.mjs",
  "// Unmodified preset records from pinned PPT Master; Hugo He, MIT.\nexport default " +
    JSON.stringify(presets.effects) +
    ";\n",
);
const transitionSource = await readFile(source + "pptx_transitions.py", "utf8");
const transitionBody = transitionSource.match(
  /^_TRANSITION_SPECS[^=]*= (\{[\s\S]*?^\})/m,
)[1];
const transitions = JSON.parse(
  transitionBody.replace(/^\s*#.*$/gm, "").replace(/,\s*([}\]])/g, "$1"),
);
await writeFile(
  "shared-vuejs/src/edlib/pptx/pptMasterTransitions.mjs",
  "// Native transition specs from pinned PPT Master; Hugo He, MIT.\nexport default " +
    JSON.stringify(transitions) +
    ";\n",
);
const chartSource = await readFile(
  source + "svg_to_pptx/native_objects/chart_data.py",
  "utf8",
);
const aliasesBlock = chartSource.slice(
  chartSource.indexOf("def _chart_kind("),
  chartSource.indexOf("    if key.startswith("),
);
const chartAliases = Object.fromEntries(
  [
    ...aliasesBlock.matchAll(
      /"([^"]+)": \("([^"]+)", (None|"[^"]+"), (None|"[^"]+")\)/g,
    ),
  ].map((m) => [
    m[1],
    [
      m[2],
      m[3] === "None" ? null : JSON.parse(m[3]),
      m[4] === "None" ? null : JSON.parse(m[4]),
    ],
  ]),
);
await writeFile(
  "editor-vuejs/src/lib/agent/data/ppt-master-chart-types.mjs",
  "// Chart type normalization from PPT Master chart_data.py; Hugo He, MIT.\nexport default " +
    JSON.stringify(chartAliases) +
    ";\n",
);
const profile = await readFile(
  source + "svg_to_pptx/native_objects/formula_profile.py",
  "utf8",
);
const dictionaries = {};
for (const name of [
  "GREEK_SYMBOLS",
  "BINARY_SYMBOLS",
  "RELATION_SYMBOLS",
  "ARROW_SYMBOLS",
  "DOT_SYMBOLS",
  "MISC_SYMBOLS",
  "NARY_COMMANDS",
  "ACCENT_COMMANDS",
  "DELIMITER_COMMANDS",
  "SPACING_COMMANDS",
  "COLOR_NAMES",
]) {
  const body =
    profile.match(
      new RegExp("^" + name + " = \\{([\\s\\S]*?)^\\}", "m"),
    )?.[1] || "";
  dictionaries[name] = Object.fromEntries(
    [...body.matchAll(/"([^"\\]*)":\s*"((?:\\.|[^"\\])*)"/g)].map((m) => [
      m[1],
      JSON.parse('"' + m[2] + '"'),
    ]),
  );
  if (name === "NARY_COMMANDS")
    dictionaries[name] = Object.fromEntries(
      [...body.matchAll(/"([^"]+)":\s*\("([^"]+)"/g)].map((m) => [m[1], m[2]]),
    );
}
await writeFile(
  "editor-vuejs/src/lib/agent/data/ppt-master-math-profile.mjs",
  "// Vocabulary from PPT Master formula_profile.py; Hugo He, MIT.\nexport default " +
    JSON.stringify(dictionaries) +
    ";\n",
);
await writeFile(dest + "FILES.json", JSON.stringify(manifest, null, 2) + "\n");
