import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {parse,compileScript} from '@vue/compiler-sfc';
import {mkdtempSync,writeFileSync,readFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {runBrowserFixture} from './browser-fixture.mjs';
const chrome=process.env.CHROME_BIN||['C:/Program Files/Google/Chrome/Application/chrome.exe','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/chromium'].find(existsSync);

test('AI modal opens before file creation and builds read-only prompts and routes HTML uploads by dashboard/editor context', {skip:!chrome,timeout:60000},async()=>{
 const directory=mkdtempSync(join(tmpdir(),'desq-agent-modal-'));
 const mock={
  'naive-ui':`import{h}from'vue';export const NModal={props:['show','title'],setup:(p,{slots})=>()=>p.show?h('section',{role:'dialog'},[h('h2',p.title),slots.default?.()]):null};export const NButton={setup:(_,c)=>()=>h('button',c.attrs,c.slots.default?.())};`,
  '@vicons/fluent':`export const DocumentCopy24Regular=()=>null;`,
  '@vicons/material':`export const InsertDriveFileOutlined=()=>null;export const AutoAwesomeOutlined=()=>null;`,
  '@/lib/common/store':`export const piniaInfo=()=>window.__agent.store;export const piniaSlides=()=>({slideId:'page',sldState:0});`,
  'vue-router':`export const useRoute=()=>({params:{id:'file'}});`,
  'shared-vuejs/editor':`export const getFileInfo=()=>window.__agent.mode==='insert'?{id:'file'}:null;export const getSlidesSlideId=()=>window.__agent.mode==='insert'?'page':null;export const getSlideInfo=()=>window.__agent.mode==='insert'?{id:'page'}:null;`,
  'shared-vuejs/api/load':`export const createNewFile=async()=>{window.__agent.blankFiles++;};`,
  '@/lib/main/utils':`export const showError=e=>{throw Error(e);};`,
  '@/lib/agent/editor-adapter':`export const editorAdapter={rememberTextCursor(){},clearTextCursor(){}};`,
  '@/lib/agent/editor-tools.mjs':`export const createEditorTools=(adapter,active)=>({dispose(){},executeTool:async(name,args,options)=>{if(!active())throw Error('Wrong document context');window.__agent.calls.push({name,args,options});return name==='desq_get_document'?{ok:true,result:{}}:{ok:true,result:{slideCount:2}};}});`,
  '@/lib/agent/webmcp.mjs':`export const parseAgentOrigins=()=>[];export const installEditorAgent=async()=>({dispose(){}});`,
  '@/lib/agent/template-report.mjs':`export const templateUsage=()=>null;`,
  '@/lib/agent/external-brief.mjs':`export const parseExternalBriefResult=text=>({deck:text.trim().startsWith('<')?window.__agent.deck:JSON.parse(text),repaired:false});`,
  '@/lib/agent/scripted-html-render.mjs':`export const renderScriptedFrontendSlides=async(source,deck)=>deck;`,
  '@/lib/agent/generated-fonts.mjs':`export const loadGeneratedGoogleFonts=async()=>[];export const renderedHtmlFontFamilies=()=>[];`,
  '@/lib/agent/deck-preflight.mjs':`export const preflightDeckPlan=()=>{};`,
  '@/lib/agent/external-response.mjs':`export const isHtmlResponse=text=>text.trim().startsWith('<');export const createExternalResponseFile=async(source,deck)=>{window.__agent.created.push({source,deck});return 'new-deck';};`,
  '@/lib/agent/html-embedded-images.mjs':`export const prepareEmbeddedHtmlImages=async source=>({source,images:new Map()});export const embeddedHtmlAssets=()=>new Map();`,
  '@/lib/agent/frontend-slides-import.mjs':`export const parseFrontendSlides=source=>{if(source.includes('data-invalid'))throw Error('No slides found.');return window.__agent.deck;};`,
  'shared-vuejs/api/opfs':`export const saveMediaRecordToOPFS=async()=>{};`,
  'shared-vuejs/api/googleFonts':`export const googleFonts=[];`,
 };
 try{
  await build({stdin:{resolveDir:resolve('.'),contents:`
import{createApp,reactive,nextTick}from'vue';
import Agent from './editor-vuejs/src/components/editor/Agent/EditorAgent.vue';
import NewFile from './editor-vuejs/src/components/editor/Dialogs/NewFile.vue';
(async()=>{try{
 const state=window.__agent={mode:'new',store:reactive({openEditorAgentModal:false,openNewFileModal:true,loadingBar:''}),blankFiles:0,calls:[],created:[],deck:{title:'Response deck',slides:[{title:'One',purpose:'First',layout:'cover'},{title:'Two',purpose:'Second',layout:'cover'}]}};
 const check=(ok,msg)=>{if(!ok)throw Error(msg);};
 const until=async fn=>{for(let i=0;i<100&&!fn();i++)await new Promise(r=>setTimeout(r,10));check(fn(),'Timed out waiting for response');};
 let host=document.createElement('div');document.body.append(host);let app=createApp(NewFile);app.mount(host);
 [...host.querySelectorAll('.template-card')].find(b=>b.textContent.includes('Create with AI')).click();await nextTick();
 host.querySelector('.action button').click();await nextTick();
 check(state.store.openEditorAgentModal,'new file AI option opens modal');check(!state.store.openNewFileModal,'new file chooser closes');check(state.blankFiles===0,'opening agent does not create a blank file');app.unmount();host.remove();
 Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{state.copied=text;}},configurable:true});
 for(const mode of ['new','insert']){
  state.mode=mode;state.calls=[];state.created=[];state.store.openEditorAgentModal=true;
  host=document.createElement('div');document.body.append(host);let createdId;
  app=createApp(Agent,{mode,onCreated:id=>{createdId=id;}});app.mount(host);await nextTick();
  check(!!host.querySelector('[role="dialog"]'),'agent is modal');
  check(!host.querySelector('input[type="radio"]'),'layout chooser removed');
  check(!host.querySelector('#external-brief-json'),'response paste field removed');
  const prompt=host.querySelector('#external-prompt');
  check(prompt.readOnly && !prompt.value,'generated prompt starts empty and read-only');
  check(host.querySelector('.copy-button').disabled,'empty request cannot be copied');
  const description=host.querySelector('#external-description');
  description.value='Build a geography quiz game with hints and branching outcomes.';
  description.dispatchEvent(new Event('input',{bubbles:true}));await nextTick();
  check(prompt.value.includes(description.value),'prompt includes the user request');
  check(prompt.value.includes('https://desq.page/AGENTS.html') && !prompt.value.includes('## Required delivery'),'prompt links to the public guide without copying its text');
  check(prompt.value.includes('downloadable') && prompt.value.includes('morph') && prompt.value.includes('interactions'),'HTML and game guidance included');
  host.querySelector('.copy-button').click();await until(()=>state.copied===prompt.value);
  const input=host.querySelector('input[type="file"]');
  check(!input.accept.includes('json') && input.accept.includes('.html'),'HTML response picker');
  const select=async file=>{Object.defineProperty(input,'files',{value:[file],configurable:true});input.dispatchEvent(new Event('change',{bubbles:true}));await nextTick();};
  await select(new File(['{}'],'response.json',{type:'application/json'}));
  check(host.querySelector('.create-button').disabled && host.textContent.includes('Choose an HTML response file'),'JSON upload rejected');
  await select(new File(['<!doctype html><html data-invalid></html>'],'invalid.html',{type:'text/html'}));
  await until(()=>host.textContent.includes('Loaded: invalid.html'));
  check(host.querySelector('.create-button').disabled && host.querySelector('[role="alert"]'),'invalid HTML cannot generate');
  const file=new File(['<!doctype html><html><section class="slide">Response</section></html>'],'response.html',{type:'text/html'});
  await select(file);await until(()=>host.textContent.includes('Loaded: response.html'));
  check(!host.querySelector('.create-button').disabled,'valid HTML enables generation');
  await select({name:'huge.html',size:50000001,text:async()=>''});
  check(host.querySelector('.create-button').disabled && !host.textContent.includes('Loaded: response.html'),'oversize upload clears stale response');
  await select({name:'unreadable.html',size:10,text:async()=>{throw Error('read failed')}});
  await until(()=>host.textContent.includes('Could not read unreadable.html'));
  check(host.querySelector('.create-button').disabled,'read failure cannot reuse stale HTML');
  await select(file);await until(()=>host.textContent.includes('Loaded: response.html'));
  check(input.value==='','file picker resets for same-file retries');
  await nextTick();const button=host.querySelector('.create-button');check(!button.disabled,'valid response enables submission');button.click();
  if(mode==='new'){await until(()=>createdId==='new-deck');check(state.created.length===1,'dashboard creates one deck');check(state.calls.length===0,'dashboard never inserts into an editor');check(!state.store.openEditorAgentModal,'new deck closes modal');}
  else{await until(()=>state.calls.some(call=>call.name==='desq_create_deck'));const call=state.calls.find(call=>call.name==='desq_create_deck');check(call.args.fileId==='file'&&call.args.pageId==='page','insert targets active deck and selected page');check(call.options.insertOnly===true,'insertion preserves existing starter slides');check(state.created.length===0,'editor never creates another deck');await until(()=>!host.querySelector('.create-button').disabled);}
  app.unmount();host.remove();
 }
 const el=document.createElement('pre');el.id='result';el.textContent=JSON.stringify({ok:true});document.body.append(el);
}catch(e){const el=document.createElement('pre');el.id='result';el.textContent=JSON.stringify({error:e.stack});document.body.append(el);}})();
`},bundle:true,format:'iife',define:{'import.meta.env':'{}','process.env.NODE_ENV':'"test"'},outfile:join(directory,'fixture.js'),plugins:[{name:'agent-ui-fixture',setup(b){
   b.onResolve({filter:/.*/},args=>{if(mock[args.path])return{path:args.path,namespace:'agent-mock'};if(args.path==='@/lib/agent/html-authoring-prompt.mjs')return{path:resolve('editor-vuejs/src/lib/agent/html-authoring-prompt.mjs')};if(args.path.endsWith('.md?raw'))return{path:resolve(args.importer,'..',args.path.slice(0,-4)),namespace:'agent-raw'};});
   b.onLoad({filter:/.*/,namespace:'agent-mock'},args=>({contents:mock[args.path],resolveDir:resolve('.')}));
   b.onLoad({filter:/.*/,namespace:'agent-raw'},args=>({contents:'export default '+JSON.stringify(readFileSync(args.path,'utf8'))}));
   b.onLoad({filter:/\.vue$/},args=>{const {descriptor}=parse(readFileSync(args.path,'utf8'),{filename:args.path});return{contents:compileScript(descriptor,{id:args.path,inlineTemplate:true}).content,loader:'ts',resolveDir:resolve(args.path,'..')};});
  }}]});
  writeFileSync(join(directory,'fixture.html'),'<!doctype html><body><script src="fixture.js"></script></body>');
  const output=await runBrowserFixture(chrome,pathToFileURL(join(directory,'fixture.html')).href,join(directory,'profile'));
  const match=/<pre id="result">([\s\S]*?)<\/pre>/.exec(output);assert.ok(match,output.slice(-1500));
  const result=JSON.parse(match[1].replaceAll('&quot;','"').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&'));assert.equal(result.error,undefined,result.error);assert.equal(result.ok,true);
 }finally{rmSync(directory,{recursive:true,force:true});}
});
