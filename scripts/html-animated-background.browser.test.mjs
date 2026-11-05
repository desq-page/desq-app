import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {existsSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {runBrowserFixture} from './browser-fixture.mjs';
import {resolveCorePackage} from './local-core.mjs';
const chrome=process.env.CHROME_BIN||['C:/Program Files/Google/Chrome/Application/chrome.exe','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/chromium'].find(existsSync);

test('tiled confetti backgrounds retain editable dots, gradients and repeating motion', {skip:!chrome,timeout:60000}, async()=>{
 const directory=mkdtempSync(join(tmpdir(),'desq-confetti-'));
 try {
  await build({stdin:{resolveDir:resolve('.'),contents:`
   import {parseFrontendSlides} from '../desq-core/shared-vuejs/src/edlib/html-import/frontend-slides-import.mjs';
   import {renderScriptedFrontendSlides} from '../desq-core/shared-vuejs/src/edlib/html-import/scripted-html-render.mjs';
   import {compileDeck} from './editor-vuejs/src/lib/agent/deck-compiler.mjs';
   const check=(ok,message)=>{if(!ok)throw Error(message)};
   (async()=>{try{
    const source='<style>#stage{width:1920px;height:1080px;position:relative}.scene{position:absolute;inset:0;display:none}.scene.active{display:block}.win{background:radial-gradient(circle at 50% 42%,#ffe88a,#ffbd3e 55%,#e9823c)}.lose{background:radial-gradient(circle at 50% 42%,#c9b1ef,#7451a6 70%,#3f326b)}.confetti{position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(circle,#fff 0 5px,transparent 6px),radial-gradient(circle,#f64e45 0 7px,transparent 8px),radial-gradient(circle,#3b8df5 0 6px,transparent 7px),radial-gradient(circle,#ffe16c 0 8px,transparent 9px);background-size:170px 190px,230px 210px,190px 240px,260px 180px;animation:confetti 5s linear infinite}@keyframes confetti{from{background-position:0 -800px,50px -600px,100px -900px,0 -400px}to{background-position:0 900px,50px 900px,100px 900px,0 900px}}</style><div id="stage"><section class="scene active win"><div class="confetti"></div><h1>Win</h1></section><section class="scene lose"><div class="confetti"></div><h1>Lose</h1></section></div>';
    const deck=await renderScriptedFrontendSlides(source,parseFrontendSlides(source));
    let id=0;
    const compiled=compileDeck(deck,{width:1280,height:720,genId:()=>String(++id),geometry:(p,w,h)=>({d:'R0,0,'+w+','+h})});
    check(compiled.pages.length===2,'both outcome screens');
    compiled.pages.forEach((page,index)=>{
      const checkPaths=items=>items.forEach(shape=>{
        check(!shape.d || !/\\.\\d{4,}/.test(shape.d),'confetti curves use at most three decimals');
        if(shape.children)checkPaths(shape.children);
      });
      checkPaths(page.shapes);
      check(deck.slides[index].html.includes('<path'),'confetti converted to vector paths');
      check(page.shapes.length>=5,'confetti layers survive native conversion');
      check(page.timing?.m?.length===4,'four animated confetti layers');
      check(page.timing.m.every(effect=>effect.bh.some(b=>b.pr==='ppt_y')),'vertical motion retained');
      check(page.timing.m.every(effect=>effect.du===5),'authored duration retained');
      check(page.shapes.some(shape=>shape.gradFill),'outcome gradient retained');
    });
    document.body.insertAdjacentHTML('beforeend','<pre id="result">PASS</pre>');
   }catch(e){const el=document.createElement('pre');el.id='result';el.textContent=e.stack;document.body.append(el)}})();
  `},bundle:true,format:'iife',outfile:join(directory,'fixture.js'),plugins:[{name:'core',setup(b){b.onResolve({filter:/^shared-vuejs\//},args=>({path:resolveCorePackage(args.path,resolve('../desq-core'))}));}}]});
  writeFileSync(join(directory,'fixture.html'),'<!doctype html><body><script src="fixture.js"></script>');
  const output=await runBrowserFixture(chrome,pathToFileURL(join(directory,'fixture.html')).href,join(directory,'profile'));
  const result=output.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1];
  assert.equal(result,'PASS');
 } finally {rmSync(directory,{recursive:true,force:true});}
});
