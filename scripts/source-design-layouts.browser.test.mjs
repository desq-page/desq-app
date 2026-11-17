import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { existsSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runBrowserFixture } from './browser-fixture.mjs';
import { resolveCorePackage } from './local-core.mjs';
const inlineCss=path=>readFileSync(path,'utf8').replace(/@import\s+["']([^"']+)["'];/g,(_,relative)=>inlineCss(resolve(dirname(path),relative)));
const chrome=process.env.CHROME_BIN||['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/chromium'].find(existsSync);
test('source-specific and original native layouts render as distinct, decodable editor thumbnails', {skip:!chrome,timeout:60000},async()=>{
  const directory=mkdtempSync(join(tmpdir(),'desq-source-previews-'));
  try {
    await build({stdin:{resolveDir:resolve('.'),contents:`
import {fitLayouts,readSlide,splitBulletContent,sharedDesignLayout} from './editor-vuejs/src/lib/design/reformat-layouts.mjs';
import {distinctLayoutSuggestions} from './editor-vuejs/src/lib/design/distinct-layouts.mjs';
import {canvasTextMeasurer} from './editor-vuejs/src/lib/agent/deck-text.mjs';
import generatedFamilies from './editor-vuejs/src/lib/design/generated-template-catalog.json';
import {loadGeneratedGoogleFonts} from './editor-vuejs/src/lib/agent/generated-fonts.mjs';
import {renderSlide} from 'shared-vuejs/api/public-renderer';
import {html2svg} from '../desq-core/shared-vuejs/src/lib/html2img.ts';
import tXml from '../desq-core/shared-vuejs/src/lib/txml/txml.ts';
import {shapeWrappingExtension} from '../desq-core/shared-vuejs/src/edlib/pptx/shapeWrappingExtension.ts';
const check=(ok,message)=>{if(!ok)throw Error(message)};
(async()=>{try{
let id=0;const genId=()=>String(++id),dims={width:1280,height:720};
const title={id:'title',ph:{$_type:'title'},txBody:{p:[{r:[{t:'Our priorities'}]}]}};
const body={id:'body',txBody:{p:['1. Listen to customers','2. Build a clear plan','3. Deliver better outcomes'].map(t=>({r:[{t}]}))}};
const content=splitBulletContent(readSlide({shapes:[title,body]},()=>false,dims),genId);
const theme={background:'#F6F1E7',foreground:'#252923',surface:'#E9E1D3',accent:'#97613B'};
const context=document.createElement('canvas').getContext('2d');
const options={...dims,theme,genId,profile:'standard',headingFont:'Arial',bodyFont:'Arial',measureText:canvasTextMeasurer(context)};
const candidates=fitLayouts(content,options);
const wanted=['source/peoples-platform/4','source/capsule/3','source/soft-editorial/9','source/neo-grid-bold/9','source/pin-and-paper/3',
'editorial-ivory-cards','midnight-signal-cards','terracotta-studio-cards','botanical-notes-cards','electric-violet-cards','swiss-red-cards'];
const selected=wanted.map(id=>candidates.find(c=>c.id===id)).filter(Boolean);
const decorated=candidates.find(candidate=>candidate.shapes.some(shape=>shape.name==='Design Ideas artwork: Template vector'));
check(decorated,'No SVG artwork layout fit');
if(!selected.some(candidate=>candidate.id===decorated.id))selected.push(decorated);
const summary=candidates.find(candidate=>candidate.id==='source/editorial-forest/8');
check(summary,'Editorial Forest summary did not fit');
selected.push(summary);
await loadGeneratedGoogleFonts(['Alfa Slab One','Archivo Narrow']);
const roadmapTitle={...title,txBody:{p:[{r:[{t:'Anticipated Problems'}]}]}};
const roadmapBody={...body,txBody:{p:[
  'What terms should you know that are associated with an EKG?',
  'What conditions can an EKG help diagnose, and why is it important to administer the test accurately?',
  'What are the purposes and routine uses of an EKG?',
].map((t,index)=>({pPr:{buChar:{$_char:'•'}},r:[{t}]}))}};
const roadmapContent=splitBulletContent(readSlide({shapes:[roadmapTitle,roadmapBody]},()=>false,dims),genId);
const roadmap=fitLayouts(roadmapContent,{...options,layoutIds:new Set(['source/peoples-platform/8'])})[0];
check(roadmap,'Roadmap did not fit EKG questions');
selected.push(roadmap);
for(const layoutId of ['source/peoples-platform/4','source/peoples-platform/9']){
  const candidate=fitLayouts(roadmapContent,{...options,layoutIds:new Set([layoutId])})[0];
  check(candidate,'Adaptable bullet composition did not fit '+layoutId);
  selected.push(candidate);
}
const closingTitle={...title,txBody:{p:[{r:[{t:'QUESTIONS?'}]}]}};
const closingContent=readSlide({shapes:[closingTitle]},()=>false,dims);
const closing=fitLayouts(closingContent,{...options,layoutIds:new Set(['source/peoples-platform/10'])})[0];
check(closing,'Closing composition did not fit');
selected.push(closing);
const photoCanvas=document.createElement('canvas');
photoCanvas.width=640;photoCanvas.height=480;
const photoContext=photoCanvas.getContext('2d');
photoContext.fillStyle='#52796f';photoContext.fillRect(0,0,640,480);
photoContext.fillStyle='#cad2c5';photoContext.fillRect(80,80,240,320);
const photo={id:'photo',type:'image',w:640,h:480,blipFill:{blip:{$_target:photoCanvas.toDataURL('image/png')}}};
for(const family of generatedFamilies)for(const count of [3,4,5]){
  const points=Array.from({length:count},(_,i)=>({id:'point-'+i,txBody:{p:[{r:[{t:'Talking point '+(i+1)+' with supporting detail.'}]}]}}));
  const content=readSlide({shapes:[title,...points,photo]},()=>false,dims);
  const candidate=fitLayouts(content,{...options,theme:family,layoutIds:new Set([family.slug+'-photo-points'])})[0];
  check(candidate,'Photo points failed for '+family.slug+' '+count);
  selected.push({...candidate,id:candidate.id+'-'+count});
}
const coverContent=readSlide({shapes:[{...title,solidFill:{uniClr:{$_val:'000000'}}}]},()=>false,dims);
const cover=fitLayouts(coverContent,{...options,layoutIds:new Set(['source/block-frame/1'])})[0];
check(cover,'BlockFrame cover did not fit a single title');
selected.push(cover);
check(selected.some(candidate=>candidate.id==='source/pin-and-paper/3'),'Principles layout did not fit');
check(selected.length>=8,'Not enough distinct source and original compositions fit: '+selected.map(c=>c.id));
const distinct=distinctLayoutSuggestions(selected.map(candidate=>({candidate})),dims);
check(distinct.length>=7,'Near duplicate layouts dominate native previews');
const previews=[];
for(const candidate of selected){
  const layout={id:'layout',...sharedDesignLayout(1280,720,genId,candidate.theme)};
  const render=shapes=>renderSlide({fileInfo:dims,slideInfo:{id:'slide',shapes,layoutid:'layout',showMaster:1},layoutInfo:layout,theme:{},baseHref:'',units:'rem'});
  async function raster(root){
    const url=await html2svg(root.outerHTML,null,1280,720,.4,'png');
    const image=new Image();image.src=url;await image.decode();
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=288;
    canvas.getContext('2d').drawImage(image,0,0);
    return canvas;
  }
  const root=render(candidate.shapes);
  const canvas=await raster(root);
  const heading=candidate.shapes.find(shape=>shape.id==='title');
  const withoutHeading=await raster(render(candidate.shapes.map(shape=>shape===heading?{...heading,txBody:undefined}:shape)));
  const frame=[Math.floor(heading.x*.4),Math.floor(heading.y*.4),Math.max(1,Math.floor(heading.w*.4)),Math.max(1,Math.floor(heading.h*.4))];
  const pixels=canvas.getContext('2d').getImageData(...frame).data;
  const reference=withoutHeading.getContext('2d').getImageData(...frame).data;
  let ink=0, firstInkRow=Infinity, lastInkRow=-1;
  for(let p=0;p<pixels.length;p+=4) {
    if(Math.abs(pixels[p]-reference[p])+Math.abs(pixels[p+1]-reference[p+1])+Math.abs(pixels[p+2]-reference[p+2])>24){
      ink++;
      const row=Math.floor(p/4/frame[2]);
      firstInkRow=Math.min(firstInkRow,row);
      lastInkRow=Math.max(lastInkRow,row);
    }
  }
  if(candidate.id==='source/block-frame/1'){
    const context=canvas.getContext('2d');
    const colorAt=(x,y)=>Array.from(context.getImageData(Math.round(x*.4),Math.round(y*.4),1,1).data).slice(0,3).join(',');
    check(heading.noFill,'The cover title inherited the original textbox fill');
    check(colorAt(230,155)==='255,253,245','Missing the off-white cover panel');
    check(colorAt(956,142)==='254,144,232','Missing the pink cover decoration');
    check(colorAt(936,508)==='153,232,133','Missing the green cover decoration');
  }
  if(candidate.id==='source/pin-and-paper/3'){
    const reopened=candidate.shapes.map(({reformatListNumber,...shape})=>{
      const ext=shape.cNvPrExtLst;
      if(!ext)return shape;
      const xml=tXml.stringify({'a:extLst':shapeWrappingExtension(shape,ext)},'ppt/slides/slide1.xml');
      const parsed=tXml(xml,{simplify:true,stripNamespaces:true});
      const p=shape.txBody.p.map(({r})=>({r:r.map(({t})=>({t}))}));
      return {...shape,name:'Rectangle',y:420,txBody:{p},cNvPrExtLst:parsed['a:extLst']};
    });
    const restored=readSlide({shapes:reopened},()=>false,dims);
    check(restored.title==='Our priorities','Lost the title role after OOXML serialization');
    check(restored.texts.slice(1).map(entry=>entry.marker).join(',')==='1,2,3','Lost bullet roles or numbers after OOXML serialization');
    const context=canvas.getContext('2d');
    const colorAt=(x,y)=>Array.from(context.getImageData(x,y,1,1).data).slice(0,3).join(',');
    check(lastInkRow-firstInkRow>=15,'The Principles headline rendered too small: '+(lastInkRow-firstInkRow+1)+'px');
    check(colorAt(10,10)==='239,229,106','Missing yellow paper background');
    check([35,195,355].map(x=>colorAt(x,220)).join('/')==='248,241,214/245,236,160/251,230,164','Missing distinct card fills');
  }
  check(ink>40,'Heading text did not render visibly: '+candidate.id);
  previews.push({id:candidate.id,png:canvas.toDataURL('image/png'),markup:root.outerHTML});
}
const unique=new Set(previews.map(p=>p.png)).size;
const output=document.createElement('pre');output.id='result';output.textContent=JSON.stringify({previews,unique});document.body.append(output);
}catch(error){const output=document.createElement('pre');output.id='result';output.textContent=JSON.stringify({error:error.stack});document.body.append(output)}})();
`},bundle:true,format:'iife',jsx:'automatic',jsxImportSource:'shared-vuejs/jsx',alias:{'vanjs-core':resolve('node_modules/vanjs-core/src/van.js')},outfile:join(directory,'fixture.js'),plugins:[
      {name:'inline-css',setup(b){b.onResolve({filter:/\.css\?inline$/},args=>({path:resolve(dirname(args.importer),args.path.split('?')[0]),namespace:'inline-css'}));b.onLoad({filter:/.*/,namespace:'inline-css'},args=>({contents:'export default '+JSON.stringify(inlineCss(args.path)),loader:'js'}));}},
      {name:'core',setup(b){b.onResolve({filter:/^shared-vuejs\//},args=>({path:resolveCorePackage(args.path,resolve('../desq-core'))}));}},
    ]});
    writeFileSync(join(directory,'fixture.html'),'<!doctype html><body><script src="fixture.js"></script>');
    const output=await runBrowserFixture(chrome,pathToFileURL(join(directory,'fixture.html')).href,join(directory,'profile'));
    const raw=output.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1];
    assert.ok(raw,'No preview result');
    const result=JSON.parse(raw.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&'));
    assert.ok(!result.error,result.error);
    if(process.env.DESIGN_PREVIEW_DIR){
      mkdirSync(process.env.DESIGN_PREVIEW_DIR,{recursive:true});
      for(const preview of result.previews){
        writeFileSync(join(process.env.DESIGN_PREVIEW_DIR,preview.id.replaceAll('/','-')+'.png'),Buffer.from(preview.png.split(',')[1],'base64'));
        writeFileSync(join(process.env.DESIGN_PREVIEW_DIR,preview.id.replaceAll('/','-')+'.html'),preview.markup);
      }
    }
    assert.equal(result.unique,result.previews.length,'Rendered previews are identical');
  } finally {rmSync(directory,{recursive:true,force:true});}
});
