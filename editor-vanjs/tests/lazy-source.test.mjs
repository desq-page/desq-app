import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import vm from 'node:vm';
import {vanEditorFrame} from '../../editor-vuejs/src/lib/main/vanEditorFrame.mjs';

test('VanJS route source sends metadata and reads one Vue database record on demand',async()=>{
 const calls=[];
 const result=await build({entryPoints:[new URL('../../editor-vuejs/src/lib/main/vanEditorSource.mjs',import.meta.url).pathname],bundle:true,write:false,format:'cjs',platform:'node',plugins:[{name:'source-fixture',setup(build){
  build.onResolve({filter:/^shared-vuejs\//},args=>({path:args.path,namespace:'fixture'}));
  build.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`
   export const loadSlideFromDexie=async(file,id,type)=>{globalThis.calls.push([file,id,type]);return {id,shapes:[]}};
   export const fetchTheme=async(file,id)=>({clrScheme:{}});
   export const getMediaRecordFromOPFS=async()=>({data:new Uint8Array([1])});
   export const getMediaRecordsFromOPFS=async()=>[];
   export const getFontRecordFromOPFS=async()=>({data:new Uint8Array([2])});
   export const optimizedVideo=async(file,name)=>globalThis.optimized?.[name];
  `}));
 }}]});
 const context=vm.createContext({module:{exports:{}},exports:{},calls,structuredClone,Blob,Uint8Array,FileReader:class{readAsDataURL(blob){this.result='data:'+blob.type+';base64,AQ==';this.onload()}}});
 vm.runInContext(result.outputFiles[0].text,context);
 const file={id:'file',name:'Deck',timestamp:10,width:1280,height:720,slides:[{id:'s1',layoutid:'layout',title:'First'},{id:'s2',layoutid:'layout'}],layouts:[{id:'layout',parentid:'master'},{id:'master',theme:'theme'}]};
 const source=context.module.exports.createVanEditorSource(file);
 const header=await source.getHeader();
 assert.equal(calls.length,0);
 assert.equal(header.slides.length,2);
 assert.equal(header.slides[0].shapes,undefined);
 assert.equal(header.layouts[0].parentid,'master');
 const slide=await source.loadRecord('slide','s1');
 assert.deepEqual(JSON.parse(JSON.stringify(calls)),[['file','s1','slides']]);
 assert.equal(slide.layoutid,'layout');
 context.optimized={'video.mov':new Blob(['optimized'],{type:'video/mp4'})};
 assert.equal(await source.loadAsset('ppt/media/video.mov'),'data:video/mp4;base64,AQ==');
 assert.equal(await source.loadAsset('media/video.mov'),'data:video/mp4;base64,AQ==');
 delete context.optimized;
 assert.equal(await source.loadAsset('video.mov'),'data:video/quicktime;base64,AQ==');
 const html=vanEditorFrame(header,'https://example.test/editor-vanjs.js','source-key');
 assert.ok(html.includes('parent.DesqVanSources["source-key"]'));
 assert.ok(!html.includes('type="application/json"'));
 assert.ok(!html.includes('"s2"'));
});
