import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {localCoreDirectory, resolveCorePackage, localBuildMarker} from './local-core.mjs';
import {localCorePlugin} from './local-core-vite.mjs';

function fixture(t) {
  const root=mkdtempSync(join(tmpdir(),'savanna-local-test-'));
  for (const folder of ['shared-vuejs','player']) {
    mkdirSync(join(root,folder,'dist'),{recursive:true});
    writeFileSync(join(root,folder,'dist/index.js'),'export const value=1;');
    writeFileSync(join(root,folder,'package.json'),JSON.stringify({exports:{'.':{types:'./dist/index.d.ts',import:'./dist/index.js'},'./api/example':'./dist/index.js','./package.json':'./package.json'}}));
  }
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  return root;
}
test('normal and production commands do not enable local resolution',()=>{
  assert.equal(localCoreDirectory({}),null);
  assert.equal(resolveCorePackage('shared-vuejs',null),null);
  assert.equal(localCorePlugin(null),null);
});
test('local directory supports a custom checkout location',()=>{
  assert.equal(localCoreDirectory({SAVANNA_LOCAL_CORE:'1',SAVANNA_CORE_DIR:'/tmp/custom-core'}),'/tmp/custom-core');
});
test('both package namespaces resolve only declared local exports',t=>{
  const root=fixture(t);
  assert.equal(resolveCorePackage('shared-vuejs/api/example',root),join(root,'shared-vuejs/dist/index.js'));
  assert.equal(resolveCorePackage('@savanna/player',root),join(root,'player/dist/index.js'));
  assert.equal(resolveCorePackage('vue',root),null);
  assert.throws(()=>resolveCorePackage('shared-vuejs/src/private',root),/Missing public/);
});
test('missing builds produce an actionable error',t=>{
  const root=fixture(t);
  rmSync(join(root,'player/dist/index.js'));
  assert.throws(()=>resolveCorePackage('@savanna/player',root),/not built.*dev:local/);
});
test('Vite deduplicates peer runtimes and serves both checkouts',t=>{
  const root=fixture(t),plugin=localCorePlugin(root),config=plugin.config();
  assert.equal(plugin.apply,'serve');
  assert.ok(config.resolve.dedupe.includes('vanjs-core'));
  assert.ok(config.optimizeDeps.exclude.includes('@savanna/player'));
  assert.ok(config.server.fs.allow.includes(root));
});
test('core module changes reload only after the completed-build notification',t=>{
  const root=fixture(t),plugin=localCorePlugin(root),events=[];
  const server={moduleGraph:{invalidateAll:()=>events.push('invalidate')},ws:{send:event=>events.push(event)},config:{logger:{info:()=>{}}}};
  assert.deepEqual(plugin.handleHotUpdate({file:join(root,'shared-vuejs/dist/index.js'),server}),[]);
  assert.deepEqual(events,[]);
  assert.deepEqual(plugin.handleHotUpdate({file:localBuildMarker,server}),[]);
  assert.deepEqual(events,['invalidate',{type:'full-reload'}]);
});


test('Office stubs preserve compiled export-list names', async () => {
  const {disabledOfficeModule} = await import('../editor-vanjs/scripts/office-stubs.mjs');
  const code=disabledOfficeModule('function markPptxArchiveDirty() {}\nfunction save() {}\nexport { markPptxArchiveDirty, save as persistSlideXmlFromModel };');
  assert.match(code,/export function markPptxArchiveDirty\(\) \{\}/);
  assert.match(code,/export function persistSlideXmlFromModel\(\)/);
  assert.throws(()=>disabledOfficeModule('const empty = true;'),/No Office archive exports/);
});
