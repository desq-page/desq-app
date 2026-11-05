import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {existsSync,mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {runBrowserFixture} from './browser-fixture.mjs';
import {resolveCorePackage} from './local-core.mjs';
const chrome=process.env.CHROME_BIN||['C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/chromium'].find(existsSync);
const cases=[{file:'examples/html-slides/local-quiz.html',legacy:false}];
if(process.env.DESQ_TEST_LEGACY_GAME)cases.push({file:process.env.DESQ_TEST_LEGACY_GAME,legacy:true});
for(const {file,legacy} of cases)test('exported standalone HTML runs '+(legacy?'legacy Tom and Jerry':'explicit module')+' quiz branches and restores code',{skip:!chrome,timeout:60000},async()=>{
 const directory=mkdtempSync(join(tmpdir(),'desq-script-player-'));
 try{
  const source=readFileSync(file,'utf8');
  const runtime=readFileSync('../desq-core/shared-vuejs/src/edlib/common/export/single-html-assets/presentation.txt','utf8');
  const styles=readFileSync('../desq-core/shared-vuejs/src/edlib/common/export/single-html-assets/player.css','utf8');
  await build({stdin:{resolveDir:resolve('.'),contents:`
   import {parseFrontendSlides} from '../desq-core/shared-vuejs/src/edlib/html-import/frontend-slides-import.mjs';
   import {renderScriptedFrontendSlides} from '../desq-core/shared-vuejs/src/edlib/html-import/scripted-html-render.mjs';
   import {compileDeck} from './editor-vuejs/src/lib/agent/deck-compiler.mjs';
   import {resolveImportedScriptProject} from './editor-vuejs/src/lib/agent/html-script-project.mjs';
   import {resolveHtmlSlideLinks} from './editor-vuejs/src/lib/agent/html-slide-links.mjs';
   import {blankDocument} from '../desq-core/shared-vuejs/src/edlib/common/export/document-model.mjs';
   import {presentationHTML,readDocument} from '../desq-core/shared-vuejs/src/edlib/common/export/presentation-document.mjs';
   const check=(ok,message)=>{if(!ok)throw Error(message)};
   const until=async(test,message)=>{const start=Date.now();while(!test()){if(Date.now()-start>6000)throw Error(typeof message==='function'?message():message);await new Promise(r=>setTimeout(r,30));}};
   (async()=>{try{
    const source=${JSON.stringify(source)},deck=await renderScriptedFrontendSlides(source,parseFrontendSlides(source));
    let id=0;const compiled=compileDeck(deck,{width:1280,height:720,genId:()=>String(++id),geometry:(p,w,h)=>({d:'R0,0,'+w+','+h})});
    if (${legacy}) {
      const runs = compiled.pages[1].timing.m.filter(effect =>
        effect.bh.some(behavior => behavior.pr === 'ppt_x') &&
        effect.bh.some(behavior => behavior.pr === 'ppt_w'));
      check(runs.length >= 2, 'Tom and Jerry retain travel and facing in the same effect');
      for (const run of runs) {
        const horizontal = run.bh.find(behavior => behavior.pr === 'ppt_x');
        const facing = run.bh.find(behavior => behavior.pr === 'ppt_w');
        check(horizontal.cm[1].t === .45 && horizontal.cm[1].v !== horizontal.cm[0].v, 'travel reaches the turnaround');
        check(facing.cm.some(point => point.t === .5 && String(point.v).includes('(-1)')), 'facing becomes mirrored at 50%');
        check(run.du === 4 && !run.bh.some(behavior => behavior.pr === 'style.rotation'), 'four-second run without spin');
      }
    }
    const doc=blankDocument();doc.slides=compiled.pages.map((page,index)=>({...page,id:'page-'+index,fileId:doc.file.id}));
    resolveHtmlSlideLinks(doc.slides,doc.slides.map(s=>s.id));
    doc.file.slides=doc.slides.map(({id,name,transition,timing})=>({id,name,transition,timing}));doc.file.scripting=resolveImportedScriptProject(deck.scripting,doc.slides,doc.slides.map(s=>s.id));
    const html=presentationHTML(doc,${JSON.stringify(runtime)},{playerStyles:${JSON.stringify(styles)},playerAssets:[]});
    const restored=readDocument(html,'text/html');check(restored.file.scripting.modules[0].source===doc.file.scripting.modules[0].source,'HTML retains editable code');
    const iframe=document.createElement('iframe');iframe.style.cssText='width:1280px;height:720px';iframe.srcdoc=html;
    await new Promise(resolve=>{iframe.addEventListener('load',resolve,{once:true});document.body.append(iframe);});
    const win=iframe.contentWindow,d=iframe.contentDocument,project=doc.file.scripting,module=project.modules[0];let playbackError='';
    win.addEventListener('desq-script-error',e=>playbackError=e.detail.message);
    const shape=(slide,id)=>slide?.querySelector('[data-id="'+id+'"]')||slide?.querySelector('[id="'+id+'"]');
    const current=()=>d.querySelector('.slide.current');
    const click=node=>{check(node,'missing playable button: '+playbackError);node.dispatchEvent(new win.MouseEvent('click',{bubbles:true}));};
    if(${legacy}){
      const direct=()=>current()?.querySelector('[data-link^="@sld:"]');
      const popup=()=>shape(current(),module.refs['quiz-popup'][0]);
      const trigger=()=>shape(current(),module.refs['trigger-quiz-btn'][0]);
      const start=async(verifyMotion=false)=>{
        await until(direct,'legacy start button missing');click(direct());await until(popup,'legacy quiz did not open');
        if (verifyMotion) {
          const run = compiled.pages[1].timing.m.find(effect => effect.bh.some(behavior => behavior.pr === 'ppt_w'));
          const runner = shape(current(), run.sh);
          const matrix = () => new win.DOMMatrix(win.getComputedStyle(runner).transform);
          const facing = () => new win.DOMMatrix(win.getComputedStyle(runner.querySelector(':scope > .in-shp') || runner).transform);
          await until(() => matrix().e > 50, 'runner did not move across the arena');
          await until(() => facing().a < -.5 && matrix().e > 50, 'runner did not mirror while displaced');
        }
        check(getComputedStyle(popup()).display==='none','legacy popup initially hidden');click(trigger());await until(()=>getComputedStyle(popup()).display!=='none'&&getComputedStyle(trigger()).display==='none',()=> 'legacy quiz popup was not revealed: '+playbackError);await new Promise(resolve=>setTimeout(resolve,80));
      };
      const answer=(label)=>[...popup().querySelectorAll('[data-link^="@run:"]')].find(node=>label.test(node.textContent));
      await start(true);click(answer(/bowl of milk/i));
      await until(()=>/tom wins/i.test(current()?.textContent),()=> 'legacy correct branch did not open: '+playbackError+' / '+current()?.textContent.slice(0,120));
      click(current().querySelector('[data-link^="@run:"]'));await start();
      click(answer(/hot pepper pizza/i));
      await until(()=>/tom lost/i.test(current()?.textContent),()=> 'legacy wrong branch did not open: '+playbackError);
    }else{
    await until(()=>current()&&shape(current(),module.refs['choice-two'][0]),'initial slide did not open: '+playbackError);
    const popup=shape(current(),module.refs.feedback[0]);check(getComputedStyle(popup).display==='none','popup initially hidden');
    const correct=shape(current(),module.refs['choice-two'][0]);correct.dispatchEvent(new win.MouseEvent('click',{bubbles:true}));
    await until(()=>current()?.textContent.includes("That's right!"),'correct answer did not navigate: '+playbackError);
    const restart=shape(current(),module.refs['restart-win'][0]);restart.dispatchEvent(new win.MouseEvent('click',{bubbles:true}));
    await until(()=>shape(current(),module.refs['choice-three'][0]),'restart did not return');
    check(getComputedStyle(shape(current(),module.refs.feedback[0])).display==='none','feedback resets on restart');
    shape(current(),module.refs['choice-three'][0]).dispatchEvent(new win.MouseEvent('click',{bubbles:true}));
    await until(()=>current()?.textContent.includes('Try another choice.'),'wrong answer did not navigate: '+playbackError);
    }
    check(!playbackError,'player script error: '+playbackError);iframe.remove();
    document.body.insertAdjacentHTML('beforeend','<pre id="result">PASS</pre>');
   }catch(e){const el=document.createElement('pre');el.id='result';el.textContent=e.stack;document.body.append(el)}})();
  `},bundle:true,format:'iife',outfile:join(directory,'fixture.js'),plugins:[{name:'core',setup(b){b.onResolve({filter:/^shared-vuejs\//},args=>({path:resolveCorePackage(args.path,resolve('../desq-core'))}));}}]});
  writeFileSync(join(directory,'fixture.html'),'<!doctype html><body><script src="fixture.js"></script>');
  const output=await runBrowserFixture(chrome,pathToFileURL(join(directory,'fixture.html')).href,join(directory,'profile'));
  assert.equal(output.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1],'PASS');
 }finally{rmSync(directory,{recursive:true,force:true,maxRetries:6,retryDelay:100});}
});
