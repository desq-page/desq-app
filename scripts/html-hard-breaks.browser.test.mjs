import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtempSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {runBrowserFixture} from './browser-fixture.mjs';
const chrome=process.env.CHROME_BIN || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/chromium'].find(existsSync);

test('HTML snapshot preserves explicit heading breaks across font remeasurement and keeps soft wrapping and inline fractions', {skip:!chrome,timeout:60000},async()=>{
 const directory=mkdtempSync(join(tmpdir(),'desq-hard-breaks-'));
 try {
  await build({stdin:{resolveDir:resolve('.'),contents:`
import {parseFrontendSlides} from '../desq-core/shared-vuejs/src/edlib/html-import/frontend-slides-import.mjs';
import {renderScriptedFrontendSlides} from '../desq-core/shared-vuejs/src/edlib/html-import/scripted-html-render.mjs';
import {normalizeHtmlFractionContainers} from './editor-vuejs/src/lib/agent/html-fractions.mjs';
import {compilePageSVG} from './editor-vuejs/src/lib/agent/ppt-master-svg.mjs';
import {htmlToSVG} from '../desq-core/shared-vuejs/src/edlib/html-import/html-slides.mjs';
(async()=>{try{
 const source='<style>.slide{width:1280px;height:720px}h1{position:absolute;left:200px;top:80px;font:48px Arial;width:max-content}p{position:absolute;left:200px;top:300px;font:24px Arial;width:140px}.comparison{position:absolute;top:480px;left:200px;width:800px;display:flex;align-items:center;justify-content:center;gap:15px;font:24px Arial}.fraction-inline{display:inline-flex;flex-direction:column;font-size:48px;color:#2563eb}.num{border-bottom:2px solid currentColor}</style><section class="slide"><h1>The harvest is<br>only beginning.</h1><p>This paragraph wraps over several lines<br>and remains wrapped.</p><p class="comparison">Compare <div class="fraction-inline"><span class="num">3 × 2</span><span>7 × 2</span></div> and <div class="fraction-inline"><span class="num">5</span><span>7</span></div>.</p></section>';
 const normalized=normalizeHtmlFractionContainers(source);
 const deck=await renderScriptedFrontendSlides(normalized,parseFrontendSlides(normalized));
 let headingWrap,paragraphWrap;
 const svg=htmlToSVG(deck.slides[0].html,{prepareLayout:(page)=>{
   const h=page.querySelector('h1'),p=page.querySelector('p');
   headingWrap=h.style.whiteSpace;paragraphWrap=p.style.whiteSpace;
   // A wider installed font reproduces the second-pass Google Font change
   // without relying on network requests in the regression test.
   h.style.fontFamily='monospace';
 }});
 const xml=new DOMParser().parseFromString(svg,'image/svg+xml');
 const heading=[...xml.querySelectorAll('text')].find(node=>node.textContent.includes('harvest'));
 const lines=[...heading.children].map(line=>line.textContent);
 let id=0;
 const compiled=compilePageSVG(svg,{width:1280,height:720,genId:()=>String(++id),geometry:(_,w,h)=>({d:'R0,0,'+w+','+h})});
 const comparison=compiled.shapes.find(shape=>shape.txBody?.p?.some(p=>p.r?.some(run=>run.t.includes('Compare'))));
 const runs=comparison?.txBody.p[0].r;
 const result={headingWrap,paragraphWrap,lines,alignment:comparison?.txBody.p[0].pPr.$_algn,fractions:runs?.filter(run=>run.docOmml).length,
   multiplication:runs?.some(run=>run.docMathML?.includes('×')),
   prose:runs?.filter(run=>!run.docOmml).map(run=>run.t).join(''),
   mathShapeCount:compiled.shapes.filter(shape=>shape.txBody?.p?.some(p=>p.r?.some(run=>run.docOmml))).length};
 const el=document.createElement('pre');el.id='result';el.textContent=JSON.stringify(result);document.body.append(el);
}catch(error){const el=document.createElement('pre');el.id='result';el.textContent=JSON.stringify({error:error.stack});document.body.append(el);}})();
`},bundle:true,format:'iife',outfile:join(directory,'fixture.js')});
  writeFileSync(join(directory,'fixture.html'),'<!doctype html><meta charset="utf-8"><body><script src="fixture.js"></script></body>');
  const output=await runBrowserFixture(chrome,pathToFileURL(join(directory,'fixture.html')).href,join(directory,'profile'));
  const match=/<pre id="result">([\s\S]*?)<\/pre>/.exec(output);
  assert.ok(match,output.slice(-1000));
  const result=JSON.parse(match[1].replaceAll('&quot;','"').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&'));
  assert.equal(result.error,undefined,result.error);
  assert.equal(result.headingWrap,'nowrap');
  assert.equal(result.paragraphWrap,'normal');
  assert.equal(result.fractions,2,JSON.stringify(result));
  assert.equal(result.multiplication,true);
  assert.equal(result.alignment,'ctr');
  assert.equal(result.mathShapeCount,1);
  assert.match(result.prose,/Compare.*and.*\./);
  assert.deepEqual(result.lines,['The harvest is','only beginning.']);
 } finally {rmSync(directory,{recursive:true,force:true});}
});
