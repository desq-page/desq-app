import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtempSync,writeFileSync,rmSync,existsSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {runBrowserFixture} from './browser-fixture.mjs';
const chrome=process.env.CHROME_BIN||['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/chromium'].find(existsSync);
test('WordArt renders as SVG text in editor and player, and keeps normal editable text', {skip:!chrome,timeout:60000},async()=>{
 const directory=mkdtempSync(join(tmpdir(),'desq-wordart-'));
 try {
  const storeSource=readFileSync('../desq-core/shared-vuejs/src/edlib/vanjs/vanStore.ts','utf8');
  const revisionAccessors=storeSource.slice(storeSource.indexOf('  get modelRevision()'),storeSource.indexOf('\n',storeSource.indexOf('  set modelRevision(')))
    .replace('value: number','value');
  await build({stdin:{resolveDir:resolve('.'),contents:`
import van from 'vanjs-core';
import TextView from '../desq-core/shared-vuejs/src/vanjs/TextView.tsx';
import {wordArtPresets,wordArtSvg} from '../desq-core/shared-vuejs/src/lib/text/wordart.mjs';
(async()=>{try {
 const checks=[];
 const check=(ok,message)=>{if(!ok)throw Error(message);checks.push(message)};
 const shape={id:'art',type:'text',x:0,y:0,w:400,h:140,txBody:{bodyPr:{prstTxWarp:{$_prst:'textArchUp'}},p:[{r:[{t:'Việt Nam 🎄',rPr:{$_sz:4800,$_b:1,latin:{$_typeface:'Arial'},solidFill:{uniClr:{$_otag:'srgbClr',$_val:'123456'}}}}]}]}};
 for(const {value} of wordArtPresets){
  shape.txBody.bodyPr.prstTxWarp.$_prst=value;
  const element=TextView({shp:shape,editable:true,textFocus:van.state(false),fileInfo:{},theme:{},masterInfo:{}});
  document.body.append(element);
  const svg=element.querySelector('svg.wordart-svg');
  check(svg?.namespaceURI==='http://www.w3.org/2000/svg',value+' uses SVG');
  check(svg.querySelector('text')?.textContent.length>0,value+' uses text');
  for(const path of svg.querySelectorAll('textPath'))check(!!svg.querySelector(path.getAttribute('href')),value+' path reference');
  check(element.querySelector('.textbox').style.visibility==='hidden',value+' hides duplicate straight text');
  element.remove();
 }
 // Hit-test the painted SVG lettering, rather than dispatching directly to
 // a chosen node: ancestor textframes intentionally disable pointer events.
 for(const nested of [false,true]){
  const outer=document.createElement('div');outer.className='shp';outer.id='outer';
  const target=nested?document.createElement('div'):outer;
  target.className='shp';target.id=nested?'child':'outer';
  if(nested)outer.append(target);
  const art=TextView({shp:shape,editable:true,textFocus:van.state(false),fileInfo:{},theme:{},masterInfo:{}});
  art.style.cssText='position:relative;width:400px;height:140px;pointer-events:none';
  target.append(art);document.body.append(outer);
  let selected;
  outer.onpointerdown=event=>{selected=event.target.closest('.shp').id;};
  const svg=art.querySelector('.wordart-svg'),bounds=svg.getBoundingClientRect();
  let hit;
  for(let y=bounds.top+2;y<bounds.bottom&&!hit;y+=3)for(let x=bounds.left+2;x<bounds.right&&!hit;x+=3){
   const candidate=document.elementFromPoint(x,y);
   if(candidate?.closest('.wordart-svg')===svg)hit=candidate;
  }
  check(!!hit,'WordArt lettering receives pointer hits '+nested);
  hit.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0}));
  check(selected===(nested?'child':'outer'),'WordArt click reaches owning shape '+nested);
  outer.remove();
 }
 const playback=TextView({shp:shape,inEditor:false,editable:false,fileInfo:{},theme:{},masterInfo:{}});
 check(!!playback.querySelector('svg.wordart-svg'),'player uses same SVG');
 check(playback.querySelector('svg.wordart-svg').style.pointerEvents==='none','player WordArt remains noninteractive');
 const focus=van.state(true);
 const editor=TextView({shp:shape,editable:true,textFocus:focus,fileInfo:{},theme:{},masterInfo:{}});
 check(!editor.querySelector('svg.wordart-svg'),'editing uses regular text');
 check(editor.querySelector('.textbox').getAttribute('contenteditable')==='true','text remains editable');
 check(editor.querySelector('.textbox').textContent.includes('Việt Nam'),'Unicode text survives editing');
 check(editor.querySelector('.textbox').style.visibility!=='hidden','editing text visible');
 document.body.append(editor);
 focus.val=false;await new Promise(r=>setTimeout(r,30));
 check(!!editor.querySelector('svg.wordart-svg'),'leaving text editing restores WordArt');
 check(editor.querySelector('.textbox').style.visibility==='hidden','leaving editing hides straight text');
 focus.val=true;await new Promise(r=>setTimeout(r,30));
 check(!editor.querySelector('svg.wordart-svg'),'entering text editing hides WordArt');
 check(editor.querySelector('.textbox').style.visibility!=='hidden','entering editing reveals straight text');
 const liveShape=structuredClone(shape),shapeModelRevision=van.state(0);
 const liveStore={${revisionAccessors}};
 const live=TextView({shp:structuredClone(shape),editable:true,textFocus:van.state(false),updateLinkedText:true,
   getTextShape:()=>liveShape,getTextRevision:()=>liveStore.modelRevision,fileInfo:{},theme:{},masterInfo:{}});
 document.body.append(live);
 const originalTextbox=live.querySelector('.textbox');
 const run=liveShape.txBody.p[0].r[0];
 run.rPr={...run.rPr,latin:{$_typeface:'Georgia'},$_b:0,$_i:1,solidFill:{uniClr:{$_otag:'srgbClr',$_val:'EE2244'}}};
 liveStore.modelRevision++;await new Promise(r=>setTimeout(r,30));
 let span=live.querySelector('.wordart-svg tspan, .wordart-svg text[fill]');
 check(span?.getAttribute('fill')==='#ee2244'||span?.getAttribute('fill')==='#EE2244','color changes refresh WordArt immediately');
 check(span?.getAttribute('font-family')?.includes('Georgia'),'font family changes refresh WordArt immediately');
 check(span?.getAttribute('font-style')==='italic','italic changes refresh WordArt immediately');
 check(span?.getAttribute('font-weight')==='normal','bold changes refresh WordArt immediately');
 check(live.querySelector('.textbox')===originalTextbox,'format refresh preserves editable DOM');
 run.rPr={...run.rPr,ln:{$_w:19050,solidFill:{uniClr:{$_otag:'srgbClr',$_val:'0000FF'}}}};
 run.t='Updated WordArt';liveStore.modelRevision++;await new Promise(r=>setTimeout(r,30));
 span=live.querySelector('.wordart-svg text');
 check(live.querySelector('.wordart-svg').textContent.includes('Updated WordArt'),'text updates refresh WordArt immediately');
 check(!!live.querySelector('.wordart-svg [stroke-width="2"]'),'outline changes refresh WordArt immediately');
 run.rPr.effectLst={
   glow:{$_rad:38100,uniClr:{$_otag:'srgbClr',$_val:'00FF00'}},
   outerShdw:{$_dist:19050,$_blurRad:19050,uniClr:{$_otag:'srgbClr',$_val:'111111'}},
 };
 liveStore.modelRevision++;await new Promise(r=>setTimeout(r,30));
 check(live.querySelectorAll('.wordart-svg feDropShadow').length===2,'glow and shadow refresh WordArt immediately');
 check(live.querySelector('.textbox')===originalTextbox,'effect refresh preserves editable DOM');
 live.remove();
 const el=document.createElement('pre');el.id='result';el.textContent=JSON.stringify({checks:checks.length});document.body.append(el);
}catch(error){const el=document.createElement('pre');el.id='result';el.textContent=JSON.stringify({error:error.stack});document.body.append(el);}})();
`},alias:{'vanjs-core':resolve('node_modules/vanjs-core/src/van.js')},bundle:true,format:'iife',jsx:'automatic',jsxImportSource:'shared-vuejs/jsx',outfile:join(directory,'fixture.js')});
  writeFileSync(join(directory,'fixture.html'),'<!doctype html><body><script src="fixture.js"></script></body>');
  const output=await runBrowserFixture(chrome,pathToFileURL(join(directory,'fixture.html')).href,join(directory,'profile'));
  const match=/<pre id="result">([\s\S]*?)<\/pre>/.exec(output);assert.ok(match,output.slice(-1500));
  const result=JSON.parse(match[1].replaceAll('&quot;','"').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&'));
  assert.equal(result.error,undefined,result.error);assert.ok(result.checks>40);
 }finally{rmSync(directory,{recursive:true,force:true});}
});
