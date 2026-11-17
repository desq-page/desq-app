// Usage: node scripts/build-source-design-layouts.mjs /path/to/beautiful-html-templates
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { runBrowserFixture } from './browser-fixture.mjs';
import { measureTemplateLayouts } from './lib/measure-template-layouts.mjs';
import { SVGPathData } from 'svg-pathdata';
const source = resolve(process.argv[2]);
const chrome = process.env.CHROME_BIN || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/chromium'].find(existsSync);
if (!chrome) throw Error('Chrome is required to measure real template geometry.');
const index = JSON.parse(readFileSync(join(source,'index.json'))).templates;
const selected = process.argv[3];
const outputPath = 'editor-vuejs/src/lib/design/source-layout-geometry.json';
const results = selected ? JSON.parse(readFileSync(outputPath, 'utf8')) : [];
if (selected && !index.some(entry => entry.slug === selected)) throw Error('Unknown template family.');
const directory = mkdtempSync(join(tmpdir(),'desq-source-layouts-'));
try {
  for (const entry of index.filter(entry => !selected || entry.slug === selected)) {
    const path = join(source,'templates',entry.slug,'template.html');
    const original = readFileSync(path,'utf8');
    // No source JavaScript executes during measurement. Retain styles and fonts.
    const html = original.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')
      .replace(/<head([^>]*)>/i, `<head$1><base href="${pathToFileURL(path).href}">`)
      .replace(/<\/head>/i, '<style>*,*::before,*::after{animation:none!important;transition:none!important}html,body{margin:0!important}deck-stage{display:block}</style></head>');
    const fixture = `<iframe style="width:1280px;height:720px;border:0" id="frame"></iframe><script>
const frame=document.getElementById('frame');
frame.onload=async()=>{try{await Promise.race([frame.contentDocument.fonts.ready,new Promise(r=>setTimeout(r,4000))]);
const fn=frame.contentWindow.eval('('+${JSON.stringify(measureTemplateLayouts.toString())}+')');
const result=fn();const out=document.createElement('pre');out.id='result';out.textContent=JSON.stringify(result);document.body.append(out);
}catch(e){const out=document.createElement('pre');out.id='result';out.textContent=JSON.stringify({error:e.stack});document.body.append(out)}};
frame.srcdoc=${JSON.stringify(html).replace(/<\//g,'<\\/')};</script>`;
    const target = join(directory,'index.html'); writeFileSync(target,fixture);
    const output = await runBrowserFixture(chrome,pathToFileURL(target).href,join(directory,'profile'));
    const raw = output.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1];
    if (!raw) throw Error(`No measured layouts for ${entry.slug}`);
    const measured = JSON.parse(raw.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&'));
    if (measured.error) throw Error(measured.error);
    const {layouts,rejected} = measured;
    for (const layout of layouts) {
      for (const art of layout.layoutElements || []) {
        if (!art.svgPath) continue;
        const path = new SVGPathData(art.svgPath).toAbs().normalizeHVZ().normalizeST().qtToC().aToC().matrix(...art.matrix);
        const bounds = path.getBounds();
        art.x = bounds.minX;
        art.y = bounds.minY;
        art.w = Math.max(.1, bounds.maxX - bounds.minX);
        art.h = Math.max(.1, bounds.maxY - bounds.minY);
        art.d = path.translate(-art.x, -art.y).encode();
        art.pathWidth = art.w;
        art.pathHeight = art.h;
        delete art.svgPath;
        delete art.matrix;
      }
    }
    const record = { slug:entry.slug, sourceHash:createHash('sha256').update(original).digest('hex'), layouts, rejected };
    if (selected) results[results.findIndex(family => family.slug === selected)] = record;
    else results.push(record);
    console.log(entry.slug,layouts.length,'indexed,',layouts.length-rejected.length,'adaptable');
  }
  writeFileSync(outputPath,JSON.stringify(results,null,2)+'\n');
} finally { rmSync(directory,{recursive:true,force:true}); }
