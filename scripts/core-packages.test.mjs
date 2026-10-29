import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,existsSync,lstatSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
const require=createRequire(import.meta.url);
for (const name of ['shared-vuejs','@savanna/player']) {
 test(`${name} installs as an independent compiled package`, () => {
   const file=require.resolve(name+'/package.json');
   const root=dirname(file), manifest=JSON.parse(readFileSync(file,'utf8'));
   assert.equal(lstatSync(root).isSymbolicLink(),false);
   assert.equal(existsSync(resolve(root,'src')),false);
   for (const entry of Object.values(manifest.exports)) {
     const targets=typeof entry==='string'?[entry]:Object.values(entry);
     for (const target of targets) assert.ok(existsSync(resolve(root,target)),name+': '+target);
   }
 });
}
test('player standalone bundles expose the required browser globals', () => {
 assert.match(readFileSync(require.resolve('@savanna/player/player.js'),'utf8'),/var player=/);
 assert.match(readFileSync(require.resolve('@savanna/player/vanjs.js'),'utf8'),/var SavannaPlayer=/);
});
