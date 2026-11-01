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
      try {
        const cases = [
          '<!doctype html><html><head><style>:root{--ink:#222}.slide{width:1920px;height:1080px;visibility:hidden}.visible{visibility:visible}.reveal{color:var(--ink)}</style></head><body><div class="slide"><h1 class="reveal">DeepSeek text</h1></div><script>throw Error("must not run")</script></body></html>',
          '<!doctype html><html><body><div class="slide-container" style="background:#fff"><h1 contenteditable="true">Gemini text</h1><img src="https://example.invalid/a.png" alt="A book" style="width:100px;height:100px"></div></body></html>',
          '<!doctype html><html><head><style>.slide{width:1920px;height:1080px;background:#eee}@media print {.slide{display:none}} pre{font-size:30px;color:#123456}</style></head><body><section class="slide"><h1>Claude text</h1><pre>const value = 42;</pre></section></body></html>'
        ];
        for (const [index, source] of cases.entries()) {
          const deck = parseExternalBrief(source);
          const proof = preflightDeckPlan({calls:[{name:'desq_create_deck',arguments:{...deck,fileId:'f',pageId:'p'}}]}, {document:{width:1280,height:720},allowTextOverflow:true});
          const shapes=proof.compiled.pages[0].shapes;
          if (!shapes.some(s=>s.txBody?.p?.some(p=>p.r?.some(r=>r.t.includes(['DeepSeek text','Gemini text','Claude text'][index]))))) throw Error('Editable text missing');
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
