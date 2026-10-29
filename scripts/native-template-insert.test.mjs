import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {reactive, isProxy} from 'vue';

test('native template insertion persists all slides with nested reactive metadata', async () => {
  const result = await build({entryPoints:['editor-vuejs/src/lib/agent/native-template-insert.mjs'],bundle:true,platform:'node',format:'esm',write:false,
    plugins:[{name:'template-boundaries',setup(builder){
      builder.onResolve({filter:/native-template-deck\.mjs|shared-vuejs\/api\/pptxArchive/},args=>({path:args.path,namespace:'mock'}));
      builder.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:args.path.includes('native-template-deck')
        ? 'export async function prepareNativeTemplateDeck(spec){return {sources:spec.slides.map((slide,i)=>({path:`slide${i}`,name:slide.title,selection:slide.templateSelection,layoutid:"layout"})),warnings:[],imageCredits:[]};} export function mergeNativeTemplatePackage(){return {};}'
        : 'export async function getPptxArchive(){return {};} export async function installPptxTemplateParts(fileId,parts,paths){return {layouts:[],layoutPages:[],pages:paths.map((path)=>({id:path,shapes:[{id:"text",text:"Editable title"}]}))};}',loader:'js'}));
    }}]});
  const {createNativeTemplateDeck} = await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
  const spec=reactive({title:'Deck',slides:Array.from({length:3},(_,i)=>({title:`Slide ${i+1}`,templateSelection:{family:'builtin-ocean',layout:'cover',details:{selected:true}}}))});
  assert.ok(isProxy(spec.slides[0].templateSelection));
  assert.throws(()=>structuredClone(spec.slides[0].templateSelection),{name:'DataCloneError'});
  let selected='starter',saved=0,removed=false,rebuilt;
  const pages=[];
  const outcome=await createNativeTemplateDeck(spec,{fileId:'file',pageId:selected,file:{width:1280,height:720},
    checkTarget(){},async prepare(){},updateFile(){},getFileInfo:()=>({id:'file',layouts:[]}),getSlideInfo:()=>({id:selected}),
    async pasteSlide(page){pages.push(structuredClone(page));page.agentMetadata.templateSelection.details.selected=false;return `new${pages.length}`;},
    async selectSlide(id){selected=id;},async saveDexie(){saved++;},async removeStarter(){removed=true;},async rebuildThumbnails(fileId,ids){rebuilt=[...ids];}});
  assert.equal(outcome.slideCount,3);
  assert.equal(saved,3);
  assert.ok(removed);
  assert.deepEqual(rebuilt,['new1','new2','new3']);
  assert.equal(pages[0].shapes[0].text,'Editable title');
  assert.deepEqual(pages[0].agentMetadata.templateSelection,{family:'builtin-ocean',layout:'cover',details:{selected:true}});
  assert.equal(spec.slides[0].templateSelection.details.selected,true);
});
