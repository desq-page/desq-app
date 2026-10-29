import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';

test('editor media requests serve optimized MP4 with byte ranges, falling back to originals', async () => {
  const result=await build({entryPoints:['editor-vuejs/service-worker.js'],bundle:true,format:'esm',platform:'browser',write:false,plugins:[{name:'worker-boundaries',setup(b){
    b.onResolve({filter:/^shared-vuejs\//},args => ({path:args.path,namespace:'mock'}));
    b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:`
      export const db = {}; export const setupDB = () => {};
      export const isPublishedPath = () => false;
      export const optimizedVideo = async (fileId,name) => {globalThis.playbackTest.lookup=[fileId,name];return globalThis.playbackTest.optimized;};
      export const getFileFromOPFS = async () => {globalThis.playbackTest.originalReads++;return new File(['original video'],'video.mov');};
    `}));
  }}]});
  const oldSelf=globalThis.self;
  globalThis.playbackTest={optimized:new File(['smaller MP4'],'video.mov'),originalReads:0};
  let handler;
  globalThis.self={location:{origin:'https://localhost'},addEventListener(type,cb){if(type==='fetch')handler=cb;}};
  try {
    await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
    let response;
    handler({request:new Request('https://localhost/res/deck/media/video.mov',{headers:{Range:'bytes=0-6'}}),respondWith(value){response=value;}});
    const optimized=await response;
    assert.equal(optimized.status,206);
    assert.equal(optimized.headers.get('content-type'),'video/mp4');
    assert.equal(optimized.headers.get('content-range'),'bytes 0-6/11');
    assert.equal(await optimized.text(),'smaller');
    assert.equal(globalThis.playbackTest.originalReads,0);
    assert.deepEqual(globalThis.playbackTest.lookup,['deck','video.mov']);
    globalThis.playbackTest.optimized=undefined;
    handler({request:new Request('https://localhost/res/deck/media/video.mov'),respondWith(value){response=value;}});
    assert.equal(await(await response).text(),'original video');
    assert.equal(globalThis.playbackTest.originalReads,1);
  } finally {globalThis.self=oldSelf;delete globalThis.playbackTest;}
});

test('completion refreshes only matching local videos and preserves playback position/state', async () => {
  const result=await build({entryPoints:['shared-vuejs/src/edlib/common/media/refresh-optimized-video.ts'],bundle:true,format:'esm',write:false});
  const {refreshOptimizedVideo}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
  const oldDocument=globalThis.document,oldLocation=globalThis.location;
  const videos=['https://localhost/res/deck/media/video.mov','https://localhost/res/other/media/video.mov','https://remote/video.mov'].map(src=>({src,currentTime:5,duration:20,paused:false,ended:false,plays:0,loads:0,addEventListener(type,cb){this.ready=cb;},load(){this.loads++;},async play(){this.plays++;}}));
  globalThis.document={baseURI:'https://localhost/',querySelectorAll:()=>videos};
  globalThis.location={origin:'https://localhost'};
  try {
    refreshOptimizedVideo('deck','ppt/media/video.mov');
    assert.equal(videos[0].loads,1);
    assert.match(videos[0].src,/optimized=/);
    videos[0].currentTime=0;videos[0].ready();
    assert.equal(videos[0].currentTime,5);assert.equal(videos[0].plays,1);
    assert.equal(videos[1].loads,0);assert.equal(videos[2].loads,0);
  } finally {globalThis.document=oldDocument;globalThis.location=oldLocation;}
});

test('production service worker resolves optimized-video from the installed shared package', async () => {
  // Match Vite's standalone esbuild step; mocks would hide stale package exports.
  await build({entryPoints:['editor-vuejs/service-worker.js'],bundle:true,platform:'browser',write:false,minify:true});
});
