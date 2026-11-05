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

test('window grille and door retain editable bars and same-side rounded native geometry', {skip:!chrome,timeout:60000}, async()=>{
 const directory=mkdtempSync(join(tmpdir(),'desq-window-pseudo-'));
 try {
  await build({stdin:{resolveDir:resolve('.'),contents:`
   import {parseFrontendSlides} from '../desq-core/shared-vuejs/src/edlib/html-import/frontend-slides-import.mjs';
   import {renderScriptedFrontendSlides} from '../desq-core/shared-vuejs/src/edlib/html-import/scripted-html-render.mjs';
   import {compileDeck} from './editor-vuejs/src/lib/agent/deck-compiler.mjs';
   const check=(ok,message)=>{if(!ok)throw Error(message)};
   (async()=>{try{
    const source='<style>*{box-sizing:border-box}#stage{position:relative;width:1920px;height:1080px}.scene{position:absolute;inset:0;display:none}.scene.active{display:block}.window{position:absolute;left:170px;top:90px;width:300px;height:240px;border:20px solid #8b5638;background:#a9d8e8}.window:before{content:"";position:absolute;left:50%;top:0;bottom:0;width:12px;background:#8b5638}.window:after{content:"";position:absolute;left:0;right:0;top:50%;height:12px;background:#8b5638}</style><div id="stage"><section class="scene active"><div class="window"></div></section><section class="scene"><div class="window"></div></section></div>';
    const withDoor=source.replace('</style>','.door{position:absolute;right:150px;top:100px;width:250px;height:510px;border:18px solid #75452e;border-bottom:0;border-radius:130px 130px 0 0;background:#593927}</style>').replaceAll('<div class="window"></div>','<div class="window"></div><div class="door"></div>');
    const deck=await renderScriptedFrontendSlides(withDoor,parseFrontendSlides(withDoor));
    let id=0;
    const compiled=compileDeck(deck,{width:1280,height:720,genId:()=>String(++id),geometry:(p,w,h)=>({d:'R0,0,'+w+','+h})});
    for(let index=0;index<2;index++){
      const template=document.createElement('template');template.innerHTML=deck.slides[index].html;
      check(template.content.querySelectorAll('[data-html-generated]').length===2,'both pseudo bars materialized once');
      const shapes=compiled.pages[index].shapes;
      const checkPaths=items=>items.forEach(shape=>{
        check(!shape.d || !/\\.\\d{4,}/.test(shape.d),'HTML native paths use at most three decimals');
        if(shape.children)checkPaths(shape.children);
      });
      checkPaths(shapes);
      check(shapes.some(s=>Math.abs(s.w-8)<.1 && Math.abs(s.h-200*2/3)<.1),'editable vertical grille');
      check(shapes.some(s=>Math.abs(s.w-260*2/3)<.1 && Math.abs(s.h-8)<.1),'editable horizontal grille');
      const door=shapes.filter(s=>s.prstGeom?.$_prst==='round2SameRect');
      check(door.length===2,'door frame and fill use native same-side rounded rectangles');
      check(door.every(s=>s.prstGeom.avLst.gd.some(g=>g.$_name==='adj2' && g.$_fmla==='val 0')),'door bottom corners remain square');
      check(door.some(s=>Math.abs(s.w-250*2/3)<.1 && Math.abs(s.h-510*2/3)<.1),'door outer frame dimensions');
      check(door.some(s=>Math.abs(s.w-214*2/3)<.1 && Math.abs(s.h-492*2/3)<.1),'door inset has no bottom border');
    }
    document.body.insertAdjacentHTML('beforeend','<pre id="result">PASS</pre>');
   }catch(e){const el=document.createElement('pre');el.id='result';el.textContent=e.stack;document.body.append(el)}})();
  `},bundle:true,format:'iife',outfile:join(directory,'fixture.js'),plugins:[{name:'core',setup(b){b.onResolve({filter:/^shared-vuejs\//},args=>({path:resolveCorePackage(args.path,resolve('../desq-core'))}));}}]});
  writeFileSync(join(directory,'fixture.html'),'<!doctype html><body><script src="fixture.js"></script>');
  const output=await runBrowserFixture(chrome,pathToFileURL(join(directory,'fixture.html')).href,join(directory,'profile'));
  assert.equal(output.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1],'PASS');
 } finally {rmSync(directory,{recursive:true,force:true});}
});
