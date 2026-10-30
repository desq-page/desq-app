import {runBrowserFixture} from './browser-fixture.mjs';
import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { exportNativeHTMLText } from "./html-native-export-fixture.mjs";

const chrome =
  process.env.CHROME_BIN ||
  [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/chromium",
    "/usr/bin/google-chrome",
  ].find(existsSync);
test(
  "real browser converts HTML and imported templates to native editor JSON, with atomic local repair",
  { skip: !chrome, timeout: 60000 },
  async () => {
    const directory = mkdtempSync(join(tmpdir(), "desq-html-test-"));
    try {
      copyFileSync(resolve('node_modules/pdfjs-dist/build/pdf.worker.min.mjs'),join(directory,'pdf.worker.min.mjs'));
      await build({
        stdin: {
          resolveDir: resolve("."),
          contents: `
      import * as pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs';
      globalThis.pdfjsWorker=pdfjsWorker;
      import {parseDocumentXml} from './shared-vuejs/src/edlib/docx/convert.ts';
      import {ingestSource} from './editor-vuejs/src/lib/agent/source-intake.mjs';
      import {htmlToSVG,parseSlideHTML} from './editor-vuejs/src/lib/agent/html-slides.mjs';
      import {compileDeck,deckImageRequests} from './editor-vuejs/src/lib/agent/deck-compiler.mjs';
      import {PRESENTON_TEMPLATES,PPTX_TEMPLATE_CHOICES} from './editor-vuejs/src/lib/agent/presenton-templates.mjs';
      import {ZipReader,ZipWriter,Uint8ArrayReader,Uint8ArrayWriter} from '@zip.js/zip.js';
      import {planCloudPptxTemplate} from './editor-vuejs/src/lib/agent/cloud-pptx-plan.mjs';
      import {prepareNativeTemplateDeck,mergeNativeTemplatePackage} from './editor-vuejs/src/lib/agent/native-template-deck.mjs';
      import {loadPresentonTemplate,preparePresentonContext,pptxLayoutReference} from './editor-vuejs/src/lib/agent/presenton-pptx.mjs';
      const presentonBytes = ${JSON.stringify(Object.fromEntries(JSON.parse(readFileSync('editor-vuejs/src/lib/agent/templates/manifest.json','utf8')).families.map(entry=>[entry.id,readFileSync('editor-vuejs/public/'+entry.file).toString('base64')])))};
      import {reflowLocalHTML} from './editor-vuejs/src/lib/agent/local-html-reflow.mjs';
      import {FILL_TEMPLATES,FILL_PALETTES,fillTemplateHTML,measureFilledTemplate} from './editor-vuejs/src/lib/agent/template-fill.mjs';
      import {planTemplateFill} from './editor-vuejs/src/lib/agent/local-template-fill.mjs';
      import {restoreLocalPhoto,photoDirection} from './editor-vuejs/src/lib/agent/local-html-photos.mjs';
      import {refineLocalHTML} from './editor-vuejs/src/lib/agent/local-html-quality.mjs';
      import {planLocalHTML} from './editor-vuejs/src/lib/agent/local-html.mjs';
      import {createLocalAgent} from './editor-vuejs/src/lib/agent/local-agent.mjs';
      import {planLocalDeck} from './editor-vuejs/src/lib/agent/local-deck.mjs';
      import {createEditorTools} from './editor-vuejs/src/lib/agent/editor-tools.mjs';
      import {deckLayoutPreviews} from './editor-vuejs/src/lib/agent/deck-preview.mjs';
      const check=(condition,message)=>{if(!condition)throw Error(message)};
      let sequence=0;
      const options={width:1280,height:720,genId:()=>String(++sequence),geometry:(p,w,h)=>({d:'R0,0,'+w+','+h})};
      const markup=body=>'<section style="position:relative;width:1280px;height:720px;background:#ffffff;color:#172923;font-family:Arial;font-size:24px">'+body+'</section>';
      const html=markup('<div style="position:absolute;left:64px;top:64px;width:1100px"><h1 style="font-size:48px">HTML &amp; native slides</h1><p style="width:360px;line-height:36px">Editable <strong>bold text</strong> wraps into multiple lines while preserving its content and emphasis.</p><div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:30px"><div style="background:#E6EDF2;padding:24px;border-radius:12px">First panel</div><div style="background:#087F8C;color:white;padding:24px;border-radius:12px">Second panel</div></div></div>');
      const slide={title:'HTML slides',purpose:'Explain',layout:'html',html};
      const spec={title:'HTML deck',audience:'Readers',objective:'Verify native conversion',slides:[slide]};
      const compile=html=>compileDeck({...spec,slides:[{...slide,html}]},options);
      async function run(){
        const endpoints=[80,500].map(left=>({...slide,html:markup('<div id="!!card" style="position:absolute;left:'+left+'px;top:100px;width:240px;height:100px;background:#123456;color:white">Shared card</div>')}));
        endpoints[1].motion={transition:{effect:'morph',duration:1}};
        const paired=compileDeck({...spec,slides:endpoints},options);
        for(const page of paired.pages){
          check(page.shapes.some(s=>s.name==='!!card:box'),'HTML Morph box identity lost');
          check(page.shapes.some(s=>s.name==='!!card:text'),'HTML Morph text identity lost');
        }
        const zipSource=(name,parts)=>{
          const local=[],central=[];let offset=0;
          for(const [path,content]of Object.entries(parts)){
            const filename=new TextEncoder().encode(path),data=new TextEncoder().encode(content);
            let crc=0xffffffff;for(const byte of data){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}crc=(crc^0xffffffff)>>>0;
            const header=new Uint8Array(30+filename.length),h=new DataView(header.buffer);
            h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint32(14,crc,true);h.setUint32(18,data.length,true);h.setUint32(22,data.length,true);h.setUint16(26,filename.length,true);header.set(filename,30);
            const record=new Uint8Array(46+filename.length),r=new DataView(record.buffer);
            r.setUint32(0,0x02014b50,true);r.setUint16(4,20,true);r.setUint16(6,20,true);r.setUint32(16,crc,true);r.setUint32(20,data.length,true);r.setUint32(24,data.length,true);r.setUint16(28,filename.length,true);r.setUint32(42,offset,true);record.set(filename,46);
            local.push(header,data);central.push(record);offset+=header.length+data.length;
          }
          const end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,central.length,true);e.setUint16(10,central.length,true);e.setUint32(12,central.reduce((s,a)=>s+a.length,0),true);e.setUint32(16,offset,true);
          return new File([...local,...central,end],name);
        };
        document.body.dataset.sourceStage='zip-docx';
        const word=await zipSource('evidence.docx',{'word/document.xml':'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Source document fact</w:t></w:r></w:p><w:sectPr><w:pgSz w:w="12240" w:h="15840"/></w:sectPr></w:body></w:document>'});
        document.body.dataset.sourceStage='parse-docx';
        const wordSource=await ingestSource(word,{parseDocx:(...args)=>{const parsed=new DOMParser().parseFromString(args[0],'application/xml');check(!parsed.querySelector('parsererror'),'Bad fixture XML: '+parsed.querySelector('parsererror')?.textContent+' / '+String(args[0]).slice(0,400));return parseDocumentXml(...args);}});
        check(wordSource.blocks.some(b=>b.text.includes('Source document fact')),'DOCX source parser lost text');
        check(wordSource.design.width===816,'DOCX source page geometry lost');
        document.body.dataset.sourceStage='parse-pptx';
        const pptSource=await ingestSource(await zipSource('evidence.pptx',{
          'ppt/presentation.xml':'<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst><p:sldId id="2" r:id="r2"/><p:sldId id="1" r:id="r1"/></p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/></p:presentation>',
          'ppt/_rels/presentation.xml.rels':'<Relationships><Relationship Id="r1" Target="slides/slide1.xml"/><Relationship Id="r2" Target="slides/slide2.xml"/></Relationships>',
          'ppt/slides/slide1.xml':'<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>First file</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>',
          'ppt/slides/slide2.xml':'<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>First logical slide</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>',
        }),{onProgress:message=>{document.body.dataset.sourcePart=message}});
        check(pptSource.blocks[0].text==='First logical slide','PPTX source slide order lost');
        check(pptSource.design.width===1280&&pptSource.blocks[0].evidence,'PPTX geometry/source evidence lost');
        const pdfObjects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
        const stream='BT /F1 12 Tf 72 720 Td (Full PDF source text) Tj ET';
        pdfObjects.push('<< /Length '+stream.length+' >>\\nstream\\n'+stream+'\\nendstream');
        let pdf='%PDF-1.4\\n',offsets=[0];for(const [i,object] of pdfObjects.entries()){offsets.push(pdf.length);pdf+=(i+1)+' 0 obj\\n'+object+'\\nendobj\\n';}
        const xref=pdf.length;pdf+='xref\\n0 6\\n0000000000 65535 f \\n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \\n').join('')+'trailer\\n<< /Size 6 /Root 1 0 R >>\\nstartxref\\n'+xref+'\\n%%EOF';
        document.body.dataset.sourceStage='parse-pdf';
        const pdfSource=await ingestSource(new File([pdf],'evidence.pdf'));
        check(pdfSource.blocks[0].text.includes('Full PDF source text'),'Actual PDF.js extraction lost text');
        check(pdfSource.blocks[0].evidence[0].transform.length===6,'PDF source geometry lost');
        const native=compile(html), shapes=native.pages[0].shapes;
        check(shapes.some(s=>s.txBody),'Missing editable text');
        check(shapes.some(s=>s.txBody?.p.some(p=>p.r.some(r=>r.rPr.$_b))),'Missing rich text');
        const paragraph=shapes.find(s=>s.txBody?.p.some(p=>p.r.some(r=>r.t?.includes('Editable'))));
        check(paragraph.txBody.p[0].r.map(r=>r.t||'').join('').includes('Editable bold text'),'Inline rich text split into separate paragraphs');
        check(paragraph.txBody.bodyPr.$_wrap==='none','Browser-measured rows were rewrapped');
        check(!shapes.some(s=>['html','iframe','svg','image'].includes(s.type)),'Slide was flattened or embedded');
        const text=shapes.flatMap(s=>s.txBody?.p.flatMap(p=>p.r.map(r=>r.t))||[]).join(' ');
        check(text.includes('HTML & native slides')&&text.includes('First panel')&&text.includes('Second panel'),'Text lost');
        check(deckLayoutPreviews(native,{width:1280,height:720}).length===1,'No native preview');
        const scaled=compileDeck(spec,{...options,width:960,height:540});
        check(Math.abs(scaled.pages[0].shapes.find(s=>s.txBody).x-shapes.find(s=>s.txBody).x*.75)<1,'Dimensions not scaled');
        const imageHTML=markup('<img data-query="solar panels" alt="Rooftop solar" style="position:absolute;left:80px;top:160px;width:400px;height:280px">');
        const sourcedHTML=markup('<img src="https://invalid.example/never-load.jpg" srcset="https://invalid.example/never-load-2.jpg 2x" alt="Solar panels" style="position:absolute;left:80px;top:160px;width:400px;height:280px">');
        const normalized=parseSlideHTML(sourcedHTML).querySelector('img');
        check(!normalized.hasAttribute('src')&&!normalized.hasAttribute('srcset'),'Image URLs were retained');
        check(normalized.getAttribute('data-query')==='Solar panels','Image alt was not converted to a search query');
        const sourcedRequests=deckImageRequests({...spec,slides:[{...slide,html:sourcedHTML}]});
        check(sourcedRequests.length===1&&sourcedRequests[0].image.query==='Solar panels','Normalized image did not reach resolver');
        const sourced=compile(sourcedHTML);
        check(sourced.pages[0].shapes.some(s=>s.imagePlaceholder),'Described image src blocked native insertion');
        let missingDescription=false;
        try{parseSlideHTML(markup('<img src="https://invalid.example/no-description.jpg">'));}catch{missingDescription=true;}
        check(missingDescription,'Undescribed image URL was accepted');
        const images=deckImageRequests({...spec,slides:[{...slide,html:imageHTML}]});
        check(images.length===1 && images[0].key==='0:svg:0','Image resolver contract broken');
        const placeholder=compileDeck({...spec,slides:[{...slide,html:imageHTML}]},{...options,assets:new Map([[images[0].key,{placeholder:true,description:'solar panels'}]])});
        check(placeholder.pages[0].shapes.some(s=>s.imagePlaceholder),'Missing editable image placeholder');
        const shadowHTML=markup('<div style="position:absolute;left:100px;top:160px;width:400px;height:240px;background:white;border-radius:16px;box-shadow:0 8px 20px rgba(0,0,0,.2)">Editable shadow card</div>');
        const shadowDeck=compile(shadowHTML);
        check(shadowDeck.pages[0].shapes.some(s=>s.effectLst?.outerShdw),'CSS box shadow did not become a native shadow');
        check(shadowDeck.pages[0].shapes.some(s=>s.txBody),'Shadow card lost editable text');
        const layered=compile(shadowHTML.replace('0 8px 20px rgba(0,0,0,.2)','0 12px 24px -4px rgba(0,0,0,.2), 0 4px 6px rgba(0,0,0,.1), inset 0 1px 2px black'));
        check(layered.pages[0].shapes.some(s=>s.effectLst?.outerShdw),'Layered shadow prevented native conversion');
        check(layered.warnings.some(w=>w.includes('first outer shadow')) && layered.warnings.some(w=>w.includes('spread')) && layered.warnings.some(w=>w.includes('inset')),'Shadow approximation warnings missing');
        const pseudoHTML=markup('<style>.pseudo-card::before{content:"01";position:absolute;left:16px;top:16px;width:48px;height:48px;border-radius:50%;background:#087F8C;color:white;font-size:24px}.pseudo-card::after{content:attr(data-label);position:absolute;left:80px;top:24px;color:#172923;font-size:24px}.empty::before{content:"";display:block;position:absolute;left:0;top:0;width:8px;height:200px;background:#087F8C}</style><div class="pseudo-card" data-label="Generated label" style="position:absolute;left:100px;top:100px;width:500px;height:240px;background:#E6EDF2"><p style="position:absolute;left:24px;top:100px">Real content</p></div><div class="empty" style="position:absolute;left:700px;top:100px;width:200px;height:200px"></div>');
        const pseudoDeck=compile(pseudoHTML);
        const pseudoText=pseudoDeck.pages[0].shapes.flatMap(s=>s.txBody?.p.flatMap(p=>p.r.map(r=>r.t||''))||[]).join(' ');
        check(pseudoText.includes('01') && pseudoText.includes('Generated label') && pseudoText.includes('Real content'),'Generated content did not become editable native text');
        check(pseudoDeck.pages[0].shapes.some(s=>Math.abs(s.w-8)<1 && Math.abs(s.h-200)<1),'Empty decorative pseudo-element was lost');
        check(!document.querySelector('iframe'),'Pseudo-element conversion leaked a frame');
        const decorativeHTML=markup('<div style="position:absolute;left:100px;top:100px;width:420px;height:200px;padding:24px;background:linear-gradient(90deg,#ffffff,#e6edf2);border-left:8px solid #087F8C;border-bottom:3px dashed #334455;border-top-right-radius:24px;filter:blur(1px);transform:rotate(2deg);z-index:5;text-shadow:0 1px 2px black"><p style="text-transform:uppercase">Keep this content</p></div>');
        const decorative=compile(decorativeHTML);
        const decorativeText=decorative.pages[0].shapes.flatMap(s=>s.txBody?.p.flatMap(p=>p.r.map(r=>r.t||''))||[]).join(' ');
        check(decorativeText.includes('KEEP THIS CONTENT'),'Visual approximations lost text');
        for(const feature of ['Nonuniform HTML borders','filter','transform','backgroundImage','corner radii']) check(decorative.warnings.some(w=>w.includes(feature)),'Missing logged warning for '+feature);
        check(decorative.pages[0].shapes.filter(s=>s.ln?.solidFill).length>=2,'Separate border edges were not retained');
        const secondSlide=compileDeck({...spec,slides:[{...slide,html:decorativeHTML},slide]},options);
        check(secondSlide.pages.length===2,'Visual warning prevented later page insertion');
        const malicious=[markup('<script>parent.hacked=true</script>'),markup('<img src="https://example.com/a.png">'),markup('<div onclick="parent.hacked=true">x</div>'),markup('<style>@import "https://example.com/x.css";</style>'),markup('<div style="background-image:url(https://example.com/a.png)">x</div>'),markup('<iframe></iframe>'),markup('<div style="position:absolute;left:1250px;width:100px;height:50px">overflow</div>'),markup('<div style="width:100px;height:10px;overflow:hidden">Clipped text must fail</div>')];
        for(const bad of malicious){let threw=false;try{htmlToSVG(bad)}catch{threw=true}check(threw,'Unsafe or unsupported HTML accepted');}
        check(!globalThis.hacked && !document.querySelector('iframe'),'Isolated frame leaked');
        const layouts=[];
        document.body.dataset.sourceStage='parse-presenton-pptx';
        let presentonFetches=0;
        const parsedTemplates=await preparePresentonContext('presenton-auto',{fetchImpl:async url=>{
          presentonFetches++;
          const family=PRESENTON_TEMPLATES.find(t=>url.endsWith(t.pptx));
          return new Response(Uint8Array.from(atob(presentonBytes[family.id]),c=>c.charCodeAt(0)));
        }});
        check(parsedTemplates.families.length===1&&parsedTemplates.families.reduce((n,t)=>n+t.layouts.length,0)===12,'Not every Presenton PPTX parsed');
        check(presentonFetches===1,'Each family must load once');
        for(const family of PRESENTON_TEMPLATES){
          const parsed=await loadPresentonTemplate(family.id,{fetchImpl:()=>new Response(Uint8Array.from(atob(presentonBytes[family.id]),c=>c.charCodeAt(0)))});
          check(parsed.layouts.length===family.layouts.length,'PPTX slide count differs from original');
          for(const layout of parsed.layouts){
            check(layout.objects.length>0,'PPTX template has no editable objects');
            check(layout.objects.some(o=>o.kind==='text'),'PPTX template text missing');
            check(layout.slots.filter(s=>['text','text-list','image'].includes(s.kind)).every(s=>layout.objects.some(o=>o.name===s.name)),'Editable field names did not survive PPTX export');
            check(layout.objects.every(o=>[o.x,o.y,o.width,o.height].every(Number.isFinite)),'PPTX template geometry invalid');
            const reference=pptxLayoutReference(family.id,layout.id);
            check(reference.objects.length>0&&!JSON.stringify(reference).includes('sampleText'),'PPTX geometry or sample isolation failed');
            layouts.push({id:family.id+':'+layout.id,objects:layout.objects.length});
          }
        }
        const context={slideAuthoring:'html',htmlTemplate:'freeform',authoringEffort:'quick',document:{fileId:'file',width:1280,height:720},page:{pageId:'page',shapes:[],shapeCount:0}};
        let attempts=0, storyAttempts=0, receivedReference=false;
        const plan=await planLocalDeck({command:'Create one slide about HTML',tools:createEditorTools({}).listTools(),context,generate:async messages=>{const data=JSON.parse(messages[1].content);if(!data.slideNumber && ++storyAttempts===1) return {text:JSON.stringify({message:'a helpful answer explaining local mode creates new slides only',calls:[]})};if(data.slideNumber){receivedReference ||= !!data.templateReference;return {text:++attempts===1?'<section>':html};}return {text:JSON.stringify({...spec,strategy:{thesis:'Native HTML',narrative:'Explain',visualStyle:'Quiet'},design:{fontFamily:'Arial'},slides:[{title:'HTML',purpose:'Explain',takeaway:'Editable',visualConcept:{layout:'Grid',hierarchy:['Heading','Two panels']},content:'Text',templateLayout:'title_slide'}]})};}});
        check(storyAttempts===2 && attempts===2 && !receivedReference && plan.metrics.repaired && plan.metrics.workflow==='html-local-quick','Freeform HTML repair path failed');
        check(plan.calls[0].arguments.slides[0].layout==='html','Local mode did not return HTML');
        check(plan.calls[0].arguments.slides[0].visualConcept==='Grid; Heading; Two panels','Structured composition metadata was not normalized');
        const flowOverflow=markup('<h1 style="height:120px;font-size:48px">Keep the slide readable</h1><div style="height:549px;margin-top:120px"><p style="font-size:24px">All of this content must survive fitting.</p></div>');
        const fitted=refineLocalHTML(flowOverflow);
        check(fitted.adjustments.some(item=>item.includes('789px')) && fitted.html.includes('All of this content') && fitted.html.includes('font-size:48px'),'789px vertical overflow was not fitted without text/font loss');
        check(compile(fitted.html).pages[0].shapes.some(s=>s.txBody),'Fitted overflow did not convert to native objects');
        const panelOverflow=markup('<h1 style="position:absolute;left:64px;top:50px;font-size:48px">A concise title</h1><div style="position:absolute;left:64px;top:180px;width:1000px;height:609px;overflow:hidden;background:#e6edf2"><p style="font-size:24px">Keep this panel content</p></div>');
        const fittedPanel=refineLocalHTML(panelOverflow);
        check(fittedPanel.adjustments.some(item=>item.includes('789px')) && fittedPanel.html.includes('Keep this panel content'),'Empty oversized panel was not safely fitted');
        let tooDense=false;
        try{refineLocalHTML(markup('<h1 style="font-size:48px">Dense content</h1><div style="height:1100px">Do not silently clip me</div>'));}catch{tooDense=true;}
        check(tooDense,'Severe overflow was silently accepted');
        const contrast=refineLocalHTML(markup('<h1 style="position:absolute;left:64px;top:64px;font-size:48px;color:#eeeeee">Readable title</h1><p style="position:absolute;left:64px;top:190px;font-size:26px;color:#fefefe">Readable body</p>'));
        check(contrast.adjustments.length>=2 && !contrast.issues.length && contrast.html.includes('important'),'Local contrast correction failed');
        const collision=refineLocalHTML(markup('<h1 style="position:absolute;left:64px;top:64px;font-size:48px">A clear title</h1><p style="position:absolute;left:64px;top:200px;font-size:24px;line-height:28px">First line</p><p style="position:absolute;left:64px;top:218px;font-size:24px;line-height:28px">Second line</p>'));
        check(collision.adjustments.some(item=>item.includes('spacing')) && !collision.issues.length,'Small absolute text collision was not corrected');
        const crowded=refineLocalHTML(markup('<h1 style="position:absolute;left:64px;top:64px;font-size:48px">A clear title</h1><p style="position:absolute;left:64px;top:200px;font-size:24px;line-height:28px">First line</p><p style="position:absolute;left:64px;top:200px;font-size:24px;line-height:28px">Overlapping line</p>'));
        check(crowded.issues.some(item=>item.includes('collision')),'Large collision did not request targeted repair');
        let directAttempts=0, directPreviews=0;
        const direct=await planLocalHTML({command:'Create two slides',tools:createEditorTools({}).listTools(),context:{...context,slideTask:{mode:'create',count:2}},onPreview:()=>directPreviews++,generate:async messages=>JSON.parse(messages[1].content).slideCount?{text:'Theme: Native clarity\\nPalette: ocean\\nSlide 1: HTML and native slides | comparison\\nSlide 2: Editable content | grid'}:({text:++directAttempts===1?'<section>':html})});
        check(directAttempts===3 && directPreviews===1 && direct.metrics.repaired && direct.calls[0].arguments.slides.length===2,'Direct HTML repair or atomic preview failed');
        let qualityCalls=0, qualityCorrection='';
        const badLayout=markup('<p style="position:absolute;left:64px;top:200px;font-size:24px">No heading</p>');
        const qualityPlan=await planLocalHTML({command:'Create one slide',tools:createEditorTools({}).listTools(),context:{...context,htmlTemplate:'freeform',authoringEffort:'detailed'},generate:async messages=>{
          const data=JSON.parse(messages[1].content);
          if(data.slideCount)return {text:'Theme: Calm\\nPalette: ocean\\nSlide 1: Clear title | editorial'};
          qualityCalls++;qualityCorrection=data.correction||'';return {text:qualityCalls===1?badLayout:html};
        }});
        check(qualityCalls===2 && qualityCorrection.includes('title') && qualityPlan.metrics.repairCalls===1,'Detailed did not target the actual layout finding');
        let overflowCalls=0, overflowCorrection='';
        const overflowPlan=await planLocalHTML({command:'Create one slide',tools:createEditorTools({}).listTools(),context,generate:async messages=>{
          const data=JSON.parse(messages[1].content);
          if(data.slideCount)return {text:'Theme: Calm\\nPalette: ocean\\nSlide 1: Clear title | editorial'};
          overflowCalls++;overflowCorrection=data.correction||'';
          return {text:overflowCalls===1?markup('<h1 style="font-size:48px">Too dense</h1><div style="height:1100px">Preserve the facts</div>'):flowOverflow};
        }});
        const simpleReflow=reflowLocalHTML(markup('<h1 style="font-size:48px">Too dense</h1><div style="height:1100px">Preserve the facts</div>'),{title:'Dense',design:{background:'#ffffff',foreground:'#172923',accent:'#087f8c'}});
        check(simpleReflow.html.includes('Preserve the facts'),'Plain text wrapper was lost during reflow');
        check(overflowCalls===1 && overflowPlan.metrics.reflowedSlides===1 && overflowPlan.calls[0].arguments.slides.length===1,'Host reflow added an unnecessary model call or changed slide count: '+JSON.stringify({overflowCalls,overflowCorrection,metrics:overflowPlan.metrics}));
        const veryTall=markup('<h1 style="height:160px;font-size:48px">Tall layout, concise content</h1><div style="height:1114px"><h2 style="font-size:28px">A meaningful section</h2><p style="font-size:24px">Keep <strong>every fact</strong> and all inline emphasis.</p><ul><li>First useful point</li><li>Second useful point</li></ul><table><tr><th>Metric</th><th>Value</th></tr><tr><td>Count</td><td>42</td></tr></table><img data-query="solar panels" alt="Rooftop solar panels" style="width:400px;height:180px"><svg viewBox="0 0 200 100" style="width:200px;height:100px"><rect width="200" height="100" fill="#087f8c"/><text x="20" y="55" font-size="24" fill="#ffffff">Native diagram</text></svg></div>');
        const reflowed=reflowLocalHTML(veryTall,{title:'Fallback',design:{background:'#ffffff',foreground:'#172923',accent:'#087f8c'}});
        const reflowNative=compile(reflowed.html);
        const reflowText=reflowNative.pages[0].shapes.flatMap(s=>s.txBody?.p.flatMap(p=>p.r.map(r=>r.t||''))||[]).join(' ');
        for(const value of ['Tall layout','every fact','First useful point','Second useful point','Metric','42','Native diagram'])check(reflowText.includes(value),'Reflow lost content: '+value);
        check(reflowed.html.includes('<strong>') && reflowed.html.includes('data-query="solar panels"') && reflowed.html.includes('<svg'),'Reflow lost emphasis, image or SVG');
        check(deckImageRequests({...spec,slides:[{...slide,html:reflowed.html}]}).length===1,'Reflow lost image resolver integration');
        const numbered=markup('<h1 style="font-size:48px">A numbered sequence</h1><ol start="7" style="height:1200px">'+Array.from({length:15},(_,i)=>'<li>Retain numbered item '+i+'</li>').join('')+'</ol>');
        const numberedFlow=reflowLocalHTML(numbered,{title:'Sequence',design:{background:'#ffffff',foreground:'#172923',accent:'#087f8c'}});
        const numberedText=compile(numberedFlow.html).pages[0].shapes.flatMap(s=>s.txBody?.p.flatMap(p=>p.r.map(r=>r.t||''))||[]).join(' ');
        check(numberedText.includes('7.') && numberedText.includes('21.') && numberedText.includes('Retain numbered item 14'),'Reflow lost ordered numbering or list content');
        const richLong=markup('<h1 style="font-size:48px">A long rich paragraph</h1><p style="height:1200px"><strong>'+Array.from({length:140},(_,i)=>'detail'+i).join(' ')+'</strong></p>');
        const richFlow=reflowLocalHTML(richLong,{title:'Rich text',design:{background:'#ffffff',foreground:'#172923',accent:'#087f8c'}});
        check(!richFlow.overflowContent && richFlow.html.includes('<strong>'),'Long rich paragraph was unnecessarily excerpted or lost emphasis');
        const richText=compile(richFlow.html).pages[0].shapes.flatMap(s=>s.txBody?.p.flatMap(p=>p.r.map(r=>r.t||''))||[]).join(' ');
        for(let i=0;i<140;i++)check(richText.includes('detail'+i),'Paragraph split lost word '+i);
        const denseText=Array.from({length:1200},(_,i)=>'fact'+i).join(' ');
        const denseSource=markup('<h1 style="font-size:48px">Too much content</h1><p style="height:5000px">'+denseText+'</p>');
        const denseFlow=reflowLocalHTML(denseSource,{title:'Dense',design:{background:'#ffffff',foreground:'#172923',accent:'#087f8c'}});
        check(denseFlow.overflowContent?.text.includes('fact1199') && denseFlow.overflowContent.html===denseSource,'True density fallback discarded original source');
        check(denseFlow.html.includes('Content excerpt'),'Dense content excerpt was not visibly labelled');
        const savedDense=compileDeck({...spec,slides:[{...slide,html:denseFlow.html,overflowContent:denseFlow.overflowContent}]},options);
        check(savedDense.pages[0].agentMetadata.overflowContent.text.includes('fact1199'),'Full source did not survive native compilation');
        let densePageCalls=0;
        const denseDeck=await planLocalHTML({command:'Create two slides',tools:createEditorTools({}).listTools(),context:{...context,slideTask:{mode:'create',count:2}},generate:async messages=>{
          const data=JSON.parse(messages[1].content);
          if(data.slideCount)return {text:'Theme: Calm\\nPalette: ocean\\nSlide 1: Fits well | editorial\\nSlide 2: Dense details | grid'};
          densePageCalls++;return {text:data.slideNumber===1?html:denseSource};
        }});
        check(densePageCalls===2 && denseDeck.calls[0].arguments.slides.length===2 && denseDeck.calls[0].arguments.slides[1].overflowContent.text.includes('fact1199'),'A dense second slide blocked the deck, added inference, or lost its source');
        let rejectedUnsafe=false;try{reflowLocalHTML(markup('<script>parent.hacked=true</script><p>Unsafe</p>'),{title:'Unsafe',design:{background:'#ffffff',foreground:'#172923',accent:'#087f8c'}});}catch{rejectedUnsafe=true;}
        check(rejectedUnsafe && !globalThis.hacked,'Reflow bypassed markup safety');
        let stopped=false, stoppedPreview=false, rejectedStop=false;
        try{await planLocalHTML({command:'Create one slide',tools:createEditorTools({}).listTools(),context,isStopped:()=>stopped,onPreview:()=>stoppedPreview=true,generate:async()=>{stopped=true;return {text:html}}});}catch(error){rejectedStop=error.message.includes('stopped');}
        check(rejectedStop && !stoppedPreview,'Direct HTML ignored cancellation');
        const fillTextSchema=schema=>{
          if(schema.type==='string')return 'Facts';
          if(schema.type==='array')return [fillTextSchema(schema.items)];
          if(schema.type==='object'){const result={};for(const [name,child]of Object.entries(schema.properties)){
            if(child.type==='object'&&('query' in child.properties||'categories' in child.properties||'rows' in child.properties))continue;
            result[name]=fillTextSchema(child);
          }return result;}
          return 1;
        };
        const autoRequests=[];let autoLayout;
        const autoPlan=await planLocalHTML({command:'Create one slide about a launch',tools:createEditorTools({}).listTools(),context:{...context,htmlTemplate:'presenton-auto'},generate:async messages=>{
          const data=JSON.parse(messages[1].content);autoRequests.push(data);
          if(data.slideCount)return {text:'Template: builtin-ocean\\nOfficeColors: blue\\nTheme: Bold launch\\nSlide 1: A useful launch plan | process'};
          autoLayout=data.layouts[0].id;
          return {text:JSON.stringify({layoutId:autoLayout,content:fillTextSchema(data.layouts[0].schema)})+' Completed. <end_of_turn>'};
        }});
        check(autoRequests[0].officeColorSchemes.length===24&&autoPlan.calls[0].arguments.colorScheme==='blue','Office color collection was not supplied or its choice was lost');
        check(autoRequests.length===2&&autoPlan.calls[0].arguments.slides[0].layout==='pptx','Presenton must fill native PPTX placeholders, never author HTML');
        check(autoPlan.calls[0].arguments.slides[0].templateSelection.family==='builtin-ocean','Native deck changed its chosen family');
        const nativePrepared=await prepareNativeTemplateDeck(autoPlan.calls[0].arguments,{genId:()=> 'nativeFixture',resolveImage:async()=>({placeholder:true})});
        const nativeSlide=new DOMParser().parseFromString(new TextDecoder().decode(nativePrepared.parts[nativePrepared.sources[0].path]),'application/xml');
        const ns='http://schemas.openxmlformats.org/presentationml/2006/main';
        check(nativeSlide.getElementsByTagNameNS(ns,'ph').length>0,'Native slide lost placeholders');
        check(nativeSlide.documentElement.getAttribute('showMasterSp')==='1','Native slide hides its master');
        check(nativeSlide.documentElement.textContent.includes('Facts'),'Native placeholder content was not filled');
        check(!nativeSlide.getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/main','xfrm').length,'Text-only native slide flattened layout geometry');
        const masterPaths=Object.keys(nativePrepared.parts).filter(path=>path.startsWith('ppt/slideMasters/')&&path.endsWith('.xml')&&!path.slice(17).includes('/'));
        check(masterPaths.length===1,'The family master must be shared across the generated deck');
        const builtinPlan=await planLocalHTML({command:'Create one slide about a launch',tools:createEditorTools({}).listTools(),context:{...context,htmlTemplate:'builtin-ocean'},generate:async messages=>{
          const data=JSON.parse(messages[1].content);
          if(data.slideCount)return {text:'Theme: Launch\\nSlide 1: Launch steps | process'};
          return {text:JSON.stringify({layoutId:data.layouts[0].id,content:fillTextSchema(data.layouts[0].schema)})};
        }});
        check(builtinPlan.calls[0].arguments.slides[0].templateSelection.family==='builtin-ocean','Built-in template escaped the common native planner');
        const builtin=await loadPresentonTemplate('builtin-ocean');
        const builtinPrepared=await prepareNativeTemplateDeck({slides:builtin.layouts.map(l=>({title:'Facts',layout:'pptx',templateSelection:{family:'builtin-ocean',layout:l.id},templateFields:l.slots.filter(f=>f.kind==='text').map(f=>({id:f.placeholderId,text:'Facts'}))}))},{genId:()=> 'builtinFixture'});
        check(builtinPrepared.sources.length===12,'Built-in native layouts were lost');
        for(const source of builtinPrepared.sources){const xml=new TextDecoder().decode(builtinPrepared.parts[source.path]);check(xml.includes('Facts')&&xml.includes('idx="0"')&&!xml.includes('Supporting detail'),'Built-in placeholder fill failed');}
        for(const [theme,accent]of [['blue','0F6FC6'],['green-yellow','99CB38']]){
          const themed=await prepareNativeTemplateDeck({colorScheme:theme,slides:[{title:'Facts',layout:'pptx',templateSelection:{family:'builtin-ocean',layout:'cover'},templateFields:[{id:'0',text:'Facts'}]}]},{genId:()=> 'theme'+theme.replaceAll('-','')});
          const layoutXML=new TextDecoder().decode(themed.parts['ppt/slideLayouts/'+themed.sources[0].layoutid+'.xml']);
          const themePart=Object.keys(themed.parts).find(p=>p.startsWith('ppt/theme/')&&p.endsWith('.xml'));
          check(layoutXML.includes('schemeClr')&&!layoutXML.includes('srgbClr'),'Artwork is not linked to native theme colors');
          check(new TextDecoder().decode(themed.parts[themePart]).includes(accent),'The selected Office palette was not applied');
          const masterRels=Object.keys(themed.parts).find(p=>p.startsWith('ppt/slideMasters/_rels/')&&p.endsWith('.rels'));
          const relDoc=new DOMParser().parseFromString(new TextDecoder().decode(themed.parts[masterRels]),'application/xml');
          const themeRel=Array.from(relDoc.documentElement.children).find(n=>n.getAttribute('Type').endsWith('/theme'));
          const activeTheme=themeRel.getAttribute('Target').slice(1);
          check(activeTheme.startsWith('ppt/theme/')&&new TextDecoder().decode(themed.parts[activeTheme]).includes(accent),'The master uses an unregistered or unchanged nested theme');
          check(themed.sources[0].selection.theme===theme&&layoutXML.includes('idx="0"'),'Office scheme lost placeholder identity');
        }
        const nativeSizeSpec={slides:[{title:'Resized',layout:'pptx',templateSelection:{family:'builtin-ocean',layout:'cover'},templateFields:[{id:'0',text:'Facts'}]}]};
        for(const targetSize of [{width:960,height:540},{width:1024,height:768}]){
          const resized=await prepareNativeTemplateDeck(nativeSizeSpec,{genId:()=> 'size'+targetSize.width,targetSize});
          const layoutXML=new DOMParser().parseFromString(new TextDecoder().decode(resized.parts['ppt/slideLayouts/'+resized.sources[0].layoutid+'.xml']),'application/xml');
          const titlePH=Array.from(layoutXML.getElementsByTagNameNS(ns,'ph')).find(ph=>ph.getAttribute('idx')==='0');
          const titleShape=titlePH.parentNode.parentNode.parentNode;
          const a='http://schemas.openxmlformats.org/drawingml/2006/main',off=titleShape.getElementsByTagNameNS(a,'off')[0],ext=Array.from(titleShape.getElementsByTagNameNS(a,'ext')).find(n=>n.hasAttribute('cx'));
          const scale=Math.min(targetSize.width/1280,targetSize.height/720),dy=(targetSize.height-720*scale)/2;
          check(Number(off.getAttribute('x'))===Math.round(64*scale*9525),'Resized placeholder x geometry failed');
          check(Number(off.getAttribute('y'))===Math.round((152*scale+dy)*9525),'Resized placeholder vertical centring failed');
          check(Number(ext.getAttribute('cx'))===Math.round(720*scale*9525),'Resized placeholder width failed');
          const resizedSlide=new DOMParser().parseFromString(new TextDecoder().decode(resized.parts[resized.sources[0].path]),'application/xml');
          check(resizedSlide.getElementsByTagNameNS(ns,'ph').length>0&&!resizedSlide.getElementsByTagNameNS(a,'xfrm').length,'Resizing flattened inherited placeholders');
          const originalLayout=new DOMParser().parseFromString(new TextDecoder().decode(builtinPrepared.parts['ppt/slideLayouts/'+builtinPrepared.sources[0].layoutid+'.xml']),'application/xml');
          const fonts=Array.from(originalLayout.getElementsByTagNameNS(a,'defRPr')).filter(n=>n.hasAttribute('sz'));
          const scaledFonts=Array.from(layoutXML.getElementsByTagNameNS(a,'defRPr')).filter(n=>n.hasAttribute('sz'));
          check(fonts.length>0&&fonts.every((f,i)=>Number(scaledFonts[i].getAttribute('sz'))===Math.round(Number(f.getAttribute('sz'))*scale)),'Resizing lost proportional text sizes');
        }
        const longTitle='A complete title with important source details '.repeat(30);
        const fittedBuiltin=await prepareNativeTemplateDeck({slides:[{title:'Long source title',layout:'pptx',templateSelection:{family:'builtin-ocean',layout:'cover'},templateFields:[{id:'0',text:longTitle}]}]},{genId:()=> 'overflowFixture'});
        const fittedXML=new TextDecoder().decode(fittedBuiltin.parts[fittedBuiltin.sources[0].path]);
        check(fittedBuiltin.sources[0].overflowContent?.text===longTitle,'Native overflow discarded full source text');
        check(!fittedXML.includes('…')&&fittedXML.includes(longTitle),'Native overflow did not retain the full original content');
        check(fittedBuiltin.warnings.length>0,'Native excerpt was not reported');
        let nativeRewriteCalls=0;
        const rewriteSpec={slides:[{title:'Rephrase',layout:'pptx',templateSelection:{family:'builtin-ocean',layout:'cover'},templateFields:[{id:'0',text:longTitle}]}]};
        const rephrased=await prepareNativeTemplateDeck(rewriteSpec,{genId:()=> 'rewriteFixture',rewriteText:async()=>{nativeRewriteCalls++;return 'Source details';}});
        const rewriteXML=new TextDecoder().decode(rephrased.parts[rephrased.sources[0].path]);
        check(nativeRewriteCalls===1&&rewriteXML.includes('Source details')&&!rewriteXML.includes(longTitle),'Native insertion did not use the concise rewrite');
        const failedRewrite=await prepareNativeTemplateDeck(rewriteSpec,{genId:()=> 'rewriteFailureFixture',rewriteText:async()=>longTitle});
        check(new TextDecoder().decode(failedRewrite.parts[failedRewrite.sources[0].path]).includes(longTitle),'An unfitting rewrite discarded the full original text');
        const budgetPhotoLayout=builtin.layouts.find(l=>l.id==='photo-story');
        const budgetPhotoSlot=budgetPhotoLayout.slots.find(s=>s.kind==='image');
        let budgetResolves=0;
        const budgetDeck=await prepareNativeTemplateDeck({slides:Array.from({length:10},(_,i)=>({title:'Photo '+i,layout:'pptx',templateSelection:{family:'builtin-ocean',layout:'photo-story'},templateFields:[{id:'0',text:'Facts'},{id:budgetPhotoSlot.placeholderId,image:{query:'Source photo '+i,alt:'Retained photo '+i}}]}))},{genId:()=> 'budgetFixture',resolveImage:async()=>{budgetResolves++;return {placeholder:true};}});
        check(budgetResolves===8&&budgetDeck.sources.length===10,'Image budget rejected the deck or resolved too many images');
        check(new TextDecoder().decode(budgetDeck.parts[budgetDeck.sources[9].path]).includes('Retained photo 9'),'Image budget discarded the last described placeholder');
        const archiveReader=new ZipReader(new Uint8ArrayReader(Uint8Array.from(atob(presentonBytes['builtin-ocean']),c=>c.charCodeAt(0))),{useWebWorkers:false}),nativeArchive={};
        for(const entry of await archiveReader.getEntries())if(!entry.directory)nativeArchive[entry.filename]=await entry.getData(new Uint8ArrayWriter(),{useWebWorkers:false,useCompressionStream:false});
        await archiveReader.close();
        const merged=mergeNativeTemplatePackage(nativePrepared,nativeArchive),nativePackage={...nativeArchive,...merged};
        const pres=new DOMParser().parseFromString(new TextDecoder().decode(nativePackage['ppt/presentation.xml']),'application/xml');
        const sldList=pres.getElementsByTagNameNS(ns,'sldIdLst')[0];while(sldList.firstChild)sldList.removeChild(sldList.firstChild);
        const presRels=new DOMParser().parseFromString(new TextDecoder().decode(nativePackage['ppt/_rels/presentation.xml.rels']),'application/xml');
        const rns='http://schemas.openxmlformats.org/officeDocument/2006/relationships',rpackage='http://schemas.openxmlformats.org/package/2006/relationships';
        for(const [i,source]of nativePrepared.sources.entries()){
          const rel=presRels.createElementNS(rpackage,'Relationship');rel.setAttribute('Id','rIdNativeTest'+i);rel.setAttribute('Type',rns+'/slide');rel.setAttribute('Target','/'+source.path);presRels.documentElement.appendChild(rel);
          const sld=pres.createElementNS(ns,'p:sldId');sld.setAttribute('id',String(256+i));sld.setAttributeNS(rns,'r:id','rIdNativeTest'+i);sldList.appendChild(sld);
        }
        nativePackage['ppt/presentation.xml']=new TextEncoder().encode(new XMLSerializer().serializeToString(pres));nativePackage['ppt/_rels/presentation.xml.rels']=new TextEncoder().encode(new XMLSerializer().serializeToString(presRels));
        const nativeWriter=new ZipWriter(new Uint8ArrayWriter(),{useWebWorkers:false});for(const [path,bytes]of Object.entries(nativePackage))await nativeWriter.add(path,new Uint8ArrayReader(bytes));
        const nativeBytes=await nativeWriter.close();let binary='';for(let i=0;i<nativeBytes.length;i+=8192)binary+=String.fromCharCode(...nativeBytes.subarray(i,i+8192));const nativeDeckBase64=btoa(binary);
        const photoLayout={photoSlots:[{field:'image',box:[640,100,560,500]}]};
        check(photoLayout.photoSlots.length>0,'Cover photo slot was not imported');
        const restoredPhoto=restoreLocalPhoto(html,{request:'Create a slide about this topic: Solar energy',title:'Solar power',layout:photoLayout,budget:1,design:{background:'#ffffff',foreground:'#172923',accent:'#087f8c'}});
        check(restoredPhoto.photoRestored && restoredPhoto.html.includes('data-query="Solar energy"'),'Missing template photo was not restored as a real query');
        check(deckImageRequests({...spec,slides:[{...slide,html:restoredPhoto.html}]}).length===1,'Restored photo did not enter the image resolver');
        const photoNative=compileDeck({...spec,slides:[{...slide,html:restoredPhoto.html}]},{...options,assets:new Map([['0:svg:0',{placeholder:true,description:'Solar energy'}]])});
        check(photoNative.pages[0].shapes.some(s=>s.imagePlaceholder),'Missing image fallback did not remain editable');
        check(!restoreLocalPhoto(imageHTML,{request:'Solar energy',title:'Solar',layout:photoLayout,budget:1,design:{background:'#ffffff',foreground:'#172923',accent:'#087f8c'}}),'Model-authored photo was duplicated');
        check(!photoDirection('Use text-only slides','Solar',photoLayout,1) && !photoDirection('Solar','Solar',photoLayout,0),'Text-only choice or image budget was ignored');
        const sampleFill=(id,paletteId='ocean')=>({templateId:id,paletteId,title:'Clean energy, clear choices',kicker:'A practical guide',subtitle:'Choose the right approach using real evidence and a clear plan.',items:Array.from({length:FILL_TEMPLATES.find(t=>t.id===id).items},(_,i)=>({label:['Assess','Compare','Choose','Act'][i],text:'Use real facts to decide the next action.',value:'42'})),imageQuery:'solar panels',imageAlt:'Rooftop solar panels'});
        for(const template of FILL_TEMPLATES)for(const palette of Object.keys(FILL_PALETTES)){
          const filled=measureFilledTemplate(fillTemplateHTML(sampleFill(template.id,palette)));
          check(!filled.overflows.length,'Sample overflows '+template.id+'/'+palette);
          const native=compileDeck({...spec,design:{...FILL_PALETTES[palette],fontFamily:'Arial'},slides:[{...slide,html:filled.html}]},options);
          check(native.pages[0].shapes.some(s=>s.txBody),'Fill lost editable text');
          check(deckImageRequests({...spec,slides:[{...slide,html:filled.html}]}).length===(template.photo?1:0),'Fill photo slot lost');
        }
        let fillCalls=0;
        const filledPlan=await planTemplateFill({command:'Create two slides about solar power',tools:createEditorTools({}).listTools(),context:{...context,localDesignMode:'template-fill',slideTask:{mode:'create',count:2}},generate:async messages=>{
          const data=JSON.parse(messages[1].content);fillCalls++;check(!messages[0].content.includes('Return ONLY one complete <section'),'Fill requested HTML');return {text:JSON.stringify(sampleFill(data.slideNumber===1?'photo-story':'comparison'))};
        }});
        check(fillCalls===2 && filledPlan.metrics.workflow==='template-fill' && filledPlan.calls[0].arguments.slides.length===2,'Clean fixed templates added planning/review inference');
        const localized=await planTemplateFill({command:'制作一页关于太阳能的幻灯片',tools:createEditorTools({}).listTools(),context,generate:async messages=>{
          check(messages[0].content.includes('same language as the user') && messages[0].content.includes('unless the user explicitly requests another language'),'Topic language instruction missing');
          return {text:JSON.stringify({...sampleFill('photo-left'),title:'太阳能的未来',kicker:'清洁能源',subtitle:'太阳能电池板将阳光转化为电力。',imageAlt:'屋顶太阳能电池板'})};
        }});
        check(localized.calls[0].arguments.slides[0].html.includes('太阳能的未来'),'Localized content lost in template filling');
        let closingCalls=0;
        const closingDeck=await planTemplateFill({command:'Create five slides with a closing slide',tools:createEditorTools({}).listTools(),context:{...context,slideTask:{mode:'create',count:5}},generate:async messages=>{
          closingCalls++;const request=JSON.parse(messages[1].content);
          const content=sampleFill(request.slideNumber===5?'closing':'photo-story');
          if(request.slideNumber===5)content.items=[{label:'Act',text:'Choose clean energy.'},{label:'Next',text:'Review the plan.'}];
          return {text:JSON.stringify(content)};
        }});
        check(closingCalls===5 && closingDeck.calls[0].arguments.slides.length===5,'Closing item mismatch blocked the deck or added inference');
        check(closingDeck.calls[0].arguments.slides[4].html.includes('Review the plan.'),'Closing lost extra point');
        check(closingDeck.metrics.warnings.some(w=>w.includes('Slide 5: closing')),'Closing normalization warning missing');
        let rewriteCalls=0;
        const overflowing=sampleFill('cover');overflowing.title='Extremely long title '.repeat(60);
        const rewritten=await planTemplateFill({command:'Create one slide',tools:createEditorTools({}).listTools(),context,generate:async messages=>{
          rewriteCalls++;return {text:rewriteCalls===1?JSON.stringify(overflowing):JSON.stringify({fields:{title:'A clear short title'}})};
        }});
        check(rewriteCalls===2 && rewritten.calls[0].arguments.slides[0].overflowContent.text.includes('Extremely long title'),'Field rewrite or original preservation failed');
        const savedFixed=compileDeck(rewritten.calls[0].arguments,options);
        check(savedFixed.pages[0].agentMetadata.templateSelection.hostReflowed===false,'Fixed layout was reflowed');
        let formatCalls=0;
        const recoveredFill=await planTemplateFill({command:'Create one slide about solar power',tools:createEditorTools({}).listTools(),context,generate:async messages=>{
          formatCalls++;
          if(formatCalls===1)return {text:'I can help you create a slide.'};
          check(messages[0].content.includes('same language as the user'),'Correction lost topic language instruction');
          check(messages[0].content.includes('plain text key/value lines'),'JSON failure did not switch to deterministic fields');
          return {text:'templateId: photo-story\\npaletteId: forest\\ntitle: Solar turns light into power\\nkicker: Clean energy\\nsubtitle: Panels capture sunlight for useful electricity.\\nimageQuery: rooftop solar panels\\nimageAlt: Rooftop solar panels'};
        }});
        check(formatCalls===2 && recoveredFill.calls[0].arguments.slides.length===1 && recoveredFill.calls[0].arguments.slides[0].html.includes('Solar turns light'),'Plain content fallback failed to insert a fixed template plan');
        let wrappedCalls=0;
        const wrappedFill=await planTemplateFill({command:'Create one slide',tools:createEditorTools({}).listTools(),context,generate:async()=>{wrappedCalls++;return {text:'Here is the content: '+JSON.stringify(sampleFill('photo-story'))};}});
        check(wrappedCalls===1 && wrappedFill.calls[0].arguments.slides[0].layout==='html','Wrapped valid JSON caused extra inference');
        const OriginalWorker=globalThis.Worker;
        try {
          for(const key of ['qwen-4b','gemma-4-e4b','phi-4-mini-instruct']){
            const requests=[];
            globalThis.Worker=class {
              postMessage(message){requests.push(message);queueMicrotask(()=>this.onmessage({data:message.type==='load'?{type:'ready',id:message.id,runtime:{backend:'webgpu',dtype:'test'}}:{type:'result',id:message.id,text:message.messages?.[0]?.content.includes('Fill a fixed presentation template')?JSON.stringify(sampleFill('photo-story')):message.messages?.[0]?.content.includes('Choose a coherent')?'Theme: Clear design\\nPalette: forest\\nSlide 1: Native HTML | comparison\\nSlide 2: Editable content | process':html,metrics:{}}}));}
              terminate(){}
            };
            const agent=createLocalAgent(()=>{},key);
            await agent.load();
            const result=await agent.plan('Create two slides',createEditorTools({}).listTools(),{...context,slideAuthoring:undefined,slideTask:{mode:'create',count:2}});
            check(result.calls[0].arguments.slides.length===2,'Direct HTML lost requested slide count');
            check(result.calls[0].arguments.slides.every(s=>s.layout==='html'),'Local default is not HTML');
            check(result.metrics.workflow==='html-local-guided' && requests.length===4,'Unexpected planning/review roundtrips');
            check(requests.every(r=>r.model===key),'Model selection lost');
            const first=JSON.parse(requests[2].messages[1].content),second=JSON.parse(requests[3].messages[1].content);
            check(first.sharedStyle.background===FILL_PALETTES.forest.background && first.title==='Native HTML' && first.layoutDirection.includes('Two aligned columns'),'Shared style and content layout were not passed through');
            check(second.layoutDirection.includes('numbered steps') && !second.templateReference,'Freeform request unexpectedly received a Presenton reference');
            check(requests[1].maxNewTokens===512 && result.metrics.repairCalls===0,'Planning budget or unnecessary repair regression');
            check(requests[2].messages[0].content.includes('Return ONLY one complete <section'),'HTML output contract lost');
            const fixed=await agent.plan('Create one slide about solar power',createEditorTools({}).listTools(),{...context,localDesignMode:'template-fill',slideTask:{mode:'create',count:1}});
            check(fixed.metrics.workflow==='template-fill' && requests.length===5 && fixed.calls[0].arguments.slides[0].html.includes('<img'),'Agent worker boundary did not route Template Fill correctly');
            agent.dispose();
          }
        }finally{globalThis.Worker=OriginalWorker;}
        return {nativeDeckBase64,layouts,objects:shapes.length,localRepair:true,textShapes:shapes.filter(s=>s.txBody)};
      }
      run().then(result=>{document.body.innerHTML='';const pre=document.createElement('pre');pre.id='result';pre.textContent=JSON.stringify({ok:true,...result});document.body.append(pre)}).catch(error=>{document.body.innerHTML='';const pre=document.createElement('pre');pre.id='result';pre.textContent=JSON.stringify({ok:false,error:error.stack});document.body.append(pre)});
    `,
        },
        define: { "import.meta.env":JSON.stringify({BASE_URL:"/"}), "import.meta.url": JSON.stringify(pathToFileURL(join(directory, "test.js")).href) },
        plugins:[{name:'pdf-worker-url',setup(build){build.onResolve({filter:/\?url$/},args=>({path:args.path,namespace:'source-url'}));build.onLoad({filter:/.*/,namespace:'source-url'},()=>({contents:'export default '+JSON.stringify(pathToFileURL(join(directory,'pdf.worker.min.mjs')).href),loader:'js'}));}}],
        bundle: true,
        format: "iife",
        platform: "browser",
        outfile: join(directory, "test.js"),
      });
      writeFileSync(
        join(directory, "index.html"),
        '<html><head><meta charset="utf-8"></head><body><script>window.addEventListener("error",e=>{document.body.dataset.scriptError=e.message});window.addEventListener("unhandledrejection",e=>{document.body.dataset.scriptError=String(e.reason)});</script><script src="test.js"></script></body></html>',
      );
      const output = await runBrowserFixture(chrome,pathToFileURL(join(directory, 'index.html')).href,join(directory,'profile'));
      const match = output.match(/<pre id="result">([\s\S]*?)<\/pre>/);
      assert.ok(
        match,
        `Browser returned no test result: ${output.slice(-1500)}`,
      );
      const result = JSON.parse(
        match[1]
          .replaceAll("&lt;", "<")
          .replaceAll("&gt;", ">")
          .replaceAll("&amp;", "&"),
      );
      assert.equal(result.ok, true, result.error);
      assert.equal(result.layouts.length, 12);

      assert.equal(result.localRepair, true);
      const exported = exportNativeHTMLText(result.textShapes);
      assert.ok(exported.every((shape) => shape["p:txBody"]?.p.length));
      const text = exported
        .flatMap((shape) =>
          shape["p:txBody"].p.flatMap((p) => p.r.map((r) => r.t || "")),
        )
        .join(" ");
      assert.match(text, /HTML & native slides/);
      assert.match(text, /bold text/);
      assert.ok(
        exported.some((shape) =>
          shape["p:txBody"].p.some((p) => p.r.some((r) => r.rPr?.$_b)),
        ),
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  },
);
