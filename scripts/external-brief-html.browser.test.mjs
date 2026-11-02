import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runBrowserFixture } from './browser-fixture.mjs';

const chrome = process.env.CHROME_BIN || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/chromium', '/usr/bin/google-chrome'].find(existsSync);
test('external HTML brief preflights into editable native slide objects', { skip: !chrome, timeout: 60000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'desq-external-html-'));
  try {
    await build({stdin:{resolveDir:resolve('.'), contents:`
      import {parseExternalBrief} from './editor-vuejs/src/lib/agent/external-brief.mjs';
      import {preflightDeckPlan} from './editor-vuejs/src/lib/agent/deck-preflight.mjs';
      import {flattenShapeGroups} from './editor-vuejs/src/lib/agent/html-shape-groups.mjs';
      try {
        const html='<section style="position:relative;width:1280px;height:720px;background:#ffffff"><div style="position:absolute;left:60px;top:80px;width:500px;height:100px;font-size:40px">Editable headline</div><div style="position:absolute;left:60px;top:220px;width:250px;height:150px;background:#228855"></div></section>';
        const deck=parseExternalBrief(JSON.stringify({version:'1.0',title:'Test',audience:'Readers',objective:'Explain',design:{palette:'forest'},slides:[{title:'Editable headline',purpose:'Explain',layout:'html',html}]}));
        const result=preflightDeckPlan({calls:[{name:'desq_create_deck',arguments:{...deck,fileId:'f',pageId:'p'}}]},{document:{width:1280,height:720}});
        if(!result.compiled.pages[0].shapes.some(s=>s.txBody?.p?.some(p=>p.r?.some(r=>r.t.includes('Editable headline'))))) throw Error('Editable text missing');
        document.body.innerHTML='<pre id="result">OK</pre>';
      } catch(e) {const el=document.createElement('pre');el.id='result';el.textContent='ERROR: '+e.message;document.body.append(el);}
    `},bundle:true,format:'iife',platform:'browser',outfile:join(dir,'fixture.js')});
    writeFileSync(join(dir,'index.html'),'<html><body><script src="fixture.js"></script></body></html>');
    const output=await runBrowserFixture(chrome,pathToFileURL(join(dir,'index.html')).href,join(dir,'profile'));
    assert.match(output, /<pre id="result">OK<\/pre>/);
  } finally { rmSync(dir,{recursive:true,force:true}); }
});

test('standalone HTML decks with different slide stages compile into editable objects', { skip: !chrome, timeout: 60000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'desq-html-import-'));
  try {
    await build({stdin:{resolveDir:resolve('.'), contents:`
      import {parseExternalBrief} from './editor-vuejs/src/lib/agent/external-brief.mjs';
      import {preflightDeckPlan} from './editor-vuejs/src/lib/agent/deck-preflight.mjs';
      import {flattenShapeGroups} from './editor-vuejs/src/lib/agent/html-shape-groups.mjs';
      try {
        const cases = [
          '<!doctype html><html><head><style>:root{--ink:#222}.slide{width:1920px;height:1080px;visibility:hidden}.visible{visibility:visible}.reveal{color:var(--ink)}</style></head><body><div class="slide"><h1 class="reveal">DeepSeek text</h1></div><script>throw Error("must not run")</script></body></html>',
          '<!doctype html><html><body><div class="slide-container" style="background:#fff"><h1 contenteditable="true">Gemini text</h1><img src="https://example.invalid/a.png" alt="A book" style="width:100px;height:100px"></div></body></html>',
          '<!doctype html><html><head><style>.slide{width:1920px;height:1080px;background:#eee}@media print {.slide{display:none}} pre{font-size:30px;color:#123456}</style></head><body><section class="slide"><h1>Claude text</h1><pre>const value = 42;</pre></section></body></html>'
        ];
        for (const [index, source] of cases.entries()) {
          const deck = parseExternalBrief(source);
          const proof = preflightDeckPlan({calls:[{name:'desq_create_deck',arguments:{...deck,fileId:'f',pageId:'p'}}]}, {document:{width:1280,height:720},allowTextOverflow:true});
          const shapes=flattenShapeGroups(proof.compiled.pages[0].shapes);
          if (!shapes.some(s=>s.txBody?.p?.some(p=>p.r?.some(r=>r.t.includes(['DeepSeek text','Gemini text','Claude text'][index]))))) throw Error('Editable text missing');
          if(index === 0 && !shapes.some(s=>s.txBody?.bodyPr?.normAutofit?.$_fontScale === 50000)) throw Error('1920px slide text scale missing');
          if (index === 1 && !deck.slides[0].html.includes('A book')) throw Error('Image description missing');
          if (index === 2 && !shapes.some(s=>s.txBody?.p?.some(p=>p.r?.some(r=>r.t.includes('const value = 42;'))))) throw Error('Editable code missing');
        }
        document.body.innerHTML='<pre id="result">OK</pre>';
      } catch(e) {const el=document.createElement('pre');el.id='result';el.textContent='ERROR: '+e.message;document.body.append(el);}
    `},bundle:true,format:'iife',platform:'browser',outfile:join(dir,'fixture.js')});
    writeFileSync(join(dir,'index.html'),'<html><body><script src="fixture.js"></script></body></html>');
    const output=await runBrowserFixture(chrome,pathToFileURL(join(dir,'index.html')).href,join(dir,'profile'));
    assert.match(output, /<pre id="result">OK<\/pre>/);
  } finally { rmSync(dir,{recursive:true,force:true}); }
});

test('nested slide containers import slide buttons as editable content without behavior', { skip: !chrome, timeout: 60000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'desq-html-button-'));
  try {
    await build({stdin:{resolveDir:resolve('.'), contents:`
      import {parseExternalBrief} from './editor-vuejs/src/lib/agent/external-brief.mjs';
      import {preflightDeckPlan} from './editor-vuejs/src/lib/agent/deck-preflight.mjs';
      import {flattenShapeGroups} from './editor-vuejs/src/lib/agent/html-shape-groups.mjs';
      try {
        const source='<!doctype html><html><body><div class="slide-container"><div class="slide"><h1>First slide</h1><button onclick="window.buttonExecuted=true" style="background:#b05e43;color:#fff;border-radius:8px;padding:12px">Explore</button></div><div class="slide"><h1>Second slide</h1></div></div><button onclick="window.buttonExecuted=true">Navigation</button></body></html>';
        const deck=parseExternalBrief(source);
        if (deck.slides.length !== 2) throw Error('Expected two slides');
        if (/onclick|Navigation/.test(deck.slides[0].html)) throw Error('Unexpected behavior or navigation');
        const proof=preflightDeckPlan({calls:[{name:'desq_create_deck',arguments:{...deck,fileId:'f',pageId:'p'}}]}, {document:{width:1280,height:720},allowTextOverflow:true});
        const shapes=flattenShapeGroups(proof.compiled.pages[0].shapes);
        if (!shapes.some(s=>s.txBody?.p?.some(p=>p.r?.some(r=>r.t.includes('Explore'))))) throw Error('Button text missing');
        if (!shapes.some(s=>s.solidFill)) throw Error('Editable button shape missing: '+JSON.stringify(shapes.map(s=>Object.keys(s))));
        if (window.buttonExecuted) throw Error('Button behavior executed');
        document.body.innerHTML='<pre id="result">OK</pre>';
      } catch(e) {const el=document.createElement('pre');el.id='result';el.textContent='ERROR: '+e.message;document.body.append(el);}
    `},bundle:true,format:'iife',platform:'browser',outfile:join(dir,'fixture.js')});
    writeFileSync(join(dir,'index.html'),'<html><body><script src="fixture.js"></script></body></html>');
    const output=await runBrowserFixture(chrome,pathToFileURL(join(dir,'index.html')).href,join(dir,'profile'));
    assert.match(output, /<pre id="result">OK<\/pre>/);
  } finally { rmSync(dir,{recursive:true,force:true}); }
});

test('Tailwind literal theme becomes native background and fonts without executing scripts', { skip: !chrome, timeout: 60000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'desq-html-theme-'));
  try {
    await build({stdin:{resolveDir:resolve('.'), contents:`
      import {parseExternalBrief} from './editor-vuejs/src/lib/agent/external-brief.mjs';
      import {preflightDeckPlan} from './editor-vuejs/src/lib/agent/deck-preflight.mjs';
      import {flattenShapeGroups} from './editor-vuejs/src/lib/agent/html-shape-groups.mjs';
      try {
        const source=\`<!doctype html><html><head><script src="https://cdn.tailwindcss.com"><\/script><script>tailwind.config = {theme:{extend:{colors:{coffee:{950:'#27100b'},amber:{gold:'#D4AF37'}},fontFamily:{sans:['"Plus Jakarta Sans"'],serif:['"Playfair Display"']}}}};window.themeScriptRan=true;<\/script></head><body class="font-sans bg-coffee-950 text-amber-gold"><section class="slide"><h1 class="font-serif font-semibold text-5xl md:text-7xl lg:text-8xl">Coffee</h1><p>Heritage</p></section></body></html>\`;
        const deck=parseExternalBrief(source);
        const proof=preflightDeckPlan({calls:[{name:'desq_create_deck',arguments:{...deck,fileId:'f',pageId:'p'}}]},{document:{width:1280,height:720},allowTextOverflow:true});
        const page=JSON.stringify(proof.compiled.pages[0]);
        if(!page.includes('27100B')) throw Error('Background missing');
        const titleRun=flattenShapeGroups(proof.compiled.pages[0].shapes).flatMap(s=>s.txBody?.p || []).flatMap(p=>p.r || []).find(r=>r.t.includes('Coffee'));
        if(titleRun?.rPr?.$_sz !== 9600) throw Error('Expected editor font size 96, got '+titleRun?.rPr?.$_sz);
        const titleShape=flattenShapeGroups(proof.compiled.pages[0].shapes).find(s=>s.txBody?.p?.some(p=>p.r?.includes(titleRun)));
        if(titleShape?.txBody?.bodyPr?.normAutofit?.$_fontScale !== 75000) throw Error('CSS pixel to point scale missing');
        if(titleRun?.rPr?.desqFontWeight !== 600) throw Error('Semibold weight missing');
        if(!page.includes('D4AF37')) throw Error('Text color missing');
        if(!page.includes('Playfair Display') || !page.includes('Plus Jakarta Sans')) throw Error('Font families missing');
        if(window.themeScriptRan) throw Error('Source script executed');
        document.body.innerHTML='<pre id="result">OK</pre>';
      } catch(e) {const el=document.createElement('pre');el.id='result';el.textContent='ERROR: '+e.message;document.body.append(el);}
    `},bundle:true,format:'iife',platform:'browser',outfile:join(dir,'fixture.js')});
    writeFileSync(join(dir,'index.html'),'<html><body><script src="fixture.js"></script></body></html>');
    const output=await runBrowserFixture(chrome,pathToFileURL(join(dir,'index.html')).href,join(dir,'profile'));
    assert.match(output, /<pre id="result">OK<\/pre>/);
  } finally { rmSync(dir,{recursive:true,force:true}); }
});

test('responsive grid cards are measured side by side at slide width', { skip: !chrome, timeout: 60000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'desq-html-grid-'));
  try {
    await build({stdin:{resolveDir:resolve('.'), contents:`
      import {parseExternalBrief} from './editor-vuejs/src/lib/agent/external-brief.mjs';
      import {preflightDeckPlan} from './editor-vuejs/src/lib/agent/deck-preflight.mjs';
      import {flattenShapeGroups} from './editor-vuejs/src/lib/agent/html-shape-groups.mjs';
      try {
        const source=\`<!doctype html><html><head><script src="https://cdn.tailwindcss.com"><\/script></head><body><section class="slide"><div class="grid grid-cols-1 md:grid-cols-3 gap-6"><div style="background:#eee"><h2>Card One</h2></div><div style="background:#ddd"><h2>Card Two</h2></div><div style="background:#ccc"><h2>Card Three</h2></div></div></section></body></html>\`;
        const deck=parseExternalBrief(source);
        const proof=preflightDeckPlan({calls:[{name:'desq_create_deck',arguments:{...deck,fileId:'f',pageId:'p'}}]},{document:{width:1280,height:720},allowTextOverflow:true});
        const cardGroups=proof.compiled.pages[0].shapes.filter(s=>s.type==='group' && flattenShapeGroups([s]).some(c=>c.txBody?.p?.some(p=>p.r?.some(r=>r.t.includes('Card')))));
        if(cardGroups.length!==3 || cardGroups.some(g=>!flattenShapeGroups([g]).some(s=>s.type==='path' && s.solidFill))) throw Error('Box and text were not grouped');
        const textShapes=flattenShapeGroups(proof.compiled.pages[0].shapes).filter(s=>s.txBody?.p?.some(p=>p.r?.some(r=>r.t.includes('Card'))));
        if(textShapes.length!==3) throw Error('Expected three editable cards');
        const [a,b,c]=textShapes;
        if (!(a.x < b.x && b.x < c.x && Math.abs(a.y-b.y)<2 && Math.abs(b.y-c.y)<2)) throw Error('Cards are not arranged side by side');
        document.body.innerHTML='<pre id="result">OK</pre>';
      } catch(e) {const el=document.createElement('pre');el.id='result';el.textContent='ERROR: '+e.message;document.body.append(el);}
    `},bundle:true,format:'iife',platform:'browser',outfile:join(dir,'fixture.js')});
    writeFileSync(join(dir,'index.html'),'<html><body><script src="fixture.js"></script></body></html>');
    const output=await runBrowserFixture(chrome,pathToFileURL(join(dir,'index.html')).href,join(dir,'profile'));
    assert.match(output, /<pre id="result">OK<\/pre>/);
  } finally { rmSync(dir,{recursive:true,force:true}); }
});

test('scripted sandbox resolves runtime styles while isolating the editor', { skip: !chrome, timeout: 60000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'desq-scripted-import-'));
  try {
    await build({stdin:{resolveDir:resolve('.'), contents:`
      import {parseExternalBrief} from './editor-vuejs/src/lib/agent/external-brief.mjs';
      import {renderScriptedFrontendSlides} from './editor-vuejs/src/lib/agent/scripted-html-render.mjs';
      import {preflightDeckPlan} from './editor-vuejs/src/lib/agent/deck-preflight.mjs';
      import {flattenShapeGroups} from './editor-vuejs/src/lib/agent/html-shape-groups.mjs';
      (async()=>{try {
        window.editorSecret='private';
        const source=\`<!doctype html><html><head><style>.slide {width:1280px;height:720px}.cards{display:block}</style></head><body><section class="slide"><div class="cards"><div>Card One</div><div>Card Two</div><div>Card Three</div></div><p id="isolation">unknown</p></section><script>document.querySelector('.cards').style.cssText='display:grid;grid-template-columns:repeat(3,1fr);gap:24px';try{document.querySelector('#isolation').textContent=parent.editorSecret}catch(e){document.querySelector('#isolation').textContent='isolated'}<\/script></body></html>\`;
        const deck=parseExternalBrief(source);
        const rendered=await renderScriptedFrontendSlides(source,deck);
        if(!rendered.slides[0].html.includes('isolated') || rendered.slides[0].html.includes('private')) throw Error('Sandbox accessed parent');
        const proof=preflightDeckPlan({calls:[{name:'desq_create_deck',arguments:{...rendered,fileId:'f',pageId:'p'}}]},{document:{width:1280,height:720},allowTextOverflow:true});
        const shapes=flattenShapeGroups(proof.compiled.pages[0].shapes).filter(s=>s.txBody?.p?.some(p=>p.r?.some(r=>r.t.includes('Card'))));
        if(shapes.length!==3 || !(shapes[0].x<shapes[1].x && shapes[1].x<shapes[2].x)) throw Error('Runtime grid was not preserved');
        document.body.innerHTML='<pre id="result">OK</pre>';
      } catch(e) {const el=document.createElement('pre');el.id='result';el.textContent='ERROR: '+e.message;document.body.append(el);}})();
    `},bundle:true,format:'iife',platform:'browser',outfile:join(dir,'fixture.js')});
    writeFileSync(join(dir,'index.html'),'<html><body><script src="fixture.js"></script></body></html>');
    const output=await runBrowserFixture(chrome,pathToFileURL(join(dir,'index.html')).href,join(dir,'profile'));
    assert.match(output, /<pre id="result">OK<\/pre>/);
  } finally { rmSync(dir,{recursive:true,force:true}); }
});

test('scripted snapshots preserve a rendered single line and identify Google font families', { skip: !chrome, timeout: 60000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'desq-scripted-line-'));
  try {
    await build({stdin:{resolveDir:resolve('.'), contents:`
      import {parseExternalBrief} from './editor-vuejs/src/lib/agent/external-brief.mjs';
      import {renderScriptedFrontendSlides} from './editor-vuejs/src/lib/agent/scripted-html-render.mjs';
      import {renderedHtmlFontFamilies} from './editor-vuejs/src/lib/agent/generated-fonts.mjs';
      import {preflightDeckPlan} from './editor-vuejs/src/lib/agent/deck-preflight.mjs';
      import {flattenShapeGroups} from './editor-vuejs/src/lib/agent/html-shape-groups.mjs';
      (async()=>{try {
        const source=\`<!doctype html><html><body><section class="slide" style="width:1280px;height:720px"><div style="display:inline-flex;width:350px;font-family:'Plus Jakarta Sans';font-size:14px;letter-spacing:0.7px"><i style="width:10px"></i>Di Sản Văn Hóa &amp; Kinh Tế Việt Nam</div></section></body></html>\`;
        const rendered=await renderScriptedFrontendSlides(source,parseExternalBrief(source));
        const families=renderedHtmlFontFamilies(rendered);
        if(!families.includes('Plus Jakarta Sans')) throw Error('Google font family missing');
        const proof=preflightDeckPlan({calls:[{name:'desq_create_deck',arguments:{...rendered,fileId:'f',pageId:'p'}}]},{document:{width:1280,height:720},allowTextOverflow:true});
        const shape=flattenShapeGroups(proof.compiled.pages[0].shapes).find(s=>s.txBody?.p?.some(p=>p.r?.some(r=>r.t.includes('Di Sản'))));
        if(!shape || shape.txBody.p.length!==1 || !shape.txBody.p[0].r.map(r=>r.t).join('').includes('Việt Nam')) throw Error('Text was split into paragraphs');
        if(shape.txBody.p[0].r[0].rPr.$_spc!==53) throw Error('Letter spacing missing');
        if(shape.txBody.bodyPr.normAutofit?.$_fontScale!==75000) throw Error('Text visual scale missing');
        const run=shape.txBody.p[0].r[0], effectivePx=run.rPr.$_sz / 100 * 4 / 3 * shape.txBody.bodyPr.normAutofit.$_fontScale / 100000;
        if(Math.abs(effectivePx - 14)>0.01) throw Error('Rendered text size does not match source CSS pixels');
        document.body.innerHTML='<pre id="result">OK</pre>';
      } catch(e) {const el=document.createElement('pre');el.id='result';el.textContent='ERROR: '+e.message;document.body.append(el);}})();
    `},bundle:true,format:'iife',platform:'browser',outfile:join(dir,'fixture.js')});
    writeFileSync(join(dir,'index.html'),'<html><body><script src="fixture.js"></script></body></html>');
    const output=await runBrowserFixture(chrome,pathToFileURL(join(dir,'index.html')).href,join(dir,'profile'));
    assert.match(output, /<pre id="result">OK<\/pre>/);
  } finally { rmSync(dir,{recursive:true,force:true}); }
});

test('Font Awesome pseudo-element icons become editable native vector shapes', { skip: !chrome, timeout: 60000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'desq-fa-import-'));
  try {
    await build({stdin:{resolveDir:resolve('.'), contents:`
      import {parseExternalBrief} from './editor-vuejs/src/lib/agent/external-brief.mjs';
      import {renderScriptedFrontendSlides} from './editor-vuejs/src/lib/agent/scripted-html-render.mjs';
      import {preflightDeckPlan} from './editor-vuejs/src/lib/agent/deck-preflight.mjs';
      import {flattenShapeGroups} from './editor-vuejs/src/lib/agent/html-shape-groups.mjs';
      (async()=>{try {
        const source=\`<!doctype html><html><head><link rel="alternate" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"><style>.fa-solid::before{font-family:'Font Awesome 6 Free';font-weight:900;content:'\\\\f7b6'}</style></head><body><section class="slide"><h1>Example</h1><i class="fa-solid fa-mug-hot" style="color:#b05e43;font-size:24px;display:inline-block;width:24px;height:32px"></i></section></body></html>\`;
        let requested='';
        const fetchImpl=async url=>{requested=url;return {ok:true,headers:{get:()=>null},arrayBuffer:async()=>new ArrayBuffer(120)}};
        const parseFont=()=>({unitsPerEm:1000,ascender:800,descender:-200,charToGlyph:char=>({index:char.codePointAt(0)===0xf7b6?1:0,getPath:()=>({getBoundingBox:()=>({x1:0,y1:-700,x2:1000,y2:100}),toPathData:()=> 'M0 -700 L1000 -700 L1000 100 Z'})})});
        const rendered=await renderScriptedFrontendSlides(source,parseExternalBrief(source),{iconOptions:{fetchImpl,parseFont}});
        if(!requested.endsWith('/6.4.0/webfonts/fa-solid-900.ttf')) throw Error('Wrong icon font');
        if(!rendered.slides[0].html.includes('<svg') || rendered.slides[0].html.includes('data-desq-fa-code')) throw Error('Icon was not converted');
        const proof=preflightDeckPlan({calls:[{name:'desq_create_deck',arguments:{...rendered,fileId:'f',pageId:'p'}}]},{document:{width:1280,height:720},allowTextOverflow:true});
        const icon=flattenShapeGroups(proof.compiled.pages[0].shapes).find(s=>s.type==='path' && s.solidFill);
        if(!icon) throw Error('Editable vector missing');
        if(Math.abs(icon.w-24)>0.2 || Math.abs(icon.h-19.2)>0.2) throw Error('Icon stretched to the line box');
        document.body.innerHTML='<pre id="result">OK</pre>';
      } catch(e) {const el=document.createElement('pre');el.id='result';el.textContent='ERROR: '+e.message;document.body.append(el);}})();
    `},bundle:true,format:'iife',platform:'browser',outfile:join(dir,'fixture.js')});
    writeFileSync(join(dir,'index.html'),'<html><body><script src="fixture.js"></script></body></html>');
    const output=await runBrowserFixture(chrome,pathToFileURL(join(dir,'index.html')).href,join(dir,'profile'));
    assert.match(output, /<pre id="result">OK<\/pre>/);
  } finally { rmSync(dir,{recursive:true,force:true}); }
});

test('rendered lists preserve hidden markers and editable bottom borders', { skip: !chrome, timeout: 60000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'desq-list-import-'));
  try {
    await build({stdin:{resolveDir:resolve('.'), contents:`
      import {parseExternalBrief} from './editor-vuejs/src/lib/agent/external-brief.mjs';
      import {renderScriptedFrontendSlides} from './editor-vuejs/src/lib/agent/scripted-html-render.mjs';
      import {preflightDeckPlan} from './editor-vuejs/src/lib/agent/deck-preflight.mjs';
      import {flattenShapeGroups} from './editor-vuejs/src/lib/agent/html-shape-groups.mjs';
      (async()=>{try {
        const source=\`<!doctype html><html><head><style>ul{list-style:none;margin:0;padding:0}li{display:flex;justify-content:space-between;width:400px;height:30px;border-bottom:1px solid rgba(117,59,47,.4)}li:last-child{border:0}</style></head><body><section class="slide"><ul><li><span style="display:inline-block;width:10px;height:10px;background:#ff0000"></span><span>Liên Minh Châu Âu (EU)</span><span>40%</span></li><li><span>Hoa Kỳ &amp; Nhật Bản</span><span>Market</span></li><li><span>Third</span><span>Growth</span></li></ul></section></body></html>\`;
        const rendered=await renderScriptedFrontendSlides(source,parseExternalBrief(source));
        const proof=preflightDeckPlan({calls:[{name:'desq_create_deck',arguments:{...rendered,fileId:'f',pageId:'p'}}]},{document:{width:1280,height:720},allowTextOverflow:true});
        const groups=proof.compiled.pages[0].shapes.filter(s=>s.type==='group');
        if(groups.length!==3 || groups.some(g=>g.children.length<2)) throw Error('List rows were not grouped');
        const firstRow=flattenShapeGroups([groups[0]]);
        if(!firstRow.some(s=>s.name==='line') || !firstRow.some(s=>s.solidFill?.uniClr?.$_val==='FF0000') || !firstRow.some(s=>s.txBody?.p?.some(p=>p.r?.some(r=>r.t.includes('Liên Minh'))))) throw Error('List row content was separated');
        const shapes=flattenShapeGroups(proof.compiled.pages[0].shapes);
        const text=shapes.filter(s=>s.type==='text');
        const content=s=>s.txBody?.p?.flatMap(p=>p.r?.map(r=>r.t)||[]).join('')||'';
        if(text.some(s=>content(s).includes('•'))) throw Error('Unexpected list marker');
        const first=text.find(s=>content(s).includes('Hoa Kỳ'));
        if(!first || Math.abs(first.x)>1) throw Error('List item was displaced');
        const lines=shapes.filter(s=>s.name==='line' && s.ln?.solidFill?.uniClr?.$_val==='753B2F');
        if(lines.length!==2 || lines.some(s=>Math.abs(s.w-400)>1 || s.h<1 || !s.noFill || s.ln.solidFill.uniClr.alpha?.$_val!==40000)) throw Error('List border geometry or color missing');
        document.body.innerHTML='<pre id="result">OK</pre>';
      } catch(e) {const el=document.createElement('pre');el.id='result';el.textContent='ERROR: '+e.message;document.body.append(el);}})();
    `},bundle:true,format:'iife',platform:'browser',outfile:join(dir,'fixture.js')});
    writeFileSync(join(dir,'index.html'),'<html><body><script src="fixture.js"></script></body></html>');
    const output=await runBrowserFixture(chrome,pathToFileURL(join(dir,'index.html')).href,join(dir,'profile'));
    assert.match(output, /<pre id="result">OK<\/pre>/);
  } finally { rmSync(dir,{recursive:true,force:true}); }
});

test('rendered background-clipped gradients become editable gradient text', { skip: !chrome, timeout: 60000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'desq-gradient-text-'));
  try {
    await build({stdin:{resolveDir:resolve('.'), contents:`
      import {parseExternalBrief} from './editor-vuejs/src/lib/agent/external-brief.mjs';
      import {renderScriptedFrontendSlides} from './editor-vuejs/src/lib/agent/scripted-html-render.mjs';
      import {preflightDeckPlan} from './editor-vuejs/src/lib/agent/deck-preflight.mjs';
      import {flattenShapeGroups} from './editor-vuejs/src/lib/agent/html-shape-groups.mjs';
      (async()=>{try {
        const source=\`<!doctype html><html><head><style>h1{font-size:48px}span{background:linear-gradient(to right,rgb(176,94,67),rgb(212,175,55),rgb(235,190,85));background-clip:text;-webkit-text-fill-color:transparent;text-shadow:2px 3px 4px rgba(12,34,56,.5)}</style></head><body><section class="slide"><h1>CÀ PHÊ <span>VIỆT NAM</span></h1></section></body></html>\`;
        const rendered=await renderScriptedFrontendSlides(source,parseExternalBrief(source));
        const proof=preflightDeckPlan({calls:[{name:'desq_create_deck',arguments:{...rendered,fileId:'f',pageId:'p'}}]},{document:{width:1280,height:720},allowTextOverflow:true});
        const shapes=flattenShapeGroups(proof.compiled.pages[0].shapes);
        const run=shapes.flatMap(s=>s.txBody?.p||[]).flatMap(p=>p.r||[]).find(r=>r.t?.includes('VIỆT NAM'));
        const shadow=run?.rPr?.effectLst?.outerShdw;
        if(!shadow || shadow.uniClr?.$_val!=='0C2238' || shadow.uniClr?.alpha?.$_val!==50000) throw Error('Text shadow missing');
        const stops=run?.rPr?.gradFill?.gsLst?.gs;
        if(!stops || stops.length!==3 || stops.map(s=>s.uniClr.$_val).join(',')!=='B05E43,D4AF37,EBBE55') throw Error('Gradient text missing');
        if(shapes.some(s=>s.type==='path' && s.solidFill?.uniClr?.$_val==='B05E43')) throw Error('Gradient became a filled rectangle');
        document.body.innerHTML='<pre id="result">OK</pre>';
      } catch(e) {const el=document.createElement('pre');el.id='result';el.textContent='ERROR: '+e.message;document.body.append(el);}})();
    `},bundle:true,format:'iife',platform:'browser',outfile:join(dir,'fixture.js')});
    writeFileSync(join(dir,'index.html'),'<html><body><script src="fixture.js"></script></body></html>');
    const output=await runBrowserFixture(chrome,pathToFileURL(join(dir,'index.html')).href,join(dir,'profile'));
    assert.match(output, /<pre id="result">OK<\/pre>/);
  } finally { rmSync(dir,{recursive:true,force:true}); }
});

test('large rendered slides retain local SVG symbols and remain bounded', { skip: !chrome, timeout: 60000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'desq-large-render-'));
  try {
    await build({stdin:{resolveDir:resolve('.'), contents:`
      import {parseExternalBrief} from './editor-vuejs/src/lib/agent/external-brief.mjs';
      import {renderScriptedFrontendSlides} from './editor-vuejs/src/lib/agent/scripted-html-render.mjs';
      import {preflightDeckPlan} from './editor-vuejs/src/lib/agent/deck-preflight.mjs';
      import {flattenShapeGroups} from './editor-vuejs/src/lib/agent/html-shape-groups.mjs';
      (async()=>{try {
        const source=\`<!doctype html><html><body><svg width="0" height="0"><defs><symbol id="icon" viewBox="0 0 10 10"><path transform="translate(1 1)" d="M0 0H8V8H0Z" fill="var(--icon-color,#123456)"/></symbol></defs></svg><section class="slide"><div>\${'<span>x</span>'.repeat(110)}</div><div style="position:absolute;left:120px;top:100px;width:80px;height:30px;background-color:#42dfb3;border-radius:6px"></div><svg width="30" height="30" style="--icon-color:#e63a4e"><use href="#icon"/></svg></section></body></html>\`;
        const rendered=await renderScriptedFrontendSlides(source,parseExternalBrief(source));
        if(rendered.slides[0].html.length<=80000) throw Error('Fixture did not exceed the previous size limit');
        const proof=preflightDeckPlan({calls:[{name:'desq_create_deck',arguments:{...rendered,fileId:'f',pageId:'p'}}]},{document:{width:1280,height:720},allowTextOverflow:true});
        const shapes=flattenShapeGroups(proof.compiled.pages[0].shapes);
        if(!shapes.some(s=>s.name?.startsWith('html-decoration-') && s.solidFill?.uniClr?.$_val==='42DFB3' && Math.abs(s.w-80)<1 && Math.abs(s.h-30)<1)) throw Error('Empty background div missing');
        if(!shapes.some(s=>s.type==='path' && s.solidFill?.uniClr?.$_val==='E63A4E')) throw Error('SVG symbol missing or color lost');
        if(!shapes.some(s=>s.txBody?.p?.some(p=>p.r?.some(r=>r.t.includes('xxxxxxxx'))))) throw Error('Slide text missing');
        document.body.innerHTML='<pre id="result">OK</pre>';
      } catch(e) {const el=document.createElement('pre');el.id='result';el.textContent='ERROR: '+e.message;document.body.append(el);}})();
    `},bundle:true,format:'iife',platform:'browser',outfile:join(dir,'fixture.js')});
    writeFileSync(join(dir,'index.html'),'<html><body><script src="fixture.js"></script></body></html>');
    const output=await runBrowserFixture(chrome,pathToFileURL(join(dir,'index.html')).href,join(dir,'profile'));
    assert.match(output, /<pre id="result">OK<\/pre>/);
  } finally { rmSync(dir,{recursive:true,force:true}); }
});
