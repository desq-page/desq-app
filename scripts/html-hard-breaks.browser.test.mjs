import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtempSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {runBrowserFixture} from './browser-fixture.mjs';
const chrome=process.env.CHROME_BIN || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/chromium'].find(existsSync);

test('HTML snapshot preserves explicit heading breaks across font remeasurement and keeps soft wrapping', {skip:!chrome,timeout:60000},async()=>{
 const directory=mkdtempSync(join(tmpdir(),'desq-hard-breaks-'));
 try {
  await build({stdin:{resolveDir:resolve('.'),contents:`
import {parseFrontendSlides} from '../desq-core/shared-vuejs/src/edlib/html-import/frontend-slides-import.mjs';
import {renderScriptedFrontendSlides} from '../desq-core/shared-vuejs/src/edlib/html-import/scripted-html-render.mjs';
import {htmlToSVG} from '../desq-core/shared-vuejs/src/edlib/html-import/html-slides.mjs';
(async()=>{try{
 const source='<style>.slide{width:1280px;height:720px}h1{position:absolute;left:200px;top:80px;font:48px Arial;width:max-content}p{position:absolute;left:200px;top:300px;font:24px Arial;width:140px}</style><section class="slide"><h1>The harvest is<br>only beginning.</h1><p>This paragraph wraps over several lines<br>and remains wrapped.</p></section>';
 const deck=await renderScriptedFrontendSlides(source,parseFrontendSlides(source));
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
 const result={headingWrap,paragraphWrap,lines};
 const el=document.createElement('pre');el.id='result';el.textContent=JSON.stringify(result);document.body.append(el);
}catch(error){const el=document.createElement('pre');el.id='result';el.textContent=JSON.stringify({error:error.stack});document.body.append(el);}})();
`},bundle:true,format:'iife',outfile:join(directory,'fixture.js')});
  writeFileSync(join(directory,'fixture.html'),'<!doctype html><body><script src="fixture.js"></script></body>');
  const output=await runBrowserFixture(chrome,pathToFileURL(join(directory,'fixture.html')).href,join(directory,'profile'));
  const match=/<pre id="result">([\s\S]*?)<\/pre>/.exec(output);
  assert.ok(match,output.slice(-1000));
  const result=JSON.parse(match[1].replaceAll('&quot;','"').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&'));
  assert.equal(result.error,undefined,result.error);
  assert.equal(result.headingWrap,'nowrap');
  assert.equal(result.paragraphWrap,'normal');
  assert.deepEqual(result.lines,['The harvest is','only beginning.']);
 } finally {rmSync(directory,{recursive:true,force:true});}
});
