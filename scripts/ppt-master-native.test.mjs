import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import { XMLValidator, XMLParser } from "fast-xml-parser";
import { compilePageSVG } from "../editor-vuejs/src/lib/agent/ppt-master-svg.mjs";
import { compileDeck } from "../editor-vuejs/src/lib/agent/deck-compiler.mjs";
import { deckSchema } from "../editor-vuejs/src/lib/agent/deck-schema.mjs";
import { validateArguments } from "../editor-vuejs/src/lib/agent/editor-tools.mjs";
import {
  fontFaces,
  textBaseline,
} from "../editor-vuejs/src/lib/agent/ppt-master-text.mjs";
import { booleanPaths } from "../editor-vuejs/src/lib/agent/ppt-master-boolean.mjs";
import {
  compileMotion,
  transitionNames,
} from "../editor-vuejs/src/lib/agent/ppt-master-motion.mjs";
import transitions from "../shared-vuejs/src/edlib/pptx/pptMasterTransitions.mjs";
import { chartWorkbook } from "../shared-vuejs/src/edlib/pptx/export/chart-workbook.mjs";
import { ZipReader, Uint8ArrayReader, TextWriter } from "@zip.js/zip.js";
import { outlineNativeText } from "../editor-vuejs/src/lib/agent/ppt-master-outlines.mjs";
import opentype from "opentype.js";
import presets from "../editor-vuejs/src/lib/agent/data/ppt-master-animations.mjs";
import { compileLatex } from "../editor-vuejs/src/lib/agent/ppt-master-math.mjs";
import { nativeMathRun } from "../shared-vuejs/src/edlib/pptx/export/native-math.mjs";
import { applyNativeTiming } from "../shared-vuejs/src/edlib/pptx/nativeTimingXml.mjs";
import { compileNativeChart } from "../editor-vuejs/src/lib/agent/ppt-master-charts.mjs";
import { preflightDeckPlan } from "../editor-vuejs/src/lib/agent/deck-preflight.mjs";
const require = createRequire(import.meta.url);
function load(file, deps = {}) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      exports,
      structuredClone,
      TextEncoder,
      TextDecoder,
      require: (name) => {
        if (!(name in deps)) throw Error("Unexpected " + name);
        return deps[name];
      },
    },
  );
  return exports;
}
const tags = load("shared-vuejs/src/lib/txml/txmlNsTags.ts");
const { applySlideTransition } = load(
  "shared-vuejs/src/edlib/pptx/slideTransitionXml.ts",
  { "./pptMasterTransitions.mjs": { default: transitions } },
);
const txml = load("shared-vuejs/src/lib/txml/txml.ts", {
  "../text/textUtil": {
    escapeHtmlEntities: (s) =>
      String(s)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;"),
  },
  "./txmlNsTags": tags,
  "txml/txml": require("txml/txml"),
}).default;
let sequence = 0;
const options = {
  width: 1280,
  height: 720,
  genId: () => `native-${++sequence}`,
};
const wrap = (body) => `<svg viewBox="0 0 1280 720">${body}</svg>`;
test("paragraph line metadata retains bullets, soft wraps and superscript as one native text frame", () => {
  const svg = wrap(
    '<text x="30" y="100" font-size="24" data-paragraph-line-height="36"><tspan x="30" dy="0">• First item</tspan><tspan x="30" dy="36" data-paragraph-soft-break="1">continued</tspan><tspan x="30" dy="36">Second <tspan baseline-shift="super" text-decoration="underline">2</tspan></tspan></text>',
  );
  const shapes = compilePageSVG(svg, options).shapes;
  assert.equal(shapes.length, 1);
  const paragraphs = shapes[0].txBody.p;
  assert.equal(paragraphs.length, 2);
  assert.equal(paragraphs[0].pPr.buChar.$_char, "•");
  assert.equal(
    paragraphs[0].r.map((r) => r.t).join(""),
    "First item continued",
  );
  assert.equal(paragraphs[1].r[1].rPr.$_baseline, 30000);
  assert.equal(paragraphs[1].r[1].rPr.$_u, "sng");
  assert.equal(paragraphs[0].pPr.lnSpc.spcPts.$_val, 2700);
});
test("native timing and true backgrounds survive PPTX XML export and reloaded JSON", async () => {
  const file = "ppt/slides/slide1.xml",
    encoder = new TextEncoder();
  const archive = {
    [file]: encoder.encode(
      '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr/><p:grpSpPr/></p:spTree></p:cSld></p:sld>',
    ),
    "[Content_Types].xml": encoder.encode("<Types><Override/></Types>"),
  };
  let stored = {
    data: { sld: { originalXmlPath: file, cSld: { shapes: [] } } },
  };
  const { getShapeXmlSpans } = load(
    "shared-vuejs/src/edlib/pptx/shapeXmlSpans.ts",
  );
  const { persistSlideXmlFromModel } = load(
    "shared-vuejs/src/edlib/pptx/updateSlideXml.ts",
    {
      "../common/db/db": {
        getDexie: async () => stored,
        putDexie: async (_, value) => {
          stored = value;
        },
      },
      "./export/gen-shape": {
        genShape: (shape, info) => ({
          $_otag: "p:sp",
          "p:nvSpPr": { "p:cNvPr": { $_id: info.id, $_name: shape.name } },
          "p:spPr": {},
        }),
      },
      "#shared/lib/txml/txml": { default: txml },
      "./pptxArchive": {
        getPptxPart: async (_, path) => archive[path],
        updatePptxArchiveParts: async (_, parts) =>
          Object.assign(archive, parts),
      },
      "#shared/lib/utility": {
        nodeAsArray: (v) => (v == null ? [] : Array.isArray(v) ? v : [v]),
      },
      "./export/gen-utils": { getBlipRelationshipId: (relationships, path, blip) => {
        relationships[path].Relationships ||= { Relationship: [] };
        relationships[path].Relationships.Relationship.push({ $_Id: 'rIdBackground', $_Type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image', $_Target: '../media/' + blip.$_target });
        return 'rIdBackground';
      } },
      "./shapeXmlSpans": { getShapeXmlSpans },
      "./slidePackage": {},
      "./export/sort-txml": { sortTextRuns: (v) => v },
      "../common/db/opfs": { getMediaRecordFromOPFS: async () => ({ data: new Uint8Array([1, 2, 3]) }) },
      "./shapeWrappingExtension": {},
      "./slideTransitionXml": { applySlideTransition },
      "./nativeTimingXml.mjs": { applyNativeTiming },
      "./export/chart-workbook.mjs": { chartWorkbook },
    },
  );
  const shape = { id: "stable", name: "target", x: 20, y: 30, w: 100, h: 100 };
  const motion = compileMotion(
    { groups: { target: { effect: "entrance_fade", trigger: "on-click" } } },
    [shape],
    options,
  );
  const slide = { shapes: [shape], ...motion, bg: { bgPr: { solidFill: { uniClr: { $_otag: 'srgbClr', $_val: '123456' } } } } };
  assert.equal(
    await persistSlideXmlFromModel("file", "slide1", "slides", slide),
    true,
  );
  const xml = new TextDecoder().decode(archive[file]);
  const id = xml.match(/<p:cNvPr\b[^>]*\bid="(\d+)"/)?.[1];
  assert.ok(id);
  assert.ok(xml.includes(`spid="${id}"`));
  assert.match(xml, /<p:bg>.*<a:srgbClr val="123456"/);

  assert.equal(stored.data.sld.timing.m[0].sh, "stable");
  assert.equal(
    stored.data.sld.timing.m[0].nativeTiming.rowXml,
    motion.timing.m[0].nativeTiming.rowXml,
  );
  slide.bg = { bgPr: { blipFill: { blip: { $_target: 'background.png' }, stretch: { fillRect: {} } } } };
  assert.equal(await persistSlideXmlFromModel('file', 'slide1', 'slides', slide), true);
  const imageXml = new TextDecoder().decode(archive[file]);
  assert.match(imageXml, /<p:bg>.*<a:blipFill>.*r:embed="rIdBackground"/);
  assert.deepEqual([...archive['ppt/media/background.png']], [1, 2, 3]);
  assert.equal(stored.data.sld.cSld.bg.bgPr.blipFill.blip.$_target, 'background.png');
});
const marker = (kind, data, id = kind) =>
  `<g id="${id}" data-pptx-replace-with="${kind}" data-pptx-native-authority="json"><metadata type="application/json">${JSON.stringify(
    { x: 80, y: 100, width: 600, height: 300, ...data },
  )
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")}</metadata><rect width="50" height="50"/></g>`;

test("font baselines reproduce upstream PowerPoint-rendered regression samples", () => {
  for (const [family, expected] of [
    ["Arial", 38.6666666667],
    ["Calibri", 37.3333333333],
    ["SimSun", 41.3333333333],
    ["SimHei", 41.3333333333],
    ["Microsoft YaHei", 38.6666666667],
  ])
    assert.ok(
      Math.abs(
        textBaseline([{ text: "Hgpq", font_size: 40, font_family: family }]) -
          expected,
      ) < 1e-8,
      family,
    );
  assert.deepEqual(fontFaces("Helvetica Neue, PingFang SC"), {
    latin: "Arial",
    ea: "Microsoft YaHei",
  });
  assert.equal(fontFaces("Hiragino Sans", "ja-JP").ea, "Yu Gothic");
  assert.equal(fontFaces("Arial", "zh-TW").ea, "Microsoft JhengHei");
  assert.equal(
    textBaseline([{ text: "Test", font_size: 24, font_family: "Unknown" }]),
    22.666666666666668,
  );
  assert.equal(
    textBaseline([{ text: "汉字", font_size: 64, font_family: "SimSun" }]),
    66.66666666666667,
  );
});
test("native table metadata replaces fallback and retains weights, styled runs and merges", () => {
  const svg = wrap(
    marker("table", {
      columns: ["Header A", "Header B"],
      rows: [
        [{ text: "Merged", col_span: 2 }, ""],
        [
          {
            paragraphs: [
              { runs: [{ text: "Bold", bold: true }, { text: " plain" }] },
            ],
          },
          "Cell",
        ],
      ],
      column_widths: [1, 3],
      row_heights: [1, 2, 1],
      style: {
        header_fill: "#123456",
        header_text: "#ffffff",
        padding: 8,
        borders: { bottom: { width: 2, color: "#ff0000" } },
      },
    }),
  );
  const shapes = compilePageSVG(svg, options).shapes;
  assert.equal(shapes.length, 1);
  const tbl = shapes[0].graphic.graphicData.tbl;
  assert.equal(tbl.tr.length, 3);
  assert.equal(tbl.tr[1].tc[0].$_gridSpan, 2);
  assert.equal(tbl.tr[1].tc[1].$_hMerge, 1);
  assert.ok(
    Math.abs(tbl.tblGrid.gridCol[1].$_w / tbl.tblGrid.gridCol[0].$_w - 3) <
      1e-5,
  );
  assert.equal(tbl.tr[2].tc[0].txBody.p[0].r[0].rPr.$_b, 1);
  assert.equal(tbl.tr[0].tc[0].tcPr.solidFill.uniClr.$_val, "123456");
  assert.equal(tbl.tr[0].tc[0].tcPr.lnB.$_w, 19050);
  assert.throws(
    () =>
      compilePageSVG(
        wrap(marker("table", { rows: [["a"], ["b", "c"]] })),
        options,
      ),
    /rectangular/,
  );
});
test("classic and extended charts retain native caches and chart kinds", () => {
  for (const type of [
    "column",
    "bar",
    "line",
    "area",
    "pie",
    "doughnut",
    "radar",
  ]) {
    const s = compilePageSVG(
      wrap(
        marker("chart", {
          type,
          categories: ["A", "B"],
          series: [{ name: "Measured", values: [12, 20] }],
        }),
      ),
      options,
    ).shapes[0];
    assert.equal(s.type, "chart");
    const xml = txml.stringify(
      s.graphic.graphicData["c:chart"].chartJson,
      "ppt/charts/chart1.xml",
    );
    assert.equal(XMLValidator.validate(xml), true);
    assert.ok(xml.includes("<c:v>20</c:v>"));
    assert.ok(!xml.includes("NaN"));
  }
  const xy = compileNativeChart({
    type: "scatter",
    series: [
      {
        name: "XY",
        points: [
          [1, 2],
          [3, 4],
        ],
      },
    ],
  });
  assert.equal(xy.chartData.series[0].data[1][1], 4);
  for (const type of [
    "sunburst",
    "treemap",
    "funnel",
    "waterfall",
    "pareto",
    "histogram",
    "box_whisker",
  ]) {
    const p = {
      type,
      categories: ["A", "B"],
      values: [2, 3],
      levels: [
        ["Parent", "Parent"],
        ["A", "B"],
      ],
      series: [{ name: "Samples", values: [2, 3] }],
    };
    const s = compileNativeChart(p);
    const xml = txml.stringify(
      s.graphic.graphicData["c:chart"].chartJson,
      "ppt/charts/chart1.xml",
    );
    assert.equal(XMLValidator.validate(xml), true, type);
    assert.ok(xml.includes("<cx:chartSpace"), type);
    assert.ok(xml.includes("<cx:numDim"), type);
  }
  assert.throws(
    () =>
      compileNativeChart({
        type: "line",
        categories: ["a"],
        series: [{ values: [Infinity] }],
      }),
    /finite/,
  );
});
test("block and inline equations produce editable MathML and native Office Math export", () => {
  for (const latex of [
    String.raw`\frac{-b\pm\sqrt{b^2-4ac}}{2a}`,
    String.raw`\sum_{i=1}^{n}{x_i}`,
    String.raw`\begin{pmatrix}a&b\\c&d\end{pmatrix}`,
    String.raw`\left(\alpha+\beta\right)^2`,
    String.raw`\overline{x}+\mathbf{y}`,
  ]) {
    const result = compileLatex(latex),
      run = {
        $_otag: "m",
        t: result.mathML,
        docMathML: result.mathML,
        docOmml: result.omml,
        rPr: { $_sz: 2100 },
      };
    const xml = txml.stringify(nativeMathRun(run), "ppt/slides/slide1.xml");
    assert.equal(XMLValidator.validate(xml), true, latex);
    assert.ok(xml.includes("<m:oMath"));
    assert.ok(!xml.includes("<a:t>&lt;"));
  }
  const s = compilePageSVG(
    wrap(marker("formula", { latex: String.raw`\frac{x}{y}` })),
    options,
  ).shapes[0];
  assert.equal(s.txBody.p[0].r[0].$_otag, "m");
  const inline = compilePageSVG(
    wrap(
      '<text x="20" y="100">Value <tspan data-pptx-inline-formula="x_i^2">x</tspan></text>',
    ),
    options,
  ).shapes[0];
  assert.equal(inline.txBody.p[0].r[1].$_otag, "m");
  assert.throws(() => compileLatex(String.raw`\input{secret}`), /unsupported/);
});
test("Boolean operations preserve curved editable paths, holes, fragments and insertion order", () => {
  const a = "M0 0H100V100H0Z",
    b = "M50 0H150V100H50Z";
  for (const operation of [
    "union",
    "intersect",
    "subtract",
    "combine",
    "fragment",
  ]) {
    const paths = booleanPaths(operation, [a, b]);
    assert.ok(paths.length, operation);
    assert.ok(paths.every((d) => !d.includes("NaN")));
  }
  assert.equal(booleanPaths("fragment", [a, b]).length, 3);
  const result = compilePageSVG(
    wrap(
      '<rect id="a" x="10" y="20" width="100" height="100"/><circle id="b" cx="100" cy="80" r="60"/><text x="10" y="200">Retained</text>',
    ),
    {
      ...options,
      booleans: [
        { operation: "subtract", source_ids: ["a", "b"], output_id: "cut" },
      ],
    },
  ).shapes;
  assert.equal(result.length, 2);
  assert.equal(result[0].name, "cut");
  assert.equal(result[0].type, "path");
  assert.ok(result[0].d.includes("c") || result[0].d.includes("C"));
  assert.equal(result[1].type, "text");
  assert.throws(() => booleanPaths("union", ["M0 0L10 10", b]), /closed/);
});
test("all 203 upstream animation presets compile with native timing and valid exported targets", () => {
  for (const preset of presets) {
    const required = Object.fromEntries(
      Object.entries(preset.effect_options)
        .filter(([, v]) => v.required)
        .map(([k]) => [k, "Arial"]),
    );
    const motion = compileMotion(
      { groups: { target: { effect: preset.key, effect_options: required } } },
      [{ id: "shape", name: "target" }],
      { width: 1280, height: 720 },
    );
    const effect = motion.timing.m[0];
    assert.ok(effect.bh.length, preset.key);
    assert.equal(effect.sh, "shape");
    assert.ok(Number.isFinite(effect.du));
    const xml = applyNativeTiming(
      "<p:sld></p:sld>",
      motion.timing,
      new Map([["shape", "42"]]),
    );
    assert.equal(XMLValidator.validate(xml), true, preset.key);
    assert.ok(xml.includes('spid="42"'), preset.key);
    const ids = [...xml.matchAll(/<p:cTn\b[^>]*\bid="(\d+)"/g)].map(
      (m) => m[1],
    );
    assert.equal(new Set(ids).size, ids.length, preset.key);
  }
});
test("animation parameters, click targets and Boolean output IDs survive complete deck preflight", () => {
  const deck = {
    title: "Native features",
    audience: "Reviewers",
    objective: "Validate insertion",
    slides: [
      {
        title: "Native",
        purpose: "Explain",
        layout: "svg",
        svg: wrap(
          '<rect id="a" width="100" height="100"/><rect id="b" x="50" width="100" height="100"/>',
        ),
        booleans: [
          { operation: "union", source_ids: ["a", "b"], output_id: "merged" },
        ],
        motion: {
          transition: { effect: "fade", duration: 0.4 },
          groups: {
            merged: {
              effect: "emphasis_spin",
              effect_options: { amount: 180 },
              trigger: "on-click",
              trigger_shape: "merged",
              duration: 2,
            },
          },
        },
      },
    ],
  };
  validateArguments(deckSchema, deck);
  const compiled = compileDeck(deck, options);
  assert.equal(
    compiled.pages[0].timing.i[0].ef[0].sh,
    compiled.pages[0].shapes[0].id,
  );
  assert.equal(
    compiled.pages[0].timing.i[0].ef[0].trs,
    compiled.pages[0].shapes[0].id,
  );
  const proof = preflightDeckPlan(
    { calls: [{ name: "savanna_create_deck", arguments: deck }] },
    { document: { width: 1280, height: 720 } },
  );
  assert.equal(proof.compiled.pages.length, 1);
  assert.throws(
    () =>
      compileMotion({ groups: { missing: { effect: "fade" } } }, [], options),
    /does not exist/,
  );
});
test("all 48 native transition records generate their upstream effect instead of disappearing", () => {
  for (const effect of transitionNames) {
    const { transition } = compileMotion(
      { transition: { effect, duration: 0.6 } },
      [],
      options,
    );
    const xml = applySlideTransition(
      "<p:sld><p:cSld></p:cSld></p:sld>",
      transition,
    );
    assert.equal(XMLValidator.validate(xml), true, effect);
    assert.ok(
      xml.includes(
        `<${transitions[effect].prefix || "p"}:${transitions[effect].element}`,
      ),
      effect,
    );
  }
});
test("chart workbooks contain native numeric cells and preserve text rather than executing formulas", async () => {
  const rows = [
    ["Category", "Revenue"],
    ["A", 2],
    ['=HYPERLINK("bad")', 3],
  ];
  const bytes = await chartWorkbook(rows),
    reader = new ZipReader(new Uint8ArrayReader(bytes));
  const entries = await reader.getEntries();
  assert.equal(entries.length, 5);
  const sheet = await entries
    .find((e) => e.filename === "xl/worksheets/sheet1.xml")
    .getData(new TextWriter());
  assert.equal(XMLValidator.validate(sheet), true);
  assert.ok(sheet.includes("<v>2</v>"));
  assert.ok(sheet.includes('t="inlineStr"'));
  assert.ok(!sheet.includes("<f>"));
  await reader.close();
});
test("Boolean text uses actual font outlines and never inserts deferred preview geometry", () => {
  const bytes = readFileSync("editor-vuejs/public/fonts/Carlito-Regular.ttf"),
    font = opentype.parse(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    ),
    fonts = new Map([["carlito", font]]);
  const svg = wrap(
      '<text id="word" x="30" y="140" font-family="Carlito" font-size="100">Hello</text><rect id="cut" x="20" y="100" width="300" height="40"/>',
    ),
    booleans = [
      {
        operation: "subtract",
        source_ids: ["word", "cut"],
        output_id: "word-cut",
      },
    ];
  const deferred = compilePageSVG(svg, {
    ...options,
    booleans,
    deferTextOutlines: true,
  });
  assert.equal(deferred.shapes[0].pendingNative, true);
  const actual = compilePageSVG(svg, {
    ...options,
    booleans,
    outlineText: (s) => outlineNativeText(s, fonts),
  });
  assert.equal(actual.shapes[0].type, "path");
  assert.equal(actual.shapes[0].txBody, undefined);
  assert.equal(actual.shapes[0].noFill, false);
  assert.ok(actual.shapes[0].d.length > 500);
  assert.equal(actual.shapes[0].pendingNative, undefined);
  assert.throws(
    () => compilePageSVG(svg, { ...options, booleans }),
    /font contours/,
  );
});
test("real shape export writes chart relationships, workbook parts and native equation runs", () => {
  const cleanupJson = (o) => {
    for (const key of Object.keys(o)) {
      if (o[key] === null || o[key] === undefined || Number.isNaN(o[key]))
        delete o[key];
      else if (typeof o[key] === "object") cleanupJson(o[key]);
    }
  };
  const utils = load("shared-vuejs/src/edlib/pptx/export/gen-utils.ts", {
    "#shared/lib/colorUtils": {},
  });
  const wrapping = load(
    "shared-vuejs/src/edlib/pptx/shapeWrappingExtension.ts",
  );
  const sorting = load("shared-vuejs/src/edlib/pptx/export/sort-txml.ts");
  const { genShape } = load("shared-vuejs/src/edlib/pptx/export/gen-shape.ts", {
    "#shared/lib/utility": {
      nodeAsArray: (v) => (v == null ? [] : Array.isArray(v) ? v : [v]),
      round: Math.round,
    },
    "#shared/lib/genSVGPaths": {},
    "./gen-utils": utils,
    "#shared/lib/globalUtility": { EMU: 9525 },
    "#shared/lib/slideUtils": { cleanupJson },
    "./txml-utils": {},
    "../../ink/exportInk": {},
    "./sort-txml": sorting,
    "../shapeWrappingExtension": wrapping,
    "./native-math.mjs": { nativeMathRun },
  });
  for (const type of ["line", "waterfall"]) {
    const s = {
      id: "chart",
      name: "Chart",
      x: 0,
      y: 0,
      w: 600,
      h: 300,
      ...compileNativeChart({
        type,
        categories: ["A", "B"],
        values: [2, 3],
        series: [{ name: "Data", values: [2, 3] }],
      }),
    };
    const json = { "[Content_Types].xml": { Types: { Override: [] } } },
      node = genShape(
        s,
        { id: 2 },
        {},
        "ppt/slides/_rels/slide1.xml.rels",
        "sld",
        json,
        new Set(),
      );
    const xml = txml.stringify(node, "ppt/slides/slide1.xml");
    assert.equal(XMLValidator.validate(xml), true);
    assert.ok(xml.includes(type === "line" ? "<c:chart" : "<cx:chart"));
    assert.ok(
      json["ppt/embeddings/Microsoft_Excel_Worksheet1.xlsx"].__chartWorkbook
        .length,
    );
    assert.ok(
      json["ppt/charts/_rels/chart1.xml.rels"].Relationships.Relationship.some(
        (r) => r.$_Type.endsWith("/package"),
      ),
    );
    assert.ok(
      txml
        .stringify(json["ppt/charts/chart1.xml"], "ppt/charts/chart1.xml")
        .includes("externalData"),
    );
  }
  const formula = compilePageSVG(
    wrap(marker("formula", { latex: String.raw`\frac{x}{y}` })),
    options,
  ).shapes[0];
  const exported = genShape(
    formula,
    { id: 2 },
    {},
    "ppt/slides/_rels/slide1.xml.rels",
    "sld",
    {},
    new Set(),
  );
  const xml = txml.stringify(
    sorting.sortTextRuns(exported),
    "ppt/slides/slide1.xml",
  );
  assert.equal(XMLValidator.validate(xml), true);
  assert.ok(xml.includes("<a14:m"));
  assert.ok(xml.includes("<m:f>"));
  assert.ok(!xml.includes("docOmml"));
});


test("unannotated positioned paragraph rows become one editable frame", () => {
  const shapes = compilePageSVG(wrap('<text x="30" y="100" font-size="24"><tspan x="30" dy="0">• First item</tspan><tspan x="30" dy="36">Second <tspan font-weight="bold">item</tspan></tspan></text>'), options).shapes;
  assert.equal(shapes.length, 1);
  assert.equal(shapes[0].txBody.p.length, 2);
  assert.equal(shapes[0].txBody.p[0].pPr.buChar.$_char, '•');
  assert.equal(shapes[0].txBody.p[1].r[1].rPr.$_b, 1);
});

test("adjacent text rows group across whitespace and retain lines, bullet styling and spacing", () => {
  const shapes = compilePageSVG(wrap('<g font-size="24" fill="#123456"><text x="50" y="100">First line</text>\n<text x="50" y="136">• Second line</text>\n<text x="50" y="172">Third line</text></g>'), options).shapes;
  assert.equal(shapes.length, 1);
  assert.equal(shapes[0].txBody.p.length, 3);
  assert.equal(shapes[0].txBody.p[2].r[0].t, 'Third line');
  assert.equal(shapes[0].txBody.p[1].pPr.buChar.$_char, '•');
  assert.equal(shapes[0].txBody.p[0].pPr.lnSpc.spcPts.$_val, 2700);
});

test("paragraph inference preserves independent columns, headings, objects and irregular rows", () => {
  const cases = [
    '<text x="30" y="100">A</text><text x="300" y="136">B</text>',
    '<text x="30" y="100" font-size="40">Title</text><text x="30" y="136" font-size="24">Body</text>',
    '<text x="30" y="100" id="a">A</text><text x="30" y="136" id="b">B</text>',
    '<text x="30" y="100">A</text><rect x="0" y="0" width="10" height="10"/><text x="30" y="136">B</text>',
    '<g><text x="30" y="100">A</text></g><g><text x="30" y="136">B</text></g>',
    '<text x="30" y="100"><tspan x="30" dy="0">A</tspan><tspan x="300" dy="36">B</tspan></text>',
    '<text x="30" y="100"><tspan x="30" dy="0">A</tspan><tspan x="30" dy="36">B</tspan><tspan x="30" dy="100">C</tspan></text>',
  ];
  for (const body of cases) {
    const shapes = compilePageSVG(wrap(body), options).shapes.filter(shape => shape.txBody);
    assert.ok(shapes.length >= 2, body);
  }
});

test('interleaved column rows merge into one textbox per column', () => {
  const shapes = compilePageSVG(wrap(`<g font-size="24" fill="#172923">
    <text x="80" y="180">Left first</text><text x="680" y="180">Right first</text>
    <text x="80" y="216">Left second</text><text x="680" y="216">Right second</text>
    <text x="80" y="252">Left third</text><text x="680" y="252">Right third</text>
  </g>`), options).shapes;
  assert.equal(shapes.length, 2);
  assert.deepEqual(shapes.map(shape => shape.txBody.p.map(p => p.r.map(r => r.t).join(''))), [
    ['Left first', 'Left second', 'Left third'], ['Right first', 'Right second', 'Right third'],
  ]);
  assert.ok(Math.abs(shapes[1].x - shapes[0].x - 600) < 1e-8);
});

test('column headings and differing column styles remain separate from their merged body text', () => {
  const shapes = compilePageSVG(wrap(`<text x="80" y="140" font-size="36">Left heading</text>
    <text x="680" y="140" font-size="36">Right heading</text>
    <text x="80" y="200" font-size="24" fill="#123456">Left body 1</text>
    <text x="680" y="200" font-size="22" fill="#654321">Right body 1</text>
    <text x="80" y="236" font-size="24" fill="#123456">Left body 2</text>
    <text x="680" y="233" font-size="22" fill="#654321">Right body 2</text>`), options).shapes;
  assert.equal(shapes.length, 4);
  assert.deepEqual(shapes.map(shape => shape.txBody.p.length), [1, 1, 2, 2]);
});


test('rounded card text and image captions merge with their shared center or right anchor', () => {
  for (const anchor of ['middle', 'end']) {
    const body = `<rect x="100" y="80" width="400" height="180" rx="24" fill="#eeeeee"/>
      <g text-anchor="${anchor}" font-size="24">
        <text x="300" y="140">Short</text><text x="300" y="176">Longer card text</text>
      </g>
      <text x="800" y="500" text-anchor="${anchor}" font-size="18">Image caption</text>
      <text x="800" y="527" text-anchor="${anchor}" font-size="18">Second caption line</text>`;
    const merged = compilePageSVG(wrap(body), options).shapes.filter(s => s.txBody);
    assert.equal(merged.length, 2);
    for (const [i, shape] of merged.entries()) {
      assert.equal(shape.txBody.p.length, 2);
      assert.ok(shape.txBody.p.every(p => p.pPr.$_algn === (anchor === 'middle' ? 'ctr' : 'r')));
      const longest = i === 0 ? 'Longer card text' : 'Second caption line';
      const original = compilePageSVG(wrap(`<text x="${i === 0 ? 300 : 800}" y="${i === 0 ? 140 : 500}" text-anchor="${anchor}" font-size="${i === 0 ? 24 : 18}">${longest}</text>`), options).shapes[0];
      if (anchor === 'end' && i === 0) {
        const pad = shape.svgTextWidthPadding;
        assert.ok(shape.x >= 100);
        assert.ok(Math.abs(shape.x + shape.w - pad - 300) < 1e-8);
      } else {
        assert.ok(Math.abs(shape.x - original.x) < 1e-8);
        assert.ok(Math.abs(shape.w - original.w) < 1e-8);
      }
      assert.ok(shape.txBody.bodyPr.$_rIns > 0);
    }
  }
});

test('centered multiline tspans merge while separate card groups stay separate', () => {
  const shapes = compilePageSVG(wrap(`<g text-anchor="middle" font-size="24">
    <g><text x="300" y="100"><tspan x="300" dy="0">First card</tspan><tspan x="300" dy="36">Second line</tspan></text></g>
    <g><text x="300" y="172">Other card</text><text x="300" y="208">Other line</text></g>
  </g>`), options).shapes;
  assert.equal(shapes.length, 2);
  assert.deepEqual(shapes.map(s => s.txBody.p.length), [2, 2]);
});


test('Gemini card body rows with loose and variable bullet spacing merge per card', () => {
  const shapes = compilePageSVG(wrap(`<rect x="80" y="180" width="540" height="480" rx="16" fill="#ffffff"/>
    <text x="150" y="250" font-size="20" font-weight="bold">Mục tiêu chiến lược 2030 - 2045</text>
    <text x="150" y="280" font-size="15">Tầm nhìn đến 100 năm thành lập nước</text>
    <g font-size="16" fill="#333333">
      <text x="120" y="330">• Đến năm 2030: Là nước đang phát triển,</text>
      <text x="120" y="360">có công nghiệp hiện đại, thu nhập trung bình cao.</text>
      <text x="120" y="405">• Đến năm 2045: Trở thành nước phát triển,</text>
      <text x="120" y="435">thu nhập cao theo định hướng xã hội chủ nghĩa.</text>
    </g>
    <rect x="660" y="180" width="540" height="480" rx="16" fill="#ffffff"/>
    <g font-size="16" fill="#333333">
      <text x="700" y="330">• Kiên định chủ nghĩa Mác - Lênin và tư tưởng Hồ Chí Minh.</text>
      <text x="700" y="370">• Đẩy mạnh đấu tranh phòng, chống tham nhũng, tiêu cực.</text>
      <text x="700" y="410">• Xây dựng đội ngũ cán bộ đủ phẩm chất, năng lực và uy tín.</text>
      <text x="700" y="450">• Thắt chặt mối quan hệ mật thiết giữa Đảng và Nhân dân.</text>
    </g>`), options).shapes.filter(shape => shape.txBody);
  assert.equal(shapes.length, 4); // Heading, subheading, and one body per card.
  const [left,right] = shapes.slice(2);
  assert.equal(left.txBody.p.length, 4); assert.equal(right.txBody.p.length, 4);
  assert.equal(left.txBody.p[0].pPr.lnSpc.spcPts.$_val, 30*75);
  assert.equal(left.txBody.p[2].pPr.spcBef.spcPts.$_val, 15*75);
  assert.equal(right.txBody.p[0].pPr.lnSpc.spcPts.$_val, 40*75);
  assert.ok(left.h >= 105+24); assert.ok(right.h >= 120+24);
  assert.ok(left.x+left.w<=620); assert.ok(right.x+right.w<=1200);
  assert.ok(right.txBody.p.every(p=>p.pPr.buChar.$_char==='•'));
});

test('unannotated tspans preserve larger paragraph gaps in one textbox', () => {
  const [shape] = compilePageSVG(wrap(`<text x="100" y="100" font-size="16">
    <tspan x="100" y="100">One</tspan><tspan x="100" y="130">Two</tspan>
    <tspan x="100" y="175">Three</tspan><tspan x="100" y="205">Four</tspan>
  </text>`), options).shapes;
  assert.equal(shape.txBody.p.length,4);
  assert.equal(shape.txBody.p[2].pPr.spcBef.spcPts.$_val,1125);
  assert.equal(shape.h,129);
});

test('resolved caption formatting merges across CSS, inherited attributes and wrapper groups', () => {
  const shapes = compilePageSVG(wrap(`<g style="font-family:Arial">
    <rect x="837" y="193" width="387" height="482" fill="#eae1d0"/>
    <text x="858" y="550" font-size="26" font-weight="bold" fill="#a42b2b">Quảng trường Ba Đình</text>
    <g><text x="858" y="585" style="font-size:24px;fill:#514b43">Nơi Chủ tịch Hồ Chí Minh</text></g>
    <g font-size="24" fill="#514b43"><text x="858" y="616">đọc Tuyên ngôn Độc lập</text></g>
    <text x="858" y="647" font-size="24" fill="#514b43">ngày 2/9/1945.</text>
    <text x="181" y="478" style="font-size:24px;fill:#292722">30/4: kết thúc chiến tranh,</text>
    <text x="181" y="507" font-size="24" fill="#292722">thống nhất đất nước.</text>
  </g>`), options).shapes.filter(shape => shape.txBody);
  assert.equal(shapes.length, 3);
  assert.equal(shapes[0].txBody.p.length, 1);
  assert.deepEqual(shapes[1].txBody.p.map(p=>p.r.map(r=>r.t).join('')), ['Nơi Chủ tịch Hồ Chí Minh','đọc Tuyên ngôn Độc lập','ngày 2/9/1945.']);
  assert.deepEqual(shapes[2].txBody.p.map(p=>p.r.map(r=>r.t).join('')), ['30/4: kết thúc chiến tranh,','thống nhất đất nước.']);
  assert.equal(shapes[1].txBody.p[0].pPr.lnSpc.spcPts.$_val,31*75);
  assert.equal(shapes[2].txBody.p[0].pPr.lnSpc.spcPts.$_val,29*75);
  assert.ok(shapes.every(shape=>!('paragraphInferenceBlocked' in shape)));
});

test('timeline year labels remain independent even when their spacing is under three font heights', () => {
  const years=['1930','1945','1954','1975','1986','2021'];
  const shapes=compilePageSVG(wrap(years.map((year,index)=>`<text x="54" y="${214+index*78}" font-size="30" font-weight="bold">${year}</text>`).join('')),options).shapes;
  assert.equal(shapes.length,6);
  assert.deepEqual(shapes.map(shape=>shape.txBody.p[0].r[0].t),years);
});

test('resolved-text merging retains authored identities and separate event headings', () => {
  const shapes=compilePageSVG(wrap(`<g style="font-family:Arial;font-size:24px">
    <text id="first" x="100" y="100">A protected paragraph line</text>
    <text id="second" x="100" y="132">Another protected paragraph</text>
    <text x="100" y="200" font-weight="bold">First event heading</text>
    <text x="100" y="232">First event description</text>
    <text x="100" y="264" font-weight="bold">Second event heading</text>
    <text x="100" y="296">Second event description</text>
  </g>`),options).shapes;
  assert.equal(shapes.length,6);
  assert.ok(shapes.every(shape=>shape.txBody.p.length===1));
});

test('resolved caption merging keeps center/right anchors and short final lines', () => {
  for(const anchor of ['middle','end']) {
    const body=`<g style="font-family:Arial;font-size:24px;text-anchor:${anchor};fill:#333333">
      <g><text x="600" y="200">A caption with a longer first line</text></g>
      <g><text x="600" y="232">A second caption line</text></g>
      <g><text x="600" y="264">The end.</text></g>
    </g>`;
    const [merged,...rest]=compilePageSVG(wrap(body),options).shapes;
    assert.equal(rest.length,0);
    assert.equal(merged.txBody.p.length,3);
    assert.ok(merged.txBody.p.every(p=>p.pPr.$_algn===(anchor==='middle'?'ctr':'r')));
    const original=compilePageSVG(wrap(`<text x="600" y="200" font-family="Arial" font-size="24" fill="#333333" text-anchor="${anchor}">A caption with a longer first line</text>`),options).shapes[0];
    assert.ok(Math.abs(merged.x-original.x)<1e-8);
    assert.ok(Math.abs(merged.w-original.w)<1e-8);
  }
});

test('resolved formatting also preserves loose bullet gaps across wrapper groups', () => {
  const shapes=compilePageSVG(wrap(`<g style="font-family:Arial;font-size:16px;fill:#333333">
    <g><text x="120" y="330">• First bullet paragraph</text></g>
    <g><text x="120" y="360">Continuation of the first bullet.</text></g>
    <g><text x="120" y="405">• Second bullet paragraph</text></g>
    <g><text x="120" y="435">Continuation of the second bullet.</text></g>
  </g>`),options).shapes;
  assert.equal(shapes.length,1);
  assert.equal(shapes[0].txBody.p.length,4);
  assert.equal(shapes[0].txBody.p[2].pPr.spcBef.spcPts.$_val,15*75);
});

test('long SVG paragraph blocks wrap within their cards and grow vertically instead of crossing columns', () => {
  const body = [72,462,852].map((left,index) => `<rect x="${left}" y="150" width="356" height="520" rx="18" fill="#222222"/>
    <text x="${left+28}" y="235" font-size="15" font-family="Arial" data-paragraph-line-height="24">
      <tspan x="${left+28}" y="235" font-weight="bold">${index+1}. Background:</tspan>
      <tspan x="${left+28}" y="259">Originates from the ancient Celtic festival of Samhain, when people lit bonfires and wore costumes to ward off ghosts.</tspan>
      <tspan x="${left+28}" y="283" font-weight="bold">The Veil Thins:</tspan>
      <tspan x="${left+28}" y="307">Celts believed the boundary between the worlds of the living and the dead blurred on October 31.</tspan>
    </text>`).join('');
  const text=compilePageSVG(wrap(body),options).shapes.filter(shape=>shape.type==='text');
  assert.equal(text.length,3);
  for(const [index,shape] of text.entries()){
    assert.equal(shape.w,300);
    assert.ok(shape.x+shape.w < [428,818,1208][index]);
    assert.ok(shape.h>150); assert.ok(shape.y+shape.h<670);
    assert.equal(shape.autosize,true);
    assert.equal(shape.txBody.bodyPr.$_wrap,'square');
    assert.equal(shape.txBody.p.length,4);
  }
});

test('text on the right side of a large panel does not collapse from mirrored margins', () => {
  const page=compilePageSVG(wrap('<rect x="80" y="80" width="1120" height="560" fill="#ffffff"/><text x="951" y="150" font-family="Source Sans 3" font-size="20">Đinh Mùi</text>'), options);
  const text=page.shapes.find(shape=>shape.type==='text');
  assert.ok(text.w>80,`Unexpected narrow frame: ${text.w}`);
  assert.ok(text.x+text.w<=1200);
  assert.equal(text.txBody.bodyPr.$_wrap,'square');
});

test('canvas measurement quotes Google font names with numbers and keeps point sizes correct', async () => {
  const {canvasTextMeasurer}=await import('../editor-vuejs/src/lib/agent/deck-text.mjs');
  let active='10px sans-serif';
  const context={set font(value){assert.match(value,/"Source Sans 3"$/);active=value;},measureText(text){return {width:text.length*parseFloat(active.split(' ')[1])*.5};}};
  const measure=canvasTextMeasurer(context);
  assert.equal(measure('Tết Nguyên Đán 2027',27,'Source Sans 3','bold'),'Tết Nguyên Đán 2027'.length*18);
  assert.equal(active,'bold 36px "Source Sans 3"');
});

test('an inferred panel edge cannot collapse centered text into a one-pixel textbox', () => {
  const page=compilePageSVG(wrap('<rect x="300" y="100" width="200" height="150" fill="#ffffff"/><text x="300" y="150" text-anchor="middle" font-size="24">Centered heading</text>'), options);
  const text=page.shapes.find(shape=>shape.type==='text');
  assert.ok(text.w>100);
  assert.equal(text.txBody.p[0].pPr.$_algn,'ctr');
});
