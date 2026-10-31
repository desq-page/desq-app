import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,existsSync,lstatSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
const require=createRequire(import.meta.url);
for (const name of ['shared-vuejs','@desq/player']) {
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
 assert.match(readFileSync(require.resolve('@desq/player/player.js'),'utf8'),/var player=/);
 assert.match(readFileSync(require.resolve('@desq/player/vanjs.js'),'utf8'),/var DesqPlayer=/);
});
test('the installed player includes media playback and hover controls', () => {
 assert.match(readFileSync(require.resolve('@desq/player/player.js'),'utf8'),/mediaStop/);
 assert.match(readFileSync(require.resolve('@desq/player/player.css'),'utf8'),/\.audio-controls/);
});
test('the installed importer retains presentation text defaults for rendering', () => {
 const root=dirname(require.resolve('shared-vuejs/package.json'));
 const importer=readFileSync(resolve(root,'dist/edlib/pptx/import/import-txml.js'),'utf8');
 const loader=readFileSync(resolve(root,'dist/edlib/common/inout/load.js'),'utf8');
 assert.match(importer,/fileInfo\.defaultTextStyle\s*=\s*g\.defaultTextStyle/);
 assert.doesNotMatch(loader,/delete\s+fileInfoWithoutStyles\.defaultTextStyle/);
});
