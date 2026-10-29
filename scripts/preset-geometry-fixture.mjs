import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import ts from 'typescript';

// Exercise real preset formulas while excluding browser initialization from the
// shared utility modules. Select their actual pure helper implementations.
const functions = new Set(['nodeAsArray', 'roundNum', 'round3', 'degToEllipsePoints']);
const source = await readFile('shared-vuejs/src/lib/utility.js', 'utf8');
const ast = ts.createSourceFile('utility.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const helpers = ast.statements.filter(node => ts.isFunctionDeclaration(node) && functions.has(node.name?.text)).map(node => node.getText(ast)).join('\n');
const globals = await readFile('shared-vuejs/src/lib/globalUtility.ts', 'utf8');
const globalAst = ts.createSourceFile('globalUtility.ts', globals, ts.ScriptTarget.Latest, true);
const emu = globalAst.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(decl => decl.name.getText(globalAst) === 'EMU')).getText(globalAst);

export function presetGeometryPlugin() {
  return { name: 'real-preset-geometry', setup(build) {
    build.onResolve({ filter: /^shared-vuejs\/api\/shapeImportUtils$/ }, () => ({ path: resolve('shared-vuejs/src/edlib/pptx/prst/presetInfo.ts') }));
    build.onResolve({ filter: /^#shared\/lib\/(utility|globalUtility)$/ }, args => ({ path: args.path, namespace: 'preset-helper' }));
    build.onLoad({ filter: /.*/, namespace: 'preset-helper' }, args => ({ contents: args.path.endsWith('/utility') ? helpers : emu, loader: 'ts' }));
  } };
}
