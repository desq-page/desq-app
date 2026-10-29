const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const { parse, compileScript, compileTemplate } = require("@vue/compiler-sfc");

const root = path.resolve(__dirname, "../..");
const consumerRequire = require("node:module").createRequire(path.join(root, "editor-vuejs/package.json"));
const sharedDist = path.resolve(path.dirname(consumerRequire.resolve("shared-vuejs/editor")), "..");
const read = (file) => {
  const filename = file.startsWith("shared-vuejs/src/")
    ? path.join(sharedDist, file.slice("shared-vuejs/src/".length).replace(/\.(tsx?|jsx)$/, ".js"))
    : path.join(root, file);
  return fs.readFileSync(filename, "utf8");
};

// Isolate the production geometry functions from browser/store initialization.
// Only preset dispatch and shape storage are replaced below.
function extractFunctions(file, names, text = read(file)) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  return names.map((name) => {
    const node = source.statements.find(
      (node) => ts.isFunctionDeclaration(node) && node.name?.text === name,
    );
    assert.ok(node, `Missing production function: ${name}`);
    return node.getText(source).replace(/^export /, "");
  }).join("\n");
}

const componentFile = "editor-vuejs/src/components/editor/AutoShapes/AutoShapes.vue";
const component = parse(read(componentFile), { filename: componentFile });
const script = component.descriptor.scriptSetup.content;
const geometry = [
  extractFunctions("shared-vuejs/src/lib/utility.js", [
    "parseShapePath", "buildShapePath", "cloneArray", "inArray",
    "round3", "roundNum", "nodeAsArray",
  ]),
  extractFunctions("shared-vuejs/src/lib/genSVGPaths.ts", ["resizePath"]),
  extractFunctions("shared-vuejs/src/edlib/pptx/shapes/presetUtils.js", ["shapeStar"]),
  extractFunctions("shared-vuejs/src/edlib/pptx/shapes/presetUtils.js", ["shapeArc", "polarToCartesian"]),
  extractFunctions("shared-vuejs/src/edlib/autoshapes/addDrawShape.ts", ["refreshAdjustablePreset"]),
  extractFunctions("shared-vuejs/src/edlib/pptx/prst/prstFlowchart.ts", [
    "calcPrstFlowchart", "getAdj",
  ]),
  extractFunctions("shared-vuejs/src/edlib/pptx/prst/prstArrow.ts", ["calcPrstArrow"]),
  "const EMU = 9525;",
  extractFunctions("shared-vuejs/src/edlib/autoshapes/drawSpecialshapes.ts", [
    "drawSvgAutoshape",
  ]),
  extractFunctions("AutoShapes.ts", ["getPaths"], script),
  "const getPrstInfo = (prst, w, h) => prst.$_prst.startsWith('curved') ? calcPrstArrow(prst, w, h) : calcPrstFlowchart(prst, w, h);",
  "return { getPaths, drawSvgAutoshape, parseShapePath, refreshAdjustablePreset, getPrstInfo };",
].join("\n");

let inserted;
const api = new Function("addShapeRaw", "genId", "g", ts.transpile(geometry, {
  target: ts.ScriptTarget.ES2020,
}))(
  (shape) => { inserted = shape; },
  () => "test-shape",
  { themeOverrides: { common: { primaryColor: "#000000" } } },
);

function bounds(d) {
  const points = api.parseShapePath(d)
    .filter((command) => ["M", "L"].includes(command.c))
    .map((command) => command.p);
  assert.ok(points.length > 0);
  assert.ok(points.every((point) => point.every(Number.isFinite)));
  return [0, 1].map((axis) =>
    Math.max(...points.map((point) => point[axis])) -
    Math.min(...points.map((point) => point[axis])),
  );
}

describe("AutoShapes preset sizing", () => {
  for (const name of ["curvedLeftArrow", "curvedRightArrow", "curvedUpArrow", "curvedDownArrow"]) {
    it(`refreshes ${name} arcs while changing aspect ratio`, () => {
      const prstGeom = { $_prst: name };
      const shape = { prstGeom, ...api.getPrstInfo(prstGeom, 1, 1) };
      for (const [w, h] of [[200, 80], [80, 200], [150, 150]]) {
        Object.assign(shape, { w, h });
        api.refreshAdjustablePreset(shape);
        assert.equal(shape.d, api.getPrstInfo(prstGeom, w, h).d);
        const arcs = api.parseShapePath(shape.d).filter(command => command.c === "A");
        assert.ok(arcs.length > 0);
        assert.ok(arcs.every(arc => arc.p.every(Number.isFinite)));
      }
    });
  }
  it("refreshes Magnetic Tape arcs for wide and tall drawing bounds", () => {
    const prstGeom = { $_prst: "flowChartMagneticTape" };
    const shape = { prstGeom, ...api.getPrstInfo(prstGeom, 1, 1) };
    for (const [w, h] of [[200, 80], [80, 200], [150, 150]]) {
      Object.assign(shape, { w, h });
      api.refreshAdjustablePreset(shape);
      const expected = api.getPrstInfo(prstGeom, w, h);
      assert.equal(shape.d, expected.d);
      const arcs = api.parseShapePath(shape.d).filter(command => command.c === "A");
      assert.equal(arcs.length, 4);
      assert.ok(arcs.every(arc => arc.p[0] === w / 2 && arc.p[1] === h / 2));
      assert.ok(arcs.every(arc => arc.p.every(Number.isFinite)));
    }
  });
  it("compiles the Vue component", () => {
    assert.deepEqual(component.errors, []);
    compileScript(component.descriptor, { id: "autoshapes-test" });
    assert.deepEqual(compileTemplate({
      source: component.descriptor.template.content,
      filename: componentFile,
      id: "autoshapes-test",
    }).errors, []);
  });

  for (const count of [4, 5, 6, 7, 8, 10, 12, 16, 24, 32]) {
    it(`normalizes star${count} for preview and insertion`, () => {
      const shape = { prst: `star${count}`, n: `${count}-Point Star` };
      api.getPaths(shape);
      const preview = shape.d;
      assert.ok(bounds(preview).every((size) => size > 80 && size <= 100.002));
      api.getPaths(shape);
      assert.equal(shape.d, preview, "Repeated renders must not accumulate scaling");
      api.drawSvgAutoshape(shape, 0, 0, 200, 200);
      assert.equal(inserted.w, 200);
      assert.equal(inserted.h, 200);
      assert.ok(bounds(inserted.d).every((size) => size > 160 && size <= 200.004));
      if (count === 4) assert.deepEqual(bounds(inserted.d), [200, 200]);
      api.drawSvgAutoshape(shape, 0, 0, 150, 150, 1.5);
      assert.ok(bounds(inserted.d).every((size) => size > 120 && size <= 150.004));
    });
  }

  it("preserves sizing for a preset without a scale transform", () => {
    const shape = { prst: "diamond", n: "Diamond" };
    api.getPaths(shape);
    assert.deepEqual(bounds(shape.d), [100, 100]);
    api.drawSvgAutoshape(shape, 0, 0, 200, 200);
    assert.deepEqual(bounds(inserted.d), [200, 200]);
  });
});
