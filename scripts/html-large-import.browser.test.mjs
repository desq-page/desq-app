import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {existsSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {runBrowserFixture} from './browser-fixture.mjs';
const chrome=process.env.CHROME_BIN||['C:/Program Files/Google/Chrome/Application/chrome.exe','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/chromium'].find(existsSync);

test('a 20-slide HTML file with form fields and a large script project converts to an editable document', {skip:!chrome,timeout:60000},async()=>{
 const directory=mkdtempSync(join(tmpdir(),'desq-large-html-'));
 try{
  await build({stdin:{resolveDir:resolve('.'),contents:`
   import {agentHtmlDocument} from 'shared-vuejs/api/document-import-importAgentHtml';
   (async()=>{try{
    const slides = Array.from({length:20}, (_, i) =>
      '<section data-desq-slide id="slide-'+i+'"><h1>Slide '+(i+1)+'</h1><input type=number><select><option>Choose</option></select><textarea>Answer</textarea></section>').join('');
    const scripts = ['quiz', 'feedback'].map(id =>
      '<script type="application/desq-script" data-module="'+id+'">export function run() {} // '+ 'x'.repeat(140*1024) + '</script>').join('');
    const source = scripts + '<style>section{width:1280px;height:720px}h1{font:40px Arial}</style>'+slides;
    const doc = await agentHtmlDocument(source, 'large-deck.html');
    if (doc.slides.length !== 20 || doc.slides.some(slide => !slide.shapes.length))
      throw Error('Expected 20 editable slides');
    if (doc.file.scripting?.modules.length !== 2)
      throw Error('Expected both script modules to survive import');
    const all = shapes => shapes.flatMap(shape => [shape, ...all(shape.children || [])]);
    const fields = all(doc.slides[0].shapes).filter(shape => shape.htmlField);
    if (fields.length !== 3 || fields.some(shape => shape.prstGeom?.$_prst !== 'roundRect'))
      throw Error('Expected three rounded rectangle fields, got '+JSON.stringify(fields));
    document.body.insertAdjacentHTML('beforeend','<pre id="result">PASS</pre>');
   }catch(e){const el=document.createElement('pre');el.id='result';el.textContent=e.stack;document.body.append(el)}})();
  `},bundle:true,format:'iife',outfile:join(directory,'fixture.js')});
  writeFileSync(join(directory,'fixture.html'),'<!doctype html><body><script src="fixture.js"></script>');
  const output=await runBrowserFixture(chrome,pathToFileURL(join(directory,'fixture.html')).href,join(directory,'profile'));
  assert.equal(output.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1],'PASS');
 }finally{rmSync(directory,{recursive:true,force:true});}
});
