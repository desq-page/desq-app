import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {existsSync,mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {runBrowserFixture} from './browser-fixture.mjs';
import {resolveCorePackage} from './local-core.mjs';
const chrome=process.env.CHROME_BIN||['C:/Program Files/Google/Chrome/Application/chrome.exe','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/chromium'].find(existsSync);

test('native imported HTML slides serialize and decode as thumbnail images', {skip:!chrome,timeout:60000}, async()=>{
 const directory=mkdtempSync(join(tmpdir(),'desq-html-thumbnail-'));
 try {
  await build({stdin:{resolveDir:resolve('.'),contents:`
   import {parseFrontendSlides} from '../desq-core/shared-vuejs/src/edlib/html-import/frontend-slides-import.mjs';
   import {renderScriptedFrontendSlides} from '../desq-core/shared-vuejs/src/edlib/html-import/scripted-html-render.mjs';
   import {compileDeck} from './editor-vuejs/src/lib/agent/deck-compiler.mjs';
   import {renderSlide} from 'shared-vuejs/api/public-renderer';
   import {registerEnv} from '../desq-core/shared-vuejs/dist/vanjs/mini-van-plate/src/shared.js';
   import vanServer from '../desq-core/shared-vuejs/dist/vanjs/mini-van-plate/src/van-plate.js';
   import {jsx} from '../desq-core/shared-vuejs/dist/vanjs/jsx/jsx.mjs';
   import van from 'vanjs-core';
   import SlideThumb from '../desq-core/shared-vuejs/dist/edlib/vanjs/SlideThumb.js';
   import {html2svg} from '../desq-core/shared-vuejs/src/lib/html2img.ts';
   import {rasterImage} from '../desq-core/shared-vuejs/src/lib/raster-render.mjs';
   const check=(ok,message)=>{if(!ok)throw Error(message)};
   (async()=>{try{
    let decodeError;
    try{await rasterImage('data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg"><g></svg>'),()=>{});}catch(error){decodeError=error;}
    check(decodeError?.message.includes('SVG XML:'),'decode failure includes the XML parser diagnosis');
    const source='<style>body{font-family:"Baloo 2",sans-serif}.slide{position:relative;width:1280px;height:720px;background:linear-gradient(#ffe88a,#e9823c)}h1{text-shadow:2px 3px #123456}</style><section class="slide"><h1>One question &amp; four choices</h1><svg viewBox="0 0 100 100" width="100" height="100"><path d="M10 10L90 10L50 90Z" fill="red"/></svg></section>';
    const deck=await renderScriptedFrontendSlides(source,parseFrontendSlides(source));
    let id=0;
    const compiled=compileDeck(deck,{width:1280,height:720,genId:()=>String(++id),geometry:(p,w,h)=>({d:'R0,0,'+w+','+h})});
    for(const page of compiled.pages){
      const root=renderSlide({fileInfo:{width:1280,height:720},slideInfo:{id:'slide',...page},theme:{},baseHref:'',units:'px'});
      registerEnv({van:vanServer});
      const serverRoot=SlideThumb({fileInfo:{width:1280,height:720},slideInfo:{id:'slide',...page},theme:{},baseHref:'',slideWidth:1280,slideHeight:720,slideIndex:1,useGrid:false});
      const fontLabel=jsx('span',{id:'font-quote-test',style:{fontFamily:'"Carlito"', '--label':'"Baloo 2" & more'},children:'Quoted font'});
      const serverHtml=vanServer.html(serverRoot,fontLabel).replace('<!DOCTYPE html><html>','').replace('</html>','');
      registerEnv({van});
      for(const markup of [root.outerHTML,serverHtml]){
      const url=await html2svg(markup,null,1280,720,.4,'jpg');
      const xml=decodeURIComponent(url.slice(url.indexOf(',')+1));
      const parsed=new DOMParser().parseFromString(xml,'image/svg+xml');
      check(!parsed.querySelector('parsererror'),parsed.querySelector('parsererror')?.textContent);
      if(markup===serverHtml){
        const label=parsed.querySelector('#font-quote-test');
        check(label?.getAttribute('style').includes('font-family:"Carlito"'),'font quotes survive HTML/XML serialization');
        check(label.getAttribute('style').includes('"Baloo 2" & more'),'style ampersands round-trip without double escaping');
      }
      const image=new Image();image.src=url;await image.decode();
      check(image.naturalWidth===512 && image.naturalHeight===288,'thumbnail dimensions');
      const canvas=document.createElement('canvas');canvas.width=512;canvas.height=288;
      canvas.getContext('2d').drawImage(image,0,0);
      check(canvas.toDataURL('image/jpeg').startsWith('data:image/jpeg'),'thumbnail can be encoded');
      }
    }
    document.body.insertAdjacentHTML('beforeend','<pre id="result">PASS</pre>');
   }catch(e){const el=document.createElement('pre');el.id='result';el.textContent=e.stack;document.body.append(el)}})();
  `},bundle:true,format:'iife',jsx:'automatic',jsxImportSource:'shared-vuejs/jsx',alias:{'vanjs-core':resolve('node_modules/vanjs-core/src/van.js')},outfile:join(directory,'fixture.js'),plugins:[
   {name:'inline-css',setup(b){b.onResolve({filter:/\.css\?inline$/},args=>({path:resolve(dirname(args.importer),args.path.split('?')[0]),namespace:'inline-css'}));b.onLoad({filter:/.*/,namespace:'inline-css'},args=>({contents:'export default '+JSON.stringify(readFileSync(args.path,'utf8')),loader:'js'}));}},
   {name:'core',setup(b){b.onResolve({filter:/^shared-vuejs\//},args=>({path:resolveCorePackage(args.path,resolve('../desq-core'))}));}}
  ]});
  writeFileSync(join(directory,'fixture.html'),'<!doctype html><body><script src="fixture.js"></script>');
  const output=await runBrowserFixture(chrome,pathToFileURL(join(directory,'fixture.html')).href,join(directory,'profile'));
  assert.equal(output.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1],'PASS');
 } finally {rmSync(directory,{recursive:true,force:true});}
});
