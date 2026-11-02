import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import vm from 'node:vm';
test('HTML import seeds blank-PPTX path with inherited artwork and media', async()=>{
 const output=await build({entryPoints:['../desq-core/shared-vuejs/src/edlib/pubbridge/submitHtml.ts'],bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'capture',setup(b){b.onResolve({filter:/submitPublisher$/},()=>({path:'capture',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const submitPublisher=globalThis.capture;'}));}}]});
 let args;
 const context={module:{exports:{}},exports:{},capture:(...value)=>{args=value;return 'new-id';}};
 vm.runInNewContext(output.outputFiles[0].text,context);
 const doc={file:{name:'HTML deck',width:960,height:540},masters:[{id:'m',shapes:[{id:'master'}]}],layouts:[{id:'l',parentid:'m',shapes:[{id:'layout'}]}],slides:[{id:'s',layoutid:'l',originalXml:'obsolete',shapes:[{id:'content'}],timing:{m:[]}}]};
 assert.equal(await context.module.exports.submitHtmlDocument(doc,[{name:'photo.png',data:[1]},{name:'fonts/font.woff',data:[2]}],{fileId:'new-id'}),'new-id');
 assert.equal(args[0].sourceFormat,'html');assert.equal(args[0].width,960);
 assert.deepEqual(Array.from(args[0].slides[0].shapes,s=>s.id),['master','layout','content']);
 assert.equal(args[0].slides[0].originalXml,undefined);
 assert.equal(args[0].media.length,1);assert.equal(args[1].fileId,'new-id');
 assert.equal(args[1].cbAfterProcess,true);
});
