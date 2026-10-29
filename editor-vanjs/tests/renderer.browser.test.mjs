import { build } from 'esbuild';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, cp, rm, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runBrowserFixture } from '../../scripts/browser-fixture.mjs';
const chrome = process.env.CHROME_BIN || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/chromium', '/usr/bin/google-chrome'].find(existsSync);

test('native editor uses shared geometry, gradients, grouped text, images, tables and chart previews', { skip: !chrome, timeout: 60000 }, async () => {
  const temp = await mkdtemp(join(tmpdir(), 'savanna-renderer-'));
  try {
    // browser.test builds the same outputs too; do not rebuild shared output
    // concurrently from different test workers.
    await cp(new URL('../dist/', import.meta.url), temp, { recursive: true });
    await mkdir(join(temp, 'assets'), { recursive: true });
    await writeFile(join(temp, 'assets/sample.png'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j8ioAAAAASUVORK5CYII=', 'base64'));
    const helper = await build({ entryPoints: [new URL('./zip-browser-helper.mjs', import.meta.url).pathname], bundle: true, format: 'iife', write: false });
    const script = String.raw`<script>window.addEventListener('DOMContentLoaded',async()=>{
      const check=(ok,message)=>{if(!ok)throw Error(message)};
      const tick=()=>new Promise(r=>setTimeout(r,60));
      try {
        await SavannaVanEditor.ready();
        const R=SavannaRenderer;
        const doc=SavannaVanEditor.blankDocument();
        doc.file.fonts=[{type:'google',family:'Roboto'}];
        const fill=v=>({uniClr:{$_otag:'srgbClr',$_val:v}});
        const tx=text=>({bodyPr:{$_lIns:0,$_rIns:0,$_tIns:0,$_bIns:0},p:{r:{t:text,rPr:{$_sz:2400,$_b:1,solidFill:fill('112233'),latin:{$_typeface:'Arial'}}}}});
        const base=(id,x,y,w=160,h=90)=>({id,name:id,type:'rectangle',x,y,w,h,d:'R0,0,'+w+','+h,solidFill:fill('4472C4'),ln:{noFill:true}});
        const gradient={gsLst:{gs:[{$_pos:0,uniClr:{$_otag:'srgbClr',$_val:'FF0000'}},{$_pos:100000,uniClr:{$_otag:'srgbClr',$_val:'0000FF'}}]},lin:{$_ang:5400000,$_scaled:1}};
        doc.slides[0].shapes=[
          {...base('gradient',40,40),gradFill:gradient,solidFill:undefined,rot:20},
          {...base('path',250,40),d:'M80,0L160,90L0,90Z',effectLst:{outerShdw:{$_blurRad:38100,$_dist:38100,$_dir:2700000,uniClr:{$_otag:'srgbClr',$_val:'333333'}}}},
          {...base('group',40,180,300,150),type:'group',gradFill:gradient,solidFill:undefined,children:[
            {...base('group-leaf',10,10,100,80),grpFill:true,solidFill:undefined},
            {...base('group-text',120,10,160,80),noFill:true,txBody:tx('Grouped text')}]},
          {...base('image',400,180,120,120),type:'image',$_otag:'pic',blipFill:{blip:{$_target:'sample.png',$_w:1,$_h:1},stretch:{fillRect:{}}}},
          {...base('table',40,390,400,80),type:'table',graphic:{graphicData:{tbl:{tblPr:{},tblGrid:{gridCol:[{$_w:1905000},{$_w:1905000}]},tr:[{$_h:762000,tc:[{txBody:tx('Cell A'),tcPr:{}},{txBody:tx('Cell B'),tcPr:{}}]}]}}}},
          {...base('text',560,40,400,100),type:'text',noFill:true,txBody:tx('Native text')},
        ];
        const source='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j8ioAAAAASUVORK5CYII=';
        doc.assets['sample.png']=source;
        doc.slides[0].bg={bgPr:{blipFill:{blip:{$_target:'sample.png'},stretch:{fillRect:{}}}}};
        const api=SavannaVanEditor.mount(document.querySelector('[data-savanna-editor]'),{document:doc});await api.ready;await tick();
        check(!!document.querySelector('link[href^="https://fonts.googleapis.com/css?"][href*="Roboto"]'), 'document Google font loader is active');
        for(let i=0;i<100&&!document.querySelector('.ve-thumb .slide-bg image');i++)await tick();
        const thumbBackground=document.querySelector('.ve-thumb .slide-bg');
        const thumbImage=thumbBackground?.querySelector('image');
        check(!!thumbImage,'thumbnail renders the background image');
        const bgBounds=thumbBackground.getBoundingClientRect(), imageBounds=thumbImage.getBoundingClientRect();
        check(Math.abs(bgBounds.left-imageBounds.left)<1 && Math.abs(bgBounds.top-imageBounds.top)<1,
          'thumbnail background image is aligned with the slide, not offset by half its width');
        const canvas=document.querySelector('.ve-canvas #sld');
        check(canvas,'Uses shared slide renderer');
        check(canvas.querySelector('linearGradient'),'Gradient definitions are rendered');
        check(canvas.querySelector('table'),'Native table rendered');
        check(canvas.textContent.includes('Grouped text')&&canvas.textContent.includes('Cell A'),'Group and table text rendered');
        const image=canvas.querySelector('image');
        check(image&&image.getAttribute('href').startsWith('blob:'),'Packaged image loads from a scoped blob URL');
        const imageCheck=new Image(); imageCheck.src=image.getAttribute('href'); await imageCheck.decode();
        const native=canvas.querySelector('#path');
        check(native.querySelector('.in-shp').style.filter.includes('drop-shadow'),'Native effect rendering');
        // Compare the editable view with direct calls to shared ShapeView, not a second renderer.
        const props={fileInfo:doc.file,slideInfo:doc.slides[0],theme:{},baseHref:'',editable:true,hideId:true,rootFontSize:1};
        const snapshot=node=>({paths:[...node.querySelectorAll('path')].map(e=>e.getAttribute('d')),
          fills:[...node.querySelectorAll('use')].map(e=>e.getAttribute('fill')), text:node.textContent,
          gradients:[...node.querySelectorAll('stop')].map(e=>[e.getAttribute('offset'),e.getAttribute('stop-color')])});
        for(const id of ['gradient','path','group','table','text']){
          const shape=doc.slides[0].shapes.find(s=>s.id===id);
          const direct=R.ShapeView({...props,shp:structuredClone(shape)});
          const rendered=canvas.querySelector('[id="'+id+'"]');
          // Paint servers are namespaced for each slide instance in the editor.
          const normalized=value=>JSON.stringify(value).replace(/url\(#ve-render-\d+-/g,'url(#');
          check(normalized(snapshot(direct))===normalized(snapshot(rendered)),id+' matches direct shared rendering');
          direct.remove();
        }
        for(const el of canvas.querySelectorAll('[href]')){
          const href=el.getAttribute('href');if(href.startsWith('#'))check(!!canvas.querySelector('[id="'+CSS.escape(href.slice(1))+'"]'),'SVG references stay inside the slide');
        }
        const textNode=canvas.querySelector('#text');
        check(Math.abs(parseFloat(textNode.style.left)-560)<.01,'Shared coordinates use native model units');
        check(getComputedStyle(document.documentElement).fontSize==='1px','Shared editing canvas uses native rem model units');
        const resized = R.resizeShapeGeometry(doc.slides[0].shapes.find(s=>s.id==='path'),320,180);
        check(resized.w===320&&resized.h===180&&resized.d.includes('320'),'Resizing uses shared path geometry');
        const extractedDoc=(await api.getDocument()); extractedDoc.assets['sample.png']='assets/sample.png'; await api.load(extractedDoc);await tick();
        const extractedImage=document.querySelector('.ve-canvas image');
        const imageURL=extractedImage.getAttribute('href');
        check(imageURL===new URL('assets/sample.png',document.baseURI).href,'Extracted image paths resolve without an extra media prefix');
        const checkImage=new Image();checkImage.src=imageURL;await checkImage.decode();
        // Charts are supplied as SVG previews by the Vue host.
        check(!window.SavannaCharts,'Chart renderer remains optional');
        const chart={...base('chart',600,250,400,260),type:'chart',chartSvg:'<svg width="400rem" height="260rem" viewBox="0 0 400 260"><rect width="100" height="100"/></svg>',chartData:{animation:false,xAxis:{type:'category',data:['A','B']},yAxis:{type:'value'},series:[{type:'bar',data:[2,4]}]}};
        const chartDoc=(await api.getDocument());chartDoc.assets['sample.png']=source;chartDoc.slides[0].shapes.push(chart);await api.load(chartDoc);
        for(let i=0;i<200&&!document.querySelector('.ve-canvas .ssr-chart svg');i++)await new Promise(r=>setTimeout(r,20));
        check(!!document.querySelector('.ve-canvas .ssr-chart svg'),'Chart SVG preview renders without ECharts');
        const blobs=[],create=URL.createObjectURL;URL.createObjectURL=b=>{blobs.push(b);return create(b)};HTMLAnchorElement.prototype.click=()=>{};
        await api.saveZIP();
        const entries=await zipTestHelpers.readZip(blobs.at(-1));
        check(!entries.has('charts.js')&&!entries.has('renderer.js')&&entries.has('renderer.css'),'ZIP includes combined editor and renderer without charts runtime');
        api.destroy();
        check(!document.querySelector('link[href^="https://fonts.googleapis.com/css?"][href*="Roboto"]'), 'document Google font loader cleans up');
        check(getComputedStyle(document.documentElement).fontSize==='16px','Destroy restores host root font');
        const p=document.createElement('pre');p.id='result';p.textContent='PASS';document.body.append(p);
      }catch(error){const p=document.createElement('pre');p.id='result';p.textContent='FAIL: '+error.stack;document.body.append(p);}
    });</script>`;
    const source = await readFile(join(temp, 'index.html'), 'utf8');
    await writeFile(join(temp, 'fidelity.html'), source.replace('</body>', '<script>' + helper.outputFiles[0].text + '</script>' + script + '</body>'));
    const html = await runBrowserFixture(chrome, pathToFileURL(join(temp, 'fidelity.html')).href, join(temp, 'profile'));
    const result = html.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1];
    assert.equal(result, 'PASS', result || html.slice(-1000));
  } finally { await rm(temp, { recursive: true, force: true }); }
});
