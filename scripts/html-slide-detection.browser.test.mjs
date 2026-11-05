import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {existsSync, mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {runBrowserFixture} from './browser-fixture.mjs';

const chrome = process.env.CHROME_BIN || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/chromium', '/usr/bin/google-chrome',
].find(existsSync);

test('parser and browser capture agree on slide markers, numbered IDs and scenes', {skip: !chrome, timeout: 60000}, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'desq-slide-detection-'));
  try {
    await build({stdin:{resolveDir:resolve('.'),contents:`
      import {parseFrontendSlides} from '../desq-core/shared-vuejs/src/edlib/html-import/frontend-slides-import.mjs';
      import snapshot from '../desq-core/shared-vuejs/src/edlib/html-import/snapshot-slides-source.mjs';
      import {detectSlideElements} from '../desq-core/shared-vuejs/src/edlib/html-import/slide-detection.mjs';
      const check=(ok,message)=>{if(!ok)throw Error(message)};
      const parse=html=>{const t=document.createElement('template');t.innerHTML=html;return detectSlideElements(t.content)};
      (async()=>{try {
        check(parse('<div class="slide-container"><section class="slide">A</section><section class="slide">B</section></div>').length===2,'standard nested slides');
        check(parse('<div data-desq-slide>A</div><div data-desq-slide>B</div><div class="slide">decoy</div>').length===2,'explicit markers take precedence');
        check(parse('<section><h1>Article</h1></section><section>Content</section>').length===0,'ordinary sections are not slides');
        check(parse('<div id="slide-1">one</div>').length===0,'single arbitrary numbered element is not a deck');
        let ambiguous=false;try{parse('<div><i class="scene"></i><i class="scene"></i></div><div><i class="scene"></i><i class="scene"></i></div>')}catch{ambiguous=true}
        check(ambiguous,'ambiguous groups rejected');
        const cases=[
          ['<div id="slide-10"><h1>Ten</h1></div><div id="slide-2"><h1>Two</h1></div><div id="slide_1"><h1>One</h1></div>', ['One','Two','Ten']],
          ['<section class="scene active" id="intro"><h1>Intro</h1></section><section class="scene" id="question"><h1>Question</h1></section><section class="scene" id="win"><h1>Win</h1></section><section class="scene" id="lose"><h1>Lose</h1></section>', ['Intro','Question','Win','Lose']],
          ['<section data-desq-slide><h1>First</h1></section><section data-desq-slide><h1>Second</h1></section>', ['First','Second']],
        ];
        for(const [markup,titles] of cases){
          const source='<style>#stage{width:1280px;height:720px;position:relative}#stage>div,#stage>section{position:absolute;inset:0}.scene{display:none}.scene.active{display:block}</style><div id="stage">'+markup+'</div>';
          const parsed=parseFrontendSlides(source);
          check(JSON.stringify(parsed.slides.map(s=>s.title))===JSON.stringify(titles),'parser order');
          const result=await new Promise((resolve,reject)=>{
            const frame=document.createElement('iframe');
            const token=crypto.randomUUID();
            const timer=setTimeout(()=>reject(Error('Snapshot timeout')),10000);
            const receive=event=>{if(event.source!==frame.contentWindow||event.data.token!==token)return;clearTimeout(timer);removeEventListener('message',receive);frame.remove();resolve(event.data)};
            addEventListener('message',receive);
            frame.srcdoc=source+'<script>('+snapshot+')('+JSON.stringify(token)+',1280,'+titles.length+');<'+ '/script>';
            document.body.append(frame);
          });
          check(!result.error,result.error);
          check(result.slides.length===titles.length,'snapshot count');
          result.slides.forEach((html,index)=>{const t=document.createElement('template');t.innerHTML=html;check(t.content.querySelector('h1').textContent===titles[index],'snapshot order and hidden scene content')});
        }
        document.body.insertAdjacentHTML('beforeend','<pre id="result">PASS</pre>');
      }catch(error){const el=document.createElement('pre');el.id='result';el.textContent=error.stack;document.body.append(el)}})();
    `},bundle:true,format:'iife',outfile:join(directory,'fixture.js')});
    writeFileSync(join(directory,'fixture.html'),'<!doctype html><body><script src="fixture.js"></script>');
    const output = await runBrowserFixture(chrome,pathToFileURL(join(directory,'fixture.html')).href,join(directory,'profile'));
    assert.match(output, /<pre id="result">PASS<\/pre>/);
  } finally {
    rmSync(directory,{recursive:true,force:true});
  }
});
