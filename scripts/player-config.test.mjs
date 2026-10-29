import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { buildPlayerConfigScript } from '../shared-vuejs/src/edlib/common/export/player-config.mjs';

test('shared player config initializes the full deck without shape payloads', () => {
  const slides = Array.from({length:100}, (_, i) => ({
    id:`slide${i}`,title:`Slide ${i} </script>`, transition:{type:'cover'},
    timing:{duration:500},show:true,shapes:{large:'excluded'},
  }));
  const file = {slides,layouts:[{id:'layout',parentid:'master',timing:{},shapes:{}}],width:1280,height:720,publish:{loop:true}};
  let config;
  vm.runInNewContext(buildPlayerConfigScript(file), {player:{initSlides(value){config=JSON.parse(JSON.stringify(value));}}});
  assert.equal(config.slides.length,100);
  assert.equal(config.slides[99].title, slides[99].title);
  assert.equal(config.slides[0].shapes,undefined);
  assert.deepEqual(config.layouts,[{id:'layout',parent:'master',timing:{}}]);
  assert.deepEqual(config.publish,file.publish);
  assert.equal(config.width,1280);
  assert.equal(config.height,720);
});

test('package cache includes shared config alongside every slide page', async () => {
  const { build } = await import('esbuild');
  const result = await build({entryPoints:['shared-vuejs/src/edlib/common/db/opfs.ts'],bundle:true,platform:'node',format:'esm',write:false});
  const {getInternalHtmlRecordsFromOPFS} = await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
  const dir = {
    getDirectoryHandle:async () => dir,
    async *entries() {
      for (const name of ['index.html','index100.html','player-config.js','webfont.css']) {
        yield [name,{kind:'file',getFile:async () => new Blob([name])}];
      }
    },
  };
  const original = Object.getOwnPropertyDescriptor(globalThis,'navigator');
  Object.defineProperty(globalThis,'navigator',{value:{storage:{getDirectory:async () => dir}},configurable:true});
  try {
    const entries = await getInternalHtmlRecordsFromOPFS('deck');
    assert.deepEqual(entries.map(entry => entry.name),['index.html','index100.html','player-config.js']);
  } finally {
    if(original) Object.defineProperty(globalThis,'navigator',original);
    else delete globalThis.navigator;
  }
});
