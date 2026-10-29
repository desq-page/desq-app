// Exercise the actual PPTX text serializer on HTML-generated native text frames.
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { nativeMathRun } from "../shared-vuejs/src/edlib/pptx/export/native-math.mjs";
function load(file, dependencies = {}) {
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
        if (!(name in dependencies))
          throw Error("Unexpected serializer dependency: " + name);
        return dependencies[name];
      },
    },
  );
  return exports;
}
export function exportNativeHTMLText(shapes) {
  const cleanupJson = (value) => {
    for (const key of Object.keys(value)) {
      if (
        value[key] === null ||
        value[key] === undefined ||
        Number.isNaN(value[key])
      )
        delete value[key];
      else if (typeof value[key] === "object") cleanupJson(value[key]);
    }
  };
  const { genShape } = load("shared-vuejs/src/edlib/pptx/export/gen-shape.ts", {
    "#shared/lib/utility": {
      nodeAsArray: (v) => (v == null ? [] : Array.isArray(v) ? v : [v]),
      round: Math.round,
    },
    "#shared/lib/genSVGPaths": {},
    "./gen-utils": load("shared-vuejs/src/edlib/pptx/export/gen-utils.ts", {
      "#shared/lib/colorUtils": {},
    }),
    "#shared/lib/globalUtility": { EMU: 9525 },
    "#shared/lib/slideUtils": { cleanupJson },
    "./txml-utils": {},
    "../../ink/exportInk": {},
    "./sort-txml": load("shared-vuejs/src/edlib/pptx/export/sort-txml.ts"),
    "../shapeWrappingExtension": load(
      "shared-vuejs/src/edlib/pptx/shapeWrappingExtension.ts",
    ),
    "./native-math.mjs": { nativeMathRun },
  });
  return shapes.map((shape, index) =>
    genShape(
      shape,
      { id: index + 2 },
      {},
      "ppt/slides/_rels/slide1.xml.rels",
      "sld",
      {},
      new Set(),
    ),
  );
}
