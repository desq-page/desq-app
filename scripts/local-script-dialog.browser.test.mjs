import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {parse,compileScript} from '@vue/compiler-sfc';
import {mkdtempSync,writeFileSync,readFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {runBrowserFixture} from './browser-fixture.mjs';
import {resolveCorePackage} from './local-core.mjs';
const chrome=process.env.CHROME_BIN||['C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/chromium'].find(existsSync);
test('Add-Ins code dialog edits, validates and binds user functions without executing them',{skip:!chrome,timeout:60000},async()=>{
 const directory=mkdtempSync(join(tmpdir(),'desq-script-dialog-'));
 const mock={
  'naive-ui':`import{h}from'vue';export const NModal={props:['show','title'],setup:(p,{slots})=>()=>p.show?h('section',{role:'dialog'},[h('h2',p.title),slots.default?.(),slots.footer?.()]):null};export const NButton={setup:(_,c)=>()=>h('button',c.attrs,c.slots.default?.())};export const NSpace={setup:(_,c)=>()=>h('div',c.attrs,c.slots.default?.())};export const NInput={props:['value','type'],emits:['update:value'],setup:(p,c)=>()=>h(p.type==='textarea'?'textarea':'input',{...c.attrs,value:p.value,onInput:e=>c.emit('update:value',e.target.value)})};export const NSelect={props:['value','options'],emits:['update:value'],setup:(p,c)=>()=>h('select',{...c.attrs,value:p.value,onChange:e=>c.emit('update:value',e.target.value)},p.options.map(o=>h('option',{value:o.value},o.label)))};`,
  '@vicons/fluent':`export const Code24Regular=()=>null,ImageEdit20Regular=()=>null,VideoBackgroundEffect20Filled=()=>null;`,
  '@vicons/carbon':`export const Person=()=>null;`,
  '@/lib/common/store':`export const piniaSelect=()=>({selShpFormat:window.__script.shape}),piniaInfo=()=>({});`,
  'shared-vuejs/editor':`const s=()=>window.__script;export const getFileInfo=()=>s().file,getSlideInfo=()=>s().slide,getShapeDeep=id=>id===s().shape.id?structuredClone(s().shape):undefined,updateFile=value=>Object.assign(s().file,value),updateShape=value=>Object.assign(s().shape,value);`,
  'shared-vuejs/api/dbutils':`export const saveDexie=async()=>{window.__script.saves++};`,
  'shared-vuejs/api/utility':`let id=0;export const genId=()=>String(++id);`,
  'shared-vuejs/api/global':`export default {};`,
  'shared-vuejs/api/downloadShape':`export const getShapeImage=()=>{};`,
  'shared-vuejs/api/svgUtils':`export const traceImage=()=>{};`,
 };
 try{
  await build({stdin:{resolveDir:resolve('.'),contents:`
import{createApp,nextTick}from'vue';import Toolbar from './editor-vuejs/src/components/addon/ToolbarAddins.vue';
window.__script={file:{id:'deck',slides:[{id:'intro',name:'Intro'}]},slide:{id:'intro',shapes:[{id:'button',name:'Answer'}]},shape:{id:'button'},saves:0};
const check=(ok,message)=>{if(!ok)throw Error(message)},tick=()=>new Promise(resolve=>setTimeout(resolve,30));
const click=text=>{const button=[...document.querySelectorAll('button')].find(b=>b.textContent===text);check(button,'button '+text);button.click();};
const input=(el,value)=>{el.value=value;el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));};
(async()=>{try{
 const root=document.createElement('div');document.body.append(root);const app=createApp(Toolbar);app.mount(root);
 click('Local JavaScript…');await nextTick();check(document.querySelector('[role=dialog]'),'Add-Ins opens dialog');
 const editor=document.querySelector('.script-editor textarea');
 let leakedKeys=0;
 const slideShortcut=event=>{leakedKeys++;event.preventDefault()};
 for(const type of ['keydown','keypress','keyup'])document.addEventListener(type,slideShortcut);
 for(const key of ['ArrowLeft','ArrowRight','Backspace'])for(const type of ['keydown','keypress','keyup']){
   check(editor.dispatchEvent(new KeyboardEvent(type,{key,bubbles:true,cancelable:true})), 'editor keeps default '+key);
 }
 for(const type of ['keydown','keypress','keyup'])document.removeEventListener(type,slideShortcut);
 check(leakedKeys===0,'code editor keys stay out of slide shortcuts');
 const code='export function checkAnswer(ctx, correct) { globalThis.shouldNeverRunWhileEditing = true; ctx.state.set("correct", correct); }';
 input(document.querySelector('textarea'),code);await nextTick();const functionSelect=document.querySelectorAll('select')[1];input(functionSelect,'checkAnswer');input(document.querySelector('input'),'[true]');await nextTick();
 click('Save and bind selected shape');await tick();
 const state=window.__script;check(state.saves===1,'saved');check(state.file.scripting.modules[0].source===code,'editable code retained');check(state.shape.link.startsWith('@run:'),'shape calls local binding');check(state.file.scripting.bindings[0].function==='checkAnswer'&&state.file.scripting.bindings[0].args[0]===true,'named function and JSON args');check(!globalThis.shouldNeverRunWhileEditing,'editing never executes source');
 click('Close');await nextTick();click('Local JavaScript…');await nextTick();check(document.querySelectorAll('select')[1].value==='checkAnswer','existing binding reopens');
 input(document.querySelector('textarea'),'export function {');await nextTick();click('Save code');await tick();check(document.querySelector('[role=alert]'),'syntax error displayed');check(state.saves===1,'invalid code does not persist');
 click('Remove selected binding');await tick();check(state.shape.link==='','binding removed');app.unmount();
 document.body.insertAdjacentHTML('beforeend','<pre id="result">PASS</pre>');
}catch(e){const el=document.createElement('pre');el.id='result';el.textContent=e.stack;document.body.append(el)}})();
`},bundle:true,format:'iife',define:{'process.env.NODE_ENV':'"test"'},outfile:join(directory,'fixture.js'),plugins:[{name:'script-ui',setup(b){
   b.onResolve({filter:/.*/},args=>{if(mock[args.path])return{path:args.path,namespace:'mock'};if(args.path.endsWith('/ToolbarItem.vue'))return{path:'toolbar',namespace:'stub'};if(args.path.endsWith('/ToolbarUtils'))return{path:'utils',namespace:'stub'};if(args.path.startsWith('shared-vuejs/'))return{path:resolveCorePackage(args.path,resolve('../desq-core'))};});
   b.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mock[args.path],resolveDir:resolve('.')}));
   b.onLoad({filter:/.*/,namespace:'stub'},args=>({contents:args.path==='toolbar'?`import{h}from'vue';export default{props:['caption','onClick','disabled'],setup:p=>()=>h('button',{onClick:p.onClick,disabled:p.disabled},p.caption)};`:`export const rmbgUsingXenova=()=>{};`,resolveDir:resolve('.')}));
   b.onLoad({filter:/\.vue$/},args=>{const {descriptor}=parse(readFileSync(args.path,'utf8'),{filename:args.path});return{contents:compileScript(descriptor,{id:args.path,inlineTemplate:true}).content,loader:'ts',resolveDir:resolve(args.path,'..')};});
  }}]});
  writeFileSync(join(directory,'fixture.html'),'<!doctype html><body><script src="fixture.js"></script>');
  const output=await runBrowserFixture(chrome,pathToFileURL(join(directory,'fixture.html')).href,join(directory,'profile'));
  assert.equal(output.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1],'PASS');
 }finally{rmSync(directory,{recursive:true,force:true,maxRetries:6,retryDelay:100});}
});
