import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { parse } from '@vue/compiler-sfc';
import { createEditorTools } from '../editor-vuejs/src/lib/agent/editor-tools.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const src = path.join(root, 'editor-vuejs/src');
const records = new Map();
function record(module, symbol, kind, local, filename) {
  const key = JSON.stringify([module, symbol, kind]);
  const row = records.get(key) || { module, symbol, kind, usages: [] };
  const file = path.relative(root, filename);
  if (!row.usages.some(use => use.file === file && use.local === local)) row.usages.push({ file, local });
  records.set(key, row);
}
async function scan(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const filename = path.join(dir, entry.name);
    if (entry.isDirectory()) { await scan(filename); continue; }
    if (!/\.(?:vue|[cm]?js|tsx?)$/.test(filename)) continue;
    const source = await readFile(filename, 'utf8');
    const scripts = filename.endsWith('.vue') ? (() => { const { descriptor } = parse(source); return [descriptor.script?.content, descriptor.scriptSetup?.content].filter(Boolean); })() : [source];
    for (const script of scripts) {
      const ast = ts.createSourceFile(filename, script, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      function visit(node) {
        if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text.startsWith('shared-vuejs')) {
          const module = node.moduleSpecifier.text, clause = node.importClause;
          if (!clause) record(module, '*', 'side-effect', '', filename);
          if (clause?.name) record(module, 'default', clause.isTypeOnly ? 'type' : 'default', clause.name.text, filename);
          if (clause?.namedBindings) {
            if (ts.isNamespaceImport(clause.namedBindings)) record(module, '*', 'namespace', clause.namedBindings.name.text, filename);
            else for (const spec of clause.namedBindings.elements) record(module, (spec.propertyName || spec.name).text, clause.isTypeOnly || spec.isTypeOnly ? 'type' : 'named', spec.name.text, filename);
          }
        }
        if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text.startsWith('shared-vuejs'))
          record(node.arguments[0].text, '*', 'dynamic module', '', filename);
        ts.forEachChild(node, visit);
      }
      visit(ast);
    }
  }
}
await scan(src);
const exports = [...records.values()].sort((a, b) => a.module.localeCompare(b.module) || a.symbol.localeCompare(b.symbol));
const tools = createEditorTools({}).listTools();
const report = { note: 'Consumed public imports are an implementation inventory, not automatically executable agent commands. Helpers, getters, types and UI/DOM operations need individual review and JSON adapters.', consumedImportCount: exports.length, moduleCount: new Set(exports.map(row => row.module)).size, agentToolCount: tools.length,
  tools: tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })), exports };
await writeFile(path.join(root, 'editor-vuejs/docs/agent-api-inventory.json'), JSON.stringify(report, null, 2) + '\n');
const escape = text => text.replaceAll('|', '\\|').replaceAll('\n', ' ');
const lines = ['# Consumed shared-library API and agent tools', '', report.note, '', `${report.consumedImportCount} consumed imports across ${report.moduleCount} modules; ${tools.length} registered agent tools.`, '', '## Registered agent tools', '', ...tools.map(tool => `- **${tool.name}**: ${tool.description}`), '', '## Consumed public imports', '', 'Regenerate with `npm run inventory:editor-agent`. Full source usages and tool schemas are in `agent-api-inventory.json`.', '', '| Module | Symbol | Import kind | Source files | Used by agent adapter |', '| --- | --- | --- | ---: | --- |',
  ...exports.map(row => `| ${escape(row.module)} | ${escape(row.symbol)} | ${row.kind} | ${new Set(row.usages.map(use => use.file)).size} | ${row.usages.some(use => use.file.endsWith('/agent/editor-adapter.ts')) ? 'Yes (through a wrapper)' : 'No'} |`), ''];
await writeFile(path.join(root, 'editor-vuejs/docs/agent-api-inventory.md'), lines.join('\n'));
console.log(`Inventoried ${exports.length} public imports; ${tools.length} registered agent tools.`);
