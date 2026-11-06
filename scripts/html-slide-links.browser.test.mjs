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

test('direct scripted and declarative slide jumps survive HTML capture and native conversion', {skip:!chrome,timeout:60000},async()=>{
 const directory=mkdtempSync(join(tmpdir(),'desq-slide-links-'));
 try{
  await build({stdin:{resolveDir:resolve('.'),contents:`
   import {parseFrontendSlides} from '../desq-core/shared-vuejs/src/edlib/html-import/frontend-slides-import.mjs';
   import {renderScriptedFrontendSlides} from '../desq-core/shared-vuejs/src/edlib/html-import/scripted-html-render.mjs';
   import {agentHtmlDocument} from './editor-vuejs/src/lib/main/importAgentHtml.mjs';
   import {compileDeck} from './editor-vuejs/src/lib/agent/deck-compiler.mjs';
   import {resolveHtmlSlideLinks} from './editor-vuejs/src/lib/agent/html-slide-links.mjs';
   const check=(ok,message)=>{if(!ok)throw Error(message)};
   (async()=>{try{
    const source='<style>.slide{position:relative;width:1280px;height:720px}body{background:#0f172a}.deck-stage{border-radius:16px;background:linear-gradient(135deg,#f8fafc,#e2e8f0)}button{background:#ffe88a;padding:20px;font-size:30px}</style><main class="deck-stage"><section class="slide" id="slide-1"><nav><button onclick="goToSlide(&quot;slide-2&quot;)">Start Chase</button><button onclick="showQuiz()">Quiz</button></nav></section><section class="slide" id="slide-2" style="background:#abc"><button data-desq-goto="slide-1">Back</button></section></main>';
    let invalid=false;try{parseFrontendSlides(source.replace('data-desq-goto="slide-1"','data-desq-goto="missing"'))}catch{invalid=true}check(invalid,'missing target rejected');
    const deck=await renderScriptedFrontendSlides(source,parseFrontendSlides(source));
    check(!deck.slides[0].html.includes('onclick='),'script handlers stripped after extracting links');
    let id=0;const compiled=compileDeck(deck,{width:1280,height:720,genId:()=>String(++id),geometry:(p,w,h)=>({d:'R0,0,'+w+','+h})});
    check(compiled.pages[0].bg?.bgPr?.gradFill?.gsLst?.gs.length === 2, 'transparent slide keeps stage gradient');
    check(!!compiled.pages[1].bg?.bgPr?.solidFill, 'explicit slide fill takes precedence');
    const doc = await agentHtmlDocument(source, 'Shared background.html');
    const layout = doc.layouts.find(layout => layout.sharedHtmlLayout);
    check(layout?.shapes[0]?.gradFill?.gsLst?.gs.length === 2 && layout.shapes[0].prstGeom?.$_prst === 'roundRect', 'stage gradient lives on a rounded layout shape');
    check(doc.slides.every(slide => slide.layoutid === layout.id), 'both slides use the shared layout');
    check(!doc.slides[0].bg && !doc.slides[1].bg && doc.slides[1].shapes[0]?.solidFill &&
      doc.slides[1].shapes[0].name === 'Slide background', 'the explicit slide fill paints above the shared shape');
    const rounded = await agentHtmlDocument(source.replace(' style="background:#abc"', ''), 'Rounded stage.html');
    const roundedLayout = rounded.layouts.find(layout => layout.sharedHtmlLayout);
    const backdrop = roundedLayout?.shapes[0];
    check(roundedLayout?.bg?.bgPr?.solidFill?.uniClr?.$_val === '0F172A', 'body color fills the canvas behind the stage');
    check(backdrop?.prstGeom?.$_prst === 'roundRect' &&
      backdrop.prstGeom.avLst.gd[0].$_fmla === 'val 2222' && backdrop.gradFill, 'rounded stage becomes one editable gradient shape');
    check(rounded.slides.every(slide => slide.layoutid === roundedLayout.id && !slide.bg), 'rounded backdrop stays on the layout');
    const solidParent = source.replace('border-radius:16px;background:linear-gradient(135deg,#f8fafc,#e2e8f0)', 'background:#f8fafc')
      .replace('id="slide-1">', 'id="slide-1" style="background:#def">');
    const explicit = await agentHtmlDocument(solidParent, 'Square parent.html');
    check(explicit.layouts[0]?.shapes[0]?.prstGeom?.$_prst === 'rect' &&
      explicit.slides.every(slide => slide.shapes[0]?.name === 'Slide background'), 'solid parent stays on layout even when every slide has its own background');
    resolveHtmlSlideLinks(compiled.pages,compiled.pages.map((_,i)=>'imported-'+i));
    const links=shapes=>shapes.flatMap(shape=>[...(shape.link?[shape.link]:[]),...(shape.children?links(shape.children):[])]);
    check(links(compiled.pages[0].shapes).includes('@sld:imported-1'),'Start links to second imported slide');
    check(links(compiled.pages[1].shapes).includes('@sld:imported-0'),'Back links to first imported slide');
    check(deck.scripting.modules.some(m=>m.source.includes('showQuiz()')),'custom handler retained as editable source');
    const blockedLoad = source + '<script>window.addEventListener("load", event => event.stopImmediatePropagation());<'+ '/script>';
    const fallbackDeck = await renderScriptedFrontendSlides(blockedLoad, parseFrontendSlides(blockedLoad), {timeout: 8000});
    check(fallbackDeck.slides[0].html.includes('Start Chase'), 'capture completes when the load listener is blocked');
    document.body.insertAdjacentHTML('beforeend','<pre id="result">PASS</pre>');
   }catch(e){const el=document.createElement('pre');el.id='result';el.textContent=e.stack;document.body.append(el)}})();
  `},bundle:true,format:'iife',outfile:join(directory,'fixture.js'),plugins:[{name:'core',setup(b){b.onResolve({filter:/^shared-vuejs\//},args=>({path:resolveCorePackage(args.path,resolve('../desq-core'))}));}}]});
  writeFileSync(join(directory,'fixture.html'),'<!doctype html><body><script src="fixture.js"></script>');
  const output=await runBrowserFixture(chrome,pathToFileURL(join(directory,'fixture.html')).href,join(directory,'profile'));
  assert.equal(output.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1],'PASS');
 }finally{rmSync(directory,{recursive:true,force:true});}
});
