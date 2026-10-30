import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve, relative, join } from "node:path";
import { execFileSync } from "node:child_process";

// Enumerate every upstream converter module, including branches not reachable from our SVG transport.
const root = resolve(process.argv[2] || "tmp/ppt-master-upstream");
const provenance = JSON.parse(
  await readFile("third_party/ppt-master/PROVENANCE.json", "utf8"),
);
const commit = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
if (commit !== provenance.commit)
  throw Error("Audit source must match the pinned upstream commit.");
const directory = join(root, "skills/ppt-master/scripts/svg_to_pptx");
const modules = [];
const coverage = (path) => {
  if (path === "drawingml/text_baseline.py")
    return [
      "ported-core",
      "Bundled upstream metrics, script-specific font slots, exact rational baseline arithmetic and native point rounding ported. Font availability still depends on the document/runtime.",
    ];
  if (path === "animation_config.py")
    return [
      "partial-port",
      "Slide motion/group transport, 203 upstream authored presets, 48 transition specs, timing parameters and native XML export connected. Full filesystem sidecars, audio/narration, advanced scheduling and source-roundtrip gates remain separate.",
    ];
  if (path === "shape_boolean.py")
    return [
      "partial-port",
      "Union/intersection/subtract/XOR/fragment use Paper.js curve operations in place of skia-pathops. Stable source IDs and actual-font text outlines are connected; advanced imported geometry/Boolean preprocessing contracts remain.",
    ];
  if (path === "drawingml/hyperlinks.py")
    return [
      "partial-port",
      "HTTP(S), mailto and standard slideshow actions map to native shape/text links. Source package relationship reuse and arbitrary internal destinations remain.",
    ];
  if (path === "drawingml/context.py")
    return [
      "editor-integration",
      "The JS compiler context owns definitions, bounded traversal, images, IDs and native geometry callbacks. Upstream archive context is owned by the editor.",
    ];
  if (path === "drawingml/text_properties.py")
    return [
      "partial-port",
      "Upstream font fallback/metrics, weight/italic, decoration/baseline shift, whitespace, paragraph line metadata, spacing, anchor and native text paints/effects mapped. Complete source reflow/RTL/text-layout behavior remains.",
    ];
  if (path === "__init__.py" || path === "drawingml/__init__.py")
    return [
      "editor-integration",
      "Python module exports are replaced by JavaScript module entry points; this is packaging glue rather than a DrawingML feature.",
    ];
  if (path.startsWith("pptx_package/"))
    return [
      "editor-integration",
      "Desq owns page/archive persistence and relationships. Upstream package-specific templates, narration and structured export have not been reimplemented.",
    ];
  if (path === "drawingml/styles.py")
    return [
      "partial-port",
      "Native fill/stroke/alpha, linear/radial gradients including text, patterns, shadow/glow, dash and markers mapped. Preserved native-gradient payloads remain.",
    ];
  if (path === "drawingml/elements.py")
    return [
      "partial-port",
      "Native freeforms, presets/adjustments, transformed text/images, positioned spans, picture clips/crops, hyperlinks and preserved shape-style XML mapped. Preserved geometry/text object payloads and advanced branches remain.",
    ];
  if (path === "drawingml/paths.py")
    return [
      "delegated-geometry",
      "SVG path normalization/curve and arc conversion use svg-pathdata; output is editable native geometry.",
    ];
  if (path === "drawingml/utils.py")
    return [
      "partial-port",
      "Affine composition, numeric/style/color helpers and effect coordinates mapped; source-wide validation and metadata helpers remain.",
    ];
  if (path === "tspan_flattener.py")
    return [
      "partial-port",
      "Positioned lines become native editable text frames. Paragraph classification/reflow modes remain.",
    ];
  if (path === "use_expander.py")
    return [
      "partial-port",
      "Bounded local defs/use expansion is mapped; external symbol resources are not fetched.",
    ];
  if (path.startsWith("native_objects/"))
    return [
      "partial-port",
      "Native metadata decodes to editable classic/ChartEx charts with data workbooks, weighted/merged rich-text tables and block/inline Office Math. The JS LaTeX grammar, chart option coverage and imported-source freshness/style contracts are not yet exhaustive; no whole-module parity claim.",
    ];
  if (path === "drawingml/converter.py")
    return [
      "partial-port",
      "Traversal, preflight and Desq output replace XML packaging; not every upstream gate is translated.",
    ];
  if (path === "geometry_properties.py")
    return [
      "partial-port",
      "Literal inline geometry styles are materialized by the JS style resolver.",
    ];
  return [
    "not-ported",
    "Retained in the audit for explicit follow-up; no claim of upstream-wide feature parity.",
  ];
};
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = join(dir, entry.name);
    if (entry.isDirectory()) await walk(file);
    else if (entry.name.endsWith(".py")) {
      const source = await readFile(file, "utf8"),
        path = relative(directory, file).replaceAll("\\", "/"),
        [status, notes] = coverage(path);
      modules.push({
        path,
        status,
        notes,
        functions: [
          ...source.matchAll(/^\s*(?:async )?def\s+(\w+)\s*\(/gm),
        ].map((m) => m[1]),
      });
    }
  }
}
await walk(directory);
const formulaPath = join(
  root,
  "skills/ppt-master/scripts/pptx_shapes/formula.py",
);
const formulaSource = await readFile(formulaPath, "utf8");
modules.push({
  path: "../pptx_shapes/formula.py",
  status: "partial-port",
  notes:
    "All 17 guide operators, dynamic builtins and ordered adjustment completion are ported, with defaults for 187 presets. OOXML coordinate validations remain distributed across host checks.",
  functions: [
    ...formulaSource.matchAll(/^\s*(?:async )?def\s+(\w+)\s*\(/gm),
  ].map((m) => m[1]),
});
modules.sort((a, b) => a.path.localeCompare(b.path));
const report = {
  repository: provenance.repository,
  commit,
  scope:
    "svg_to_pptx converter package; workflow/research/template tooling is separately documented",
  sourceModules: modules.length,
  modules,
};
await writeFile(
  "editor-vuejs/docs/ppt-master-audit.json",
  JSON.stringify(report, null, 2) + "\n",
);
const counts = {};
for (const m of modules) counts[m.status] = (counts[m.status] || 0) + 1;
await writeFile(
  "editor-vuejs/docs/ppt-master-audit.md",
  `# PPT Master source audit\n\nPinned commit: \`${commit}\`. ${modules.length} Python converter modules inventoried.\n\nThis is a coverage inventory, not a full-parity claim. Desq's native object model can retain DrawingML properties; the remaining work is source-transport parsing and owning-layer integration, not editor feature support.\n\nSee [the function-level inventory](ppt-master-audit.json) and [port contract](ppt-master-port.md).\n\n| Source module | Coverage | Mapping / remaining work |\n| --- | --- | --- |\n${modules.map((m) => `| \`${m.path}\` | ${m.status} | ${m.notes} |`).join("\n")}\n\nUpstream explicitly rejects arbitrary SVG masks in \`drawingml/utils.py:project_mask_errors\`. Native picture clipping is separately supported and now mapped. SVG masks are not being described as an Desq limitation.\n`,
);
console.log(
  JSON.stringify({ commit, sourceModules: modules.length, coverage: counts }),
);
