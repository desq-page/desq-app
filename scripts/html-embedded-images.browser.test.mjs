import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtempSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {runBrowserFixture} from './browser-fixture.mjs';
import {resolveCorePackage} from './local-core.mjs';
const chrome=process.env.CHROME_BIN||['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/chromium'].find(existsSync);
test('embedded HTML image bytes, dimensions, deduplication and alpha masks survive native conversion', {skip:!chrome,timeout:60000},async()=>{
 const directory=mkdtempSync(join(tmpdir(),'desq-embedded-images-'));
 try{
  await build({stdin:{resolveDir:resolve('.'),contents:`
import {prepareEmbeddedHtmlImages,embeddedHtmlAssets} from './editor-vuejs/src/lib/agent/html-embedded-images.mjs';
import {parseFrontendSlides} from '../desq-core/shared-vuejs/src/edlib/html-import/frontend-slides-import.mjs';
import {renderScriptedFrontendSlides} from '../desq-core/shared-vuejs/src/edlib/html-import/scripted-html-render.mjs';
import {compileDeck} from './editor-vuejs/src/lib/agent/deck-compiler.mjs';
import {renderSlide} from '../desq-core/shared-vuejs/src/public/renderer.tsx';
(async()=>{try{
 const checks=[];const check=(ok,message)=>{if(!ok)throw Error(message);checks.push(message)};
 const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;const ctx=canvas.getContext('2d');ctx.fillStyle='#ff0000';ctx.fillRect(0,0,32,32);const data=canvas.toDataURL();
 const source='<style>.slide{width:1280px;height:720px}img{position:absolute;top:0;width:200px;height:200px;object-fit:cover}.fade{left:0;mask-image:linear-gradient(90deg,transparent 0%,black 19%)}.second{left:300px}</style><section class="slide"><img class="fade" src="'+data+'" alt="Original embedded photo"><img class="second" src="'+data+'" alt="Duplicate embedded photo"></section>';
 const embedded=await prepareEmbeddedHtmlImages(source);
 check(embedded.images.size===1,'identical image bytes deduplicate');
 check([...embedded.images.values()][0].w===32,'intrinsic dimensions retained');
 check(!embedded.source.includes('src="data:'),'embedded bytes stay outside measured markup');
 const deck=await renderScriptedFrontendSlides(embedded.source,parseFrontendSlides(embedded.source));let id=0;
 const compiled=compileDeck(deck,{width:1280,height:720,genId:()=> 'image-'+(++id),geometry:(p,w,h)=>({d:'R0,0,'+w+','+h}),assets:embeddedHtmlAssets(deck,embedded.images)});
 const images=compiled.pages[0].shapes.filter(s=>s.type==='image');
 check(images.length===2,'both image shapes imported');
 check(images.every(s=>s.blipFill.blip.$_target==='html-image-1.png'),'original media referenced by both shapes');
 const gradient=images[0].blipFill.blip.alphaMod?.cont?.fill?.gradFill;
 check(gradient?.gsLst.gs[0].uniClr.alpha.$_val===0,'fade begins transparent');
 check(gradient?.gsLst.gs[1].$_pos===19000,'fade ends at authored nineteen percent');
 check(gradient?.gsLst.gs[1].uniClr.alpha.$_val===100000,'fade ends opaque');
 images.forEach(s=>s.blipFill.blip.dataUrl=data);
 const root=renderSlide({fileInfo:{width:1280,height:720},slideInfo:{id:'slide',shapes:images},theme:{},baseHref:'',units:'px'});
 const mask=root.querySelector('mask[id$="_alpha_msk"]');
 check(!!mask,'native image alpha effect uses SVG mask');
 check(mask.style.maskType==='alpha','mask uses opacity rather than black luminance');
 check(!!root.querySelector('linearGradient[id$="_alpha_grad"]'),'existing gradient renderer supplies fade');
 const svg=mask.closest('svg');const image=new Image();const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml'}));
 try{image.src=url;await image.decode();const out=document.createElement('canvas');out.width=200;out.height=200;const c=out.getContext('2d');c.drawImage(image,0,0,200,200);check(c.getImageData(1,100,1,1).data[3]<30,'rendered left edge fades out');check(c.getImageData(100,100,1,1).data[3]>240,'rendered middle stays opaque');}finally{URL.revokeObjectURL(url);}
 const el=document.createElement('pre');el.id='result';el.textContent=JSON.stringify({checks:checks.length});document.body.append(el);
}catch(e){const el=document.createElement('pre');el.id='result';el.textContent=JSON.stringify({error:e.stack});document.body.append(el);}})();
`},bundle:true,format:'iife',jsx:'automatic',jsxImportSource:'shared-vuejs/jsx',alias:{'vanjs-core':resolve('node_modules/vanjs-core/src/van.js')},outfile:join(directory,'fixture.js'),plugins:[{name:'local-core',setup(b){b.onResolve({filter:/^shared-vuejs\//},args=>({path:resolveCorePackage(args.path,resolve('../desq-core'))}));}}]});
  writeFileSync(join(directory,'fixture.html'),'<!doctype html><body><script src="fixture.js"></script></body>');
  const output=await runBrowserFixture(chrome,pathToFileURL(join(directory,'fixture.html')).href,join(directory,'profile'));
  const match=/<pre id="result">([\s\S]*?)<\/pre>/.exec(output);assert.ok(match,output.slice(-1000));
  const result=JSON.parse(match[1].replaceAll('&quot;','"').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&'));assert.equal(result.error,undefined,result.error);assert.ok(result.checks>=13);
 }finally{rmSync(directory,{recursive:true,force:true});}
});
