import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

test('Desq HTML restores layout/master records directly; agent HTML alone uses blank PPTX import',async()=>{
 const result=await build({entryPoints:[fileURLToPath(import.meta.resolve('shared-vuejs/api/document-import-importEditableHtml'))],bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'imports',setup(b){
  b.onResolve({filter:/(?:utility|opfs|dbutils|submitHtml|presentation-document|importAgentHtml)\.(?:js|mjs)$/},args=>({path:args.path,namespace:'stub'}));
  b.onLoad({filter:/.*/,namespace:'stub'},({path})=>({contents:
   path.endsWith('/utility.js')?'export const genId=()=>"new-file";':
   path.endsWith('/opfs.js')?'export const saveMediaRecordToOPFS=async()=>{};export const saveToOPFS=async()=>{};':
   path.endsWith('/dbutils.js')?'export const putAssetsToDexie=async r=>globalThis.records.push(r);export const putFileInfoToDexie=async f=>globalThis.files.push(f);':
   path.endsWith('/pptxArchive')?'export const keepPptxArchive=async(...args)=>globalThis.packages.push(args);':
   path.endsWith('/submitHtml.js')?'export const submitHtmlDocument=async(...args)=>{globalThis.seeded.push(args);return "seeded";};':
   path.endsWith('importAgentHtml.mjs')?'export const agentHtmlDocument=async()=>globalThis.doc;':
   'export const readDocumentAsync=async()=>globalThis.doc;export const unpackPptxArchive=()=>globalThis.archive;'}));
 }}]});
 const doc={file:{id:'original',name:'Deck'},slides:[{id:'s',layoutid:'l',shapes:[{id:'content'}],originalXmlPath:'ppt/slides/slides.xml'}],layouts:[{id:'l',parentid:'m',shapes:[{id:'layout'}]}],masters:[{id:'m',shapes:[{id:'master'}]}],themes:{theme:{accent1:'FF0000'}},assets:{},__pptxArchive:{version:1}};
 let exported=true;
 const context={module:{exports:{}},doc,archive:{'ppt/presentation.xml':new Uint8Array()},records:[],files:[],packages:[],seeded:[],DOMParser:class{parseFromString(){return {getElementById:()=>exported?{}:null};}}};
 vm.runInNewContext(result.outputFiles[0].text,context);
 const importHtml=context.module.exports.importEditableHtml;
 assert.equal(await importHtml({text:async()=>'<html/>',name:'deck.html'}),'new-file');
 assert.equal(context.seeded.length,0);
 assert.deepEqual(Array.from(context.records,r=>r.type),['slides','slideLayouts','slideMasters','theme']);
 const slide=context.records[0];
 assert.equal(slide.data.sld.cSld.shapes.length,1);
 assert.equal(slide.data.sld.cSld.layoutid,'l');
 assert.equal(slide.data.sld.originalXmlPath,'ppt/slides/slides.xml');
 assert.equal(context.files[0].layouts.length,2);
 assert.equal(context.files[0].sourceDocumentId,'original');
 assert.equal(context.files[0].__editableHtmlRoot.__pptxArchive,undefined);
 assert.equal(context.packages.length,0);
 assert.equal(context.files[0].rebuildPptxFromModel,true);
 exported=false;
 assert.equal(await importHtml({text:async()=>'<html/>',name:'agent.html'}),'seeded');
 assert.equal(context.seeded.length,1);
 assert.equal(context.files.length,1);
});
