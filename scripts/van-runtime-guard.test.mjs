import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vanRuntimeGuard } from './van-runtime-guard.mjs';
const chunk = (fileName, packages, imports = []) => ({ type: 'chunk', fileName, imports,
  modules: Object.fromEntries(packages.map(name => [`/app/node_modules/${name}/index.js`, {}])) });
function verify(chunks) {
  vanRuntimeGuard().generateBundle.call({ error(message) { throw Error(message); } }, {},
    Object.fromEntries(chunks.map(c => [c.fileName, c])));
}
const van = () => chunk('van.js', ['vanjs-core', 'vanjs-ext']);
test('XML parser and number parser initialize together without editor dependencies', () => {
  assert.doesNotThrow(() => verify([van(), chunk('xml.js', ['fast-xml-parser', 'strnum'])]));
  assert.throws(() => verify([van(), chunk('xml.js', ['fast-xml-parser'], ['editor.js']),
    chunk('editor.js', ['strnum', 'shared-vuejs'])]), /same runtime chunk/);
  assert.throws(() => verify([van(), chunk('xml.js', ['fast-xml-parser', 'strnum'], ['helper.js']),
    chunk('helper.js', ['helper'], ['editor.js']), chunk('editor.js', ['shared-vuejs'])]), /must not depend/);
});
