import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {existsSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {runBrowserFixture} from './browser-fixture.mjs';
import {resolveCorePackage} from './local-core.mjs';
const chrome=process.env.CHROME_BIN||['C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/chromium'].find(existsSync);

test('local user modules run isolated, control imported objects and cancel runaway code',{skip:!chrome,timeout:60000},async()=>{
 const directory=mkdtempSync(join(tmpdir(),'desq-local-script-'));
 try{
  await build({stdin:{resolveDir:resolve('.'),contents:`
   import {createScriptRuntime,scriptWait} from '../desq-core/shared-vuejs/src/lib/scripting/runtime.mjs';
   import {parseFrontendSlides} from '../desq-core/shared-vuejs/src/edlib/html-import/frontend-slides-import.mjs';
   import {renderScriptedFrontendSlides} from '../desq-core/shared-vuejs/src/edlib/html-import/scripted-html-render.mjs';
   import {compileDeck} from './editor-vuejs/src/lib/agent/deck-compiler.mjs';
   import {resolveImportedScriptProject} from './editor-vuejs/src/lib/agent/html-script-project.mjs';
   const check=(ok,message)=>{if(!ok)throw Error(message)};
   (async()=>{try{
    const calls=[];
    const host={shape:async(method,id,args)=>calls.push([method,id,...args]),wait:scriptWait,validateSlide:id=>check(id==='native-win','resolved slide'),goto:id=>calls.push(['goto',id]),animate:async id=>calls.push(['animate',id])};
    const project={version:1,state:{score:0},modules:[{id:'game',source:'export async function checkAnswer(ctx, correct){if(typeof fetch!=="undefined"||typeof window!=="undefined")throw Error("VM escaped");ctx.state.set("score",ctx.state.get("score")+1);await ctx.shapes.show("feedback");await ctx.wait(10);await ctx.animations.play("feedback");await ctx.slides.goto(correct?"win":"lose");}',refs:{feedback:['native-feedback']},slides:{win:['native-win']}}],bindings:[{id:'answer',module:'game',function:'checkAnswer',args:[true]}]};
    let runtime=createScriptRuntime(project,host);await runtime.run('@run:answer');
    check(runtime.getState().score===1,'state retained');check(JSON.stringify(calls)===JSON.stringify([['show','native-feedback'],['animate','native-feedback'],['goto','native-win']]),'ordered API actions and aliases');
    await runtime.run('@set:LET(score, 7)');check(runtime.getState().score===7,'literal set links');
    let rejected=false;try{await runtime.run('@set:LET(score, fetch("url"))')}catch{rejected=true}check(rejected,'set expressions cannot evaluate');runtime.dispose();
    project.modules[0].source='export function checkAnswer(ctx){while(true){}}';
    runtime=createScriptRuntime(project,host,{timeoutMs:4000});rejected=false;try{await runtime.run('@run:answer')}catch(e){rejected=/interrupt|deadline/i.test(e.message)}check(rejected,'runaway code interrupted');runtime.dispose();
    project.modules[0].source='export async function checkAnswer(ctx){await ctx.wait(5000);await ctx.shapes.show("feedback")}';
    runtime=createScriptRuntime(project,host);const promise=runtime.run('@run:answer').then(()=>false,e=>/cancel/i.test(e.message));setTimeout(()=>runtime.cancel(),100);check(await promise,'navigation cancellation');runtime.dispose();
    const source='<style>.slide{position:relative;width:1280px;height:720px}button{width:200px;height:70px}#popup{display:none;width:300px;height:100px;background:yellow}</style><section class="slide" id="slide-1"><button id="answer" onclick="checkAnswer(true)">Answer</button><div id="popup">Correct!</div></section><section class="slide" id="slide-2">Win</section><script>function checkAnswer(correct){document.getElementById("popup").classList.add("show");}</script>';
    const deck=await renderScriptedFrontendSlides(source,parseFrontendSlides(source));
    check(deck.scripting?.bindings.length===1,'onclick retained');check(deck.scripting.initialHidden.length===1,'hidden popup retained');
    let id=0;const compiled=compileDeck(deck,{width:1280,height:720,genId:()=>String(++id),geometry:(p,w,h)=>({d:'R0,0,'+w+','+h})});
    const imported=resolveImportedScriptProject(deck.scripting,compiled.pages,['native-start','native-win']);
    const shapes=items=>items.flatMap(s=>[s,...shapes(s.children||[])]), all=shapes(compiled.pages[0].shapes);
    check(all.some(s=>s.link==='@run:'+imported.bindings[0].id),'native button binding');
    check(imported.modules[0].refs.popup.length>0,'popup reference mapped');check(imported.modules[0].refs.popup.every(id=>all.some(s=>s.id===id)),'references point to native objects');
    calls.length=0;runtime=createScriptRuntime(imported,host);await runtime.run('@run:'+imported.bindings[0].id);check(calls.some(c=>c[0]==='show'&&imported.modules[0].refs.popup.includes(c[1])),'imported editable custom function runs');runtime.dispose();
    document.body.insertAdjacentHTML('beforeend','<pre id="result">PASS</pre>');
   }catch(e){const el=document.createElement('pre');el.id='result';el.textContent=e.stack;document.body.append(el)}})();
  `},bundle:true,format:'iife',outfile:join(directory,'fixture.js'),plugins:[{name:'core',setup(b){b.onResolve({filter:/^shared-vuejs\//},args=>({path:resolveCorePackage(args.path,resolve('../desq-core'))}));}}]});
  writeFileSync(join(directory,'fixture.html'),'<!doctype html><body><script src="fixture.js"></script>');
  const output=await runBrowserFixture(chrome,pathToFileURL(join(directory,'fixture.html')).href,join(directory,'profile'));
  assert.equal(output.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1],'PASS');
 }finally{rmSync(directory,{recursive:true,force:true,maxRetries:6,retryDelay:100});}
});
