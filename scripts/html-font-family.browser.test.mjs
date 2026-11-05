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

test('HTML Baloo 2 text retains its family through capture, native conversion and CSS rendering', {skip:!chrome,timeout:60000}, async()=>{
 const directory=mkdtempSync(join(tmpdir(),'desq-html-font-'));
 try {
  await build({stdin:{resolveDir:resolve('.'),contents:`
   import {parseFrontendSlides} from '../desq-core/shared-vuejs/src/edlib/html-import/frontend-slides-import.mjs';
   import {renderScriptedFrontendSlides} from '../desq-core/shared-vuejs/src/edlib/html-import/scripted-html-render.mjs';
   import {compileDeck} from './editor-vuejs/src/lib/agent/deck-compiler.mjs';
   import {mapRPrStyle} from 'shared-vuejs/api/sharedMaster';
   const check=(ok,message)=>{if(!ok)throw Error(message)};
   (async()=>{try{
    const source='<style>body{font-family:"Baloo 2",sans-serif}.slide{width:1280px;height:720px}.hint{font-size:25px;font-weight:700}</style><section class="slide"><div class="hint">One question • Four choices • One dramatic ending</div></section>';
    const deck=await renderScriptedFrontendSlides(source,parseFrontendSlides(source));
    let id=0;
    const compiled=compileDeck(deck,{width:1280,height:720,genId:()=>String(++id),geometry:(p,w,h)=>({d:'R0,0,'+w+','+h})});
    const runs=[];
    const visit=shapes=>shapes.forEach(shape=>{for(const p of shape.txBody?.p||[])runs.push(...(p.r||[]));if(shape.children)visit(shape.children)});
    visit(compiled.pages[0].shapes);
    const run=runs.find(run=>run.t?.includes('One question'));
    check(run?.rPr?.latin?.$_typeface==='Baloo 2','native run preserves Baloo 2');
    const parent=document.createElement('div');parent.style.fontFamily='Carlito';
    const label=document.createElement('span');parent.append(label);document.body.append(parent);
    Object.assign(label.style,mapRPrStyle(run.rPr,{},{}));
    check(label.style.fontFamily.includes('Baloo 2'),'browser accepts generated family CSS');
    check(getComputedStyle(label).fontFamily.includes('Baloo 2'),'numbered family does not inherit Carlito');
    document.body.insertAdjacentHTML('beforeend','<pre id="result">PASS</pre>');
   }catch(e){const el=document.createElement('pre');el.id='result';el.textContent=e.stack;document.body.append(el)}})();
  `},bundle:true,format:'iife',outfile:join(directory,'fixture.js'),plugins:[{name:'core',setup(b){b.onResolve({filter:/^shared-vuejs\//},args=>({path:resolveCorePackage(args.path,resolve('../desq-core'))}));}}]});
  writeFileSync(join(directory,'fixture.html'),'<!doctype html><body><script src="fixture.js"></script>');
  const output=await runBrowserFixture(chrome,pathToFileURL(join(directory,'fixture.html')).href,join(directory,'profile'));
  assert.equal(output.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1],'PASS');
 } finally {rmSync(directory,{recursive:true,force:true});}
});
