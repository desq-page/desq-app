import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFileSync,existsSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
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
   import {agentHtmlDocument} from 'shared-vuejs/api/document-import-importAgentHtml';
   import {compileDeck} from './editor-vuejs/src/lib/agent/deck-compiler.mjs';
   import {resolveHtmlSlideLinks} from './editor-vuejs/src/lib/agent/html-slide-links.mjs';
   const check=(ok,message)=>{if(!ok)throw Error(message)};
   (async()=>{try{
    const source=${JSON.stringify(readFileSync(process.env.DESQ_IMPORT_SAMPLE, "utf8"))};

    const doc = await agentHtmlDocument(source, 'minimax_tom-and-jerry-fractions.html');
    const modules = doc.file.scripting.modules;
    const flatten = list => list.flatMap(shape => [shape, ...flatten(shape.children || [])]);
    const shapes = doc.slides.flatMap(slide => flatten(slide.shapes));
    for (const alias of ['win-lives', 'over-lives']) {
      const ids = modules.find(module => module.refs[alias])?.refs[alias];
      const shape = shapes.find(shape => shape.id === ids?.[0]);
      check(ids?.length === 1 && shape?.txBody && JSON.stringify(shape.txBody).includes('♥♥♥'), alias + ' maps to editable hearts');
    }
    document.body.insertAdjacentHTML('beforeend','<pre id="result">PASS</pre>');
   }catch(e){const el=document.createElement('pre');el.id='result';el.textContent=e.stack;document.body.append(el)}})();
  `},bundle:true,format:'iife',outfile:join(directory,'fixture.js'),plugins:[{name:'core',setup(b){b.onResolve({filter:/^shared-vuejs\//},args=>({path:resolveCorePackage(args.path,resolve('../desq-core'))}));}}]});
  writeFileSync(join(directory,'fixture.html'),'<!doctype html><body><script src="fixture.js"></script>');
  const output=await runBrowserFixture(chrome,pathToFileURL(join(directory,'fixture.html')).href,join(directory,'profile'));
  assert.equal(output.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1],'PASS');
 }finally{rmSync(directory,{recursive:true,force:true});}
});
