import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

test('thumbnail raster deadline can be extended without changing other preview defaults', async () => {
  const result = await build({ entryPoints: ['shared-vuejs/src/lib/html2img.ts'], bundle: true, platform: 'node', format: 'esm', write: false,
    plugins: [{ name: 'raster-boundary', setup(builder) {
      builder.onResolve({ filter: /^\.\.?\// }, args => args.kind === 'entry-point' ? undefined : ({ path: args.path, namespace: 'mock' }));
      builder.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents:
        args.path.includes('raster-render') ? 'export async function boundedRender(render, timeoutMs) { return timeoutMs; } export function rasterImage() {}'
          : args.path.includes('utility') ? 'export const blobToDataURL=()=>{},offH=()=>720,offW=()=>1280,round=Math.round;'
          : args.path.includes('slideUtils') ? 'export const genFontFace=()=>"";'
          : 'export default "";', loader: 'js' }));
    } }],
  });
  const { html2img } = await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
  assert.equal(await html2img('<div/>', [], false, .4, 'jpg', 1280, 720), 15000);
  assert.equal(await html2img('<div/>', [], false, .4, 'jpg', 1280, 720, '', { timeoutMs: 60000 }), 60000);
  assert.equal(await html2img('<div/>', [], false, 1, 'png', 1280, 720), 60000);
});

test('generated fonts wait for the webfont loader before allowing insertion', async () => {
  const result = await build({ entryPoints: ['editor-vuejs/src/lib/agent/generated-fonts.mjs'], bundle: true, platform: 'node', format: 'esm', write: false,
    plugins: [{ name: 'webfont-boundary', setup(builder) {
      builder.onResolve({ filter: /^webfontloader$/ }, () => ({ path: 'webfontloader', namespace: 'mock' }));
      builder.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: 'export default {load(options) { globalThis.__generatedFontLoad = options; }};', loader: 'js' }));
    } }],
  });
  const { generatedFontFamilies, loadGeneratedGoogleFonts } = await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
  assert.deepEqual(generatedFontFamilies([{children:[{txBody:{p:[{r:[{rPr:{latin:{$_typeface:'"Inter", sans-serif'}}}]}]}}]}]), ['Inter']);
  const previous = globalThis.document;
  globalThis.document = {};
  try {
    let finished = false;
    const work = loadGeneratedGoogleFonts(['Inter']).then(result => { finished = true; return result; });
    while (!globalThis.__generatedFontLoad) await new Promise(resolve => setImmediate(resolve));
    assert.equal(finished, false);
    assert.match(globalThis.__generatedFontLoad.google.families[0], /^Inter:.*700/);
    globalThis.__generatedFontLoad.active();
    assert.deepEqual(await work, []);
  } finally { if(previous === undefined) delete globalThis.document; else globalThis.document=previous; delete globalThis.__generatedFontLoad; }
});

test('thumbnail SVG serializes HTML entities, ampersands, void tags and CSS as valid XML', async () => {
  const { DOMParser: Parser, XMLSerializer: Serializer } = await import('@xmldom/xmldom');
  const result = await build({ entryPoints: ['shared-vuejs/src/lib/html2img.ts'], bundle: true, platform: 'node', format: 'esm', write: false,
    plugins: [{ name: 'serialization-boundary', setup(builder) {
      builder.onResolve({ filter: /^\.\.?\// }, args => args.kind === 'entry-point' ? undefined : ({ path: args.path, namespace: 'mock' }));
      builder.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents:
        args.path.includes('raster-render') ? 'export const boundedRender=()=>{},rasterImage=()=>{};'
          : args.path.includes('utility') ? 'export const blobToDataURL=()=>{},offH=()=>720,offW=()=>1280,round=Math.round;'
          : args.path.includes('slideUtils') ? 'export const genFontFace=()=>"";'
          : 'export default ".card { & > p { color: red; } }";', loader: 'js' }));
    } }],
  });
  const previousParser=globalThis.DOMParser,previousSerializer=globalThis.XMLSerializer;
  // xmldom supplies an HTML parser but not browser document.body accessors.
  globalThis.DOMParser=class { parseFromString(source,mime) { const doc=new Parser().parseFromString(source,mime);return {body:{firstElementChild:doc.documentElement}}; } };
  globalThis.XMLSerializer=Serializer;
  try {
    const {html2svg}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
    const url=await html2svg('<h1>HORROR & DELIGHT</h1><p>Halloween&nbsp;invite<br>October</p><input disabled>',null,1280,720,.4,'jpg');
    const xml=decodeURIComponent(url.slice(url.indexOf(',')+1));
    const errors=[];
    const doc=new Parser({onError:(level,message)=>errors.push(message)}).parseFromString(xml,'image/svg+xml');
    assert.deepEqual(errors,[]);
    assert.match(xml,/HORROR &amp; DELIGHT/);
    assert.match(xml,/&amp; &gt; p/);
    assert.equal(doc.getElementsByTagName('br').length,1);
    assert.equal(doc.getElementsByTagName('input').item(0).getAttribute('disabled'),'disabled');
  } finally {
    if(previousParser===undefined)delete globalThis.DOMParser;else globalThis.DOMParser=previousParser;
    if(previousSerializer===undefined)delete globalThis.XMLSerializer;else globalThis.XMLSerializer=previousSerializer;
  }
});
