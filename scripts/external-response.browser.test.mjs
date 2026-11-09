import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtempSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {runBrowserFixture} from './browser-fixture.mjs';
const chrome=process.env.CHROME_BIN||['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/chromium'].find(existsSync);
test('Dashboard response creation compiles JSON before persisting and reuses HTML import', {skip:!chrome,timeout:60000},async()=>{
 const directory=mkdtempSync(join(tmpdir(),'desq-response-'));
 try {
  await build({stdin:{resolveDir:resolve('.'),contents:`
import {createExternalResponseFile} from './editor-vuejs/src/lib/agent/external-response.mjs';
(async()=>{try{
 window.__saved=[];
 const check=(ok,msg)=>{if(!ok)throw Error(msg)};
 const deck={title:'New response deck',audience:'General audience',objective:'Explain the topic',slides:[{layout:'cover',title:'First',purpose:'Open the presentation',subtitle:'New content'},{layout:'content',title:'Second',purpose:'Explain the topic',bullets:['One point','Another point']}]};
 const id=await createExternalResponseFile(JSON.stringify(deck),deck);
 check(id==='created-json','JSON creates a new file');const saved=window.__saved[0];
 check(saved.doc.file.name==='New response deck','deck title is kept');
 check(saved.doc.slides.length===2,'all native slides compiled');
 check(saved.doc.slides.every(s=>s.shapes.length>0),'native editable shapes created');
 check(saved.doc.file.slides.length===2,'file slide descriptors match content');
 await createExternalResponseFile('<!doctype html><html>response</html>',deck);
 check(window.__saved[1].html==='<!doctype html><html>response</html>','HTML goes through editable HTML import');
 const abort=new AbortController();abort.abort();let rejected=false;
 try{await createExternalResponseFile(JSON.stringify(deck),deck,{signal:abort.signal});}catch{rejected=true;}
 check(rejected&&window.__saved.length===2,'aborted generation never creates a file');
 const el=document.createElement('pre');el.id='result';el.textContent=JSON.stringify({ok:true});document.body.append(el);
}catch(e){const el=document.createElement('pre');el.id='result';el.textContent=JSON.stringify({error:e.stack});document.body.append(el);}})();
`},bundle:true,format:'iife',outfile:join(directory,'fixture.js'),plugins:[{name:'response-fixture',setup(b){
  b.onResolve({filter:/.*/},args=>{
   if(args.importer.endsWith('external-response.mjs')){
    if(args.path==='shared-vuejs/api/document-import-importEditableHtml')return{path:'persistence',namespace:'response-mock'};
    if(args.path==='shared-vuejs/api/document-model')return{path:'document',namespace:'response-mock'};
    if(args.path==='shared-vuejs/api/utility')return{path:'ids',namespace:'response-mock'};
    if(args.path==='shared-vuejs/api/shapeImportUtils')return{path:'geometry',namespace:'response-mock'};
    if(args.path==='./generated-fonts.mjs')return{path:'fonts',namespace:'response-mock'};
   }
  });
  b.onLoad({filter:/.*/,namespace:'response-mock'},args=>({contents:{
   persistence:`export const importEditableHtml=async file=>{window.__saved.push({html:await file.text()});return 'created-html';};export const importEditableDocument=async(doc,options)=>{window.__saved.push({doc,options});return 'created-json';};`,
   document:`export const blankDocument=()=>({file:{id:'new',width:1280,height:720},slides:[],assets:{}});`,
   ids:`let i=0;export const genId=()=> 'id-'+(++i);`,geometry:`export const getPrstInfo=(preset,w,h)=>({d:'R0,0,'+w+','+h});`,
   fonts:`export const generatedFontFamilies=()=>[];export const loadGeneratedGoogleFonts=async()=>[];`,
  }[args.path],resolveDir:resolve('.')}));
 }}]});
  writeFileSync(join(directory,'fixture.html'),'<!doctype html><body><script src="fixture.js"></script></body>');
  const output=await runBrowserFixture(chrome,pathToFileURL(join(directory,'fixture.html')).href,join(directory,'profile'));
  const match=/<pre id="result">([\s\S]*?)<\/pre>/.exec(output);assert.ok(match,output.slice(-1000));
  const result=JSON.parse(match[1].replaceAll('&quot;','"').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&'));assert.equal(result.error,undefined,result.error);assert.equal(result.ok,true);
 }finally{rmSync(directory,{recursive:true,force:true});}
});
