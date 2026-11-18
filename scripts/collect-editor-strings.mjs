import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const app = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspace = dirname(app);
const roots = ["desq-app/editor-vuejs/src", "desq-app/editor-vanjs/src", "desq-core/shared-vuejs/src", "desq-core/player/src"];
const extensions = new Set([".vue", ".js", ".jsx", ".ts", ".tsx", ".mjs"]);
const patterns = [
  /\b(?:label|caption|title|tooltip|placeholder|aria-label|alt|tab|message|description)\s*[:=]\s*(["'`])([^\r\n]*?)\1/g,
  /\b(?:showError|showMessage|showProgress|confirm|Error)\(\s*(["'`])([^\r\n]*?)\1/g,
  /\.textContent\s*=\s*(["'`])([^\r\n]*?)\1/g,
  />\s*()([A-Za-z][^<>{}\r\n]*?)\s*</g,
];
const sources = new Map();

async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!["dist", "node_modules", "vendor", "__tests__"].includes(entry.name)) await collect(path);
      continue;
    }
    if (!extensions.has(extname(path)) || /\.(test|spec|d)\./.test(entry.name)) continue;
    const code = await readFile(path, "utf8");
    for (const pattern of patterns) {
      for (const [, , value] of code.matchAll(pattern)) {
        const source = value.trim();
        if (source.length > 300 || !/[A-Za-z]/.test(source) || /^(https?:|[#./@])/.test(source)) continue;
        if (!sources.has(source)) sources.set(source, new Set());
        sources.get(source).add(relative(workspace, path));
      }
    }
  }
}

for (const root of roots) await collect(join(workspace, root));
const inventory = Object.fromEntries(
  [...sources].sort(([a], [b]) => a.localeCompare(b, "en")).map(([source, paths]) => [source, [...paths].sort()]),
);
await writeFile(join(app, "editor-vuejs/src/lib/i18n/source-inventory.json"), JSON.stringify(inventory, null, 2) + "\n");
console.log(`Collected ${sources.size} candidate source strings.`);
