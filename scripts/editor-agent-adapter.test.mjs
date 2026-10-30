import test from 'node:test';
import assert from 'node:assert/strict';
import { build, transform } from 'esbuild';
import { readFile } from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import { createEditorTools } from '../editor-vuejs/src/lib/agent/editor-tools.mjs';
import { AUTOSHAPES, resolveAutoshape } from '../editor-vuejs/src/lib/agent/autoshape-catalog.mjs';
import { presetGeometryPlugin } from './preset-geometry-fixture.mjs';
import { designSample, helloWorldSample } from './deck-design-sample.mjs';

// Exercise the real adapter with the library boundary mocked, so failures
// cannot be hidden by a fake tool implementation.
const mocks = `
const f = () => globalThis.__editorAgentFixture;
export const googleFonts = [['Inter'], ['Lato'], ['Space Grotesk']];
export const getFileInfo = () => f().file;
export const getSlideInfo = () => f().slide;
export const getSlidesSlideId = () => f().slide.id;
export const getSelectSelShps = () => f().selected || [];
export const getSlidesMasterView = () => false;
export const getInfoUseGrid = () => '';
export const getSelectedTextTarget = () => f().targetOverride || (f().selected?.length === 1 && f().slide.shapes.find(s => s.id === f().selected[0])?.txBody ? { shapeId: f().selected[0], kind: 'shape' } : null);
export const getShapeDeep = id => structuredClone(id.startsWith('tbl:') ? f().slide.shapes.find(s => s.id === id.split(':')[1]).graphic.graphicData.tbl.tr[Number(id.split(':')[2])].tc[Number(id.split(':')[3])] : f().slide.shapes.find(s => s.id === id));
export const updateShape = (patch, id = patch.id) => { f().patches.push(structuredClone(patch)); const shape = id.startsWith('tbl:') ? f().slide.shapes.find(s => s.id === id.split(':')[1]).graphic.graphicData.tbl.tr[Number(id.split(':')[2])].tc[Number(id.split(':')[3])] : f().slide.shapes.find(s => s.id === id); Object.assign(shape, patch); };
export const updateFile = patch => Object.assign(f().file, patch);
export const updateSlide = slide => { f().slide = slide; if (f().pages) f().pages[slide.id] = slide; f().replaced = true; };
export const selectSlide = async id => {
  (f().navigations ||= []).push(id);
  if (f().pages) { if (!f().pages[id]) throw new Error('Unknown slide'); f().slide = f().pages[id]; }
  else f().slide.id = id;
};
export const pasteSlide = async (slide, source) => { f().onPaste?.(); f().createdSlide = structuredClone(slide); (f().createdSlides ||= []).push(structuredClone(slide)); const id = f().createdSlides.length === 1 ? 'generated-page' : 'generated-page-' + f().createdSlides.length; f().file.slides.push({ id, name: slide.name }); return id; };
export const processImage = async blob => f().onProcessImage ? f().onProcessImage(blob) : ({ name: 'stored-image.webp', w: 800, h: 600 });
export const loadSlideFromDexie = async (fileId, id) => f().storedSlides?.[id];
export const saveThumb = async (id, options) => { f().thumbnail = id; await f().onThumbnail?.(id, options); };
export const addShapeRaw = shape => { const added = { id: 'added', ...shape }; f().slide.shapes.push(added); return added; };
export const deleteShape = ({delshp}) => { if (!f().deselected) throw new Error('Selection was not cleared'); f().slide.shapes = f().slide.shapes.filter(s => s.id !== delshp); };
export const saveDexie = async options => { f().saves++; (f().saveOptions ||= []).push(options); await f().onSave?.(options); };
export const hideEditor = () => {};
export const captureTextCursor = () => f().cursor || null;
export const flushPendingTextSave = async () => { f().onFlush?.(); };
export const displayFileTitle = () => {};
export const linkedSlides = { previous: id => f().incomingLinks.includes(id) };
export const deselectAll = () => { f().deselected = true; };
export const genId = () => 'paragraph-' + ++f().sequence;
`;
const built = await build({ entryPoints: ['editor-vuejs/src/lib/agent/editor-adapter.ts'], bundle: true, format: 'esm', write: false,
  plugins: [presetGeometryPlugin(), { name: 'mock-public-library', setup(build) {
    build.onResolve({filter:/^paper$/},()=>({path:pathToFileURL(resolve('node_modules/paper/dist/paper-core.js')).href,external:true}));
    build.onResolve({ filter: /^shared-vuejs\// }, args => args.path === 'shared-vuejs/api/suppliedShapes' ? undefined : ({ path: args.path, namespace: 'mock' }));
    build.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: mocks, loader: 'js' }));
  } }],
});
const { editorAdapter } = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'));

test('native metadata, Boolean geometry and animation insert through the real adapter',async()=>{
  const {state,tools}=fixture();Object.assign(state.file,{width:1280,height:720,layouts:[{id:'layout'}]});
  const native=(kind,payload)=>`<svg viewBox="0 0 1280 720"><g id="native" data-pptx-replace-with="${kind}"><metadata type="application/json">${JSON.stringify({x:80,y:100,width:600,height:300,...payload})}</metadata></g></svg>`;
  const slides=[
    {title:'Chart',purpose:'Show data',layout:'svg',svg:native('chart',{type:'waterfall',categories:['A','B'],values:[2,3]})},
    {title:'Table',purpose:'Compare data',layout:'svg',svg:native('table',{columns:['A','B'],rows:[['One','Two']]})},
    {title:'Formula',purpose:'Explain a relationship',layout:'svg',svg:native('formula',{latex:String.raw`\frac{x}{y}`})},
    {title:'Boolean',purpose:'Show overlap',layout:'svg',svg:'<svg viewBox="0 0 1280 720"><rect id="a" x="80" y="100" width="200" height="200"/><rect id="b" x="180" y="100" width="200" height="200"/></svg>',booleans:[{operation:'union',source_ids:['a','b'],output_id:'combined'}],motion:{groups:{combined:{effect:'entrance_fade',trigger:'on-click'}},transition:{effect:'cube',duration:.4}}},
  ];
  const result=await tools.executeTool('desq_create_deck',{fileId:'file',pageId:'page',title:'Native parity',audience:'Reviewers',objective:'Verify native insertion',slides});
  assert.equal(result.ok,true,result.error);assert.equal(state.saves,4);
  assert.ok(state.createdSlides[0].shapes[0].graphic.graphicData['c:chart'].chartJson['cx:chartSpace']);
  assert.equal(state.createdSlides[1].shapes[0].graphic.graphicData.tbl.tr.length,2);
  assert.equal(state.createdSlides[2].shapes[0].txBody.p[0].r[0].$_otag,'m');
  const page=state.createdSlides[3];assert.equal(page.shapes.length,1);assert.equal(page.timing.m[0].sh,page.shapes[0].id);assert.equal(page.transition.nativeKey,'cube');
});

test('a bad native payload on a later page prevents all deck insertion',async()=>{
  const {state,tools}=fixture();Object.assign(state.file,{width:1280,height:720,layouts:[{id:'layout'}]});
  const result=await tools.executeTool('desq_create_deck',{fileId:'file',pageId:'page',title:'Invalid',audience:'Reviewers',objective:'Check atomic preflight',slides:[
    {title:'Valid',purpose:'Explain',layout:'svg',svg:'<svg viewBox="0 0 1280 720"><rect width="100" height="100"/></svg>'},
    {title:'Invalid',purpose:'Explain',layout:'svg',svg:'<svg viewBox="0 0 1280 720"><g data-pptx-replace-with="table"><metadata type="application/json">{"x":20,"y":20,"width":600,"height":300,"rows":[["A"],["B","C"]]}</metadata></g></svg>'},
  ]});assert.equal(result.ok,false);assert.equal(state.saves,0);assert.equal(state.createdSlides,undefined);
});

function fixture() {
  globalThis.__editorAgentFixture = {
    file: { id: 'file', name: 'Original', slides: [{ id: 'page' }] },
    slide: { id: 'page', shapes: [{ id: 'text', name: 'Title', type: 'text', x: 10, y: 20, w: 200, h: 100,
      txBody: { bodyPr: { $_anchor: 'ctr' }, p: [{ pPr: { $_algn: 'ctr' }, r: [{ t: 'Original', rPr: { $_sz: 1800, $_b: true } }] }] } }] },
    patches: [], incomingLinks: [], saves: 0, sequence: 0,
  };
  return { state: globalThis.__editorAgentFixture, tools: createEditorTools(editorAdapter) };
}
const target = { fileId: 'file', pageId: 'page', shapeId: 'text' };

test('extended upstream effects and text transforms survive insertion as native DrawingML JSON', async () => {
  const {state,tools}=fixture();Object.assign(state.file,{width:1280,height:720,layouts:[{id:'layout'}]});
  const slides=[];for(const title of ['soft-rounded','glassmorphism'])slides.push({title,purpose:'Verify native effects',layout:'svg',svg:await readFile(`third_party/ppt-master/fixtures/${title}.svg`,'utf8')});
  slides.push({title:'Native text',purpose:'Verify text paint/rotation',layout:'svg',svg:'<svg viewBox="0 0 1280 720"><defs><radialGradient id="r"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#087F8C"/></radialGradient></defs><rect width="1280" height="720" fill="#ffffff"/><text x="200" y="200" transform="rotate(30 200 200)" fill="url(#r)">A rotated gradient</text></svg>'});
  const result=await tools.executeTool('desq_create_deck',{fileId:'file',pageId:'page',title:'Native DrawingML',audience:'Reviewers',objective:'Verify preserved effects',slides});
  assert.equal(result.ok,true,result.error);assert.equal(state.saves,3);
  assert.ok(state.createdSlides[0].shapes.some(s=>s.effectLst?.outerShdw));assert.ok(state.createdSlides[1].shapes.some(s=>s.effectLst?.glow));
  const text=state.createdSlides[2].shapes.find(s=>s.txBody);assert.ok(Math.abs(text.rot-30)<1e-8);assert.equal(text.txBody.p[0].r[0].rPr.gradFill.path.$_path,'circle');
});

test('actual upstream SVG pages insert as native freeforms/text through the editor without fixed layout objects', async () => {
  const { state, tools } = fixture();Object.assign(state.file,{width:1280,height:720,layouts:[{id:'layout'}]});
  const slides=[];for(const title of ['editorial','memphis'])slides.push({title,purpose:'Test upstream composition',layout:'svg',svg:await readFile(`third_party/ppt-master/fixtures/${title}.svg`,'utf8')});
  const result=await tools.executeTool('desq_create_deck',{fileId:'file',pageId:'page',title:'Upstream pages',audience:'Developers',objective:'Preserve source compositions',slides});
  assert.equal(result.ok,true,result.error);assert.equal(state.createdSlides.length,2);assert.equal(state.saves,2);
  assert.ok(state.createdSlides.every(p=>p.agentMetadata.engine==='ppt-master-svg'));
  const shapes=state.createdSlides.flatMap(p=>p.shapes);
  assert.ok(shapes.some(s=>s.type==='path'&&s.d.includes('C')));assert.ok(shapes.some(s=>s.txBody));
  assert.ok(!shapes.some(s=>s.svg||s.type==='image'||s.name==='Content column'||s.name==='Accent rule'));
});

test('unsupported later SVG features fail before any deck page is inserted', async () => {
  const {state,tools}=fixture();Object.assign(state.file,{width:1280,height:720,layouts:[{id:'layout'}]});
  const slides=[{title:'Good',purpose:'Test',layout:'svg',svg:'<svg viewBox="0 0 1280 720"><rect width="10" height="10"/></svg>'},{title:'Bad',purpose:'Test',layout:'svg',svg:'<svg viewBox="0 0 1280 720"><foreignObject/></svg>'}];
  const result=await tools.executeTool('desq_create_deck',{fileId:'file',pageId:'page',title:'Reject',audience:'Testers',objective:'No partial writes',slides});
  assert.equal(result.ok,false);assert.match(result.error,/foreignObject/);assert.equal(state.createdSlide,undefined);
});

test('one-page SVG authoring resolves generated images or retains described placeholders through the editor', async t => {
  const previousFetch=globalThis.fetch;t.after(()=>{globalThis.fetch=previousFetch;});globalThis.fetch=async()=>Response.json({});
  for(const fail of [false,true]){
    const {state,tools}=fixture();Object.assign(state.file,{width:1280,height:720,layouts:[{id:'layout'}]});
    const svg='<svg viewBox="0 0 1280 720"><rect width="1280" height="720" fill="#ffffff"/><text x="40" y="80" font-size="48">Hello World</text><image x="600" y="120" width="500" height="400" data-query="A colorful greeting illustration" aria-label="A greeting"/></svg>';
    const result=await tools.executeTool('desq_create_deck',{fileId:'file',pageId:'page',title:'Hello',audience:'Everyone',objective:'Test a greeting',slides:[{title:'Hello',purpose:'Welcome',layout:'svg',svg}]},{generateImage:async()=>{if(fail)throw Error('HTTP 400');return {blob:new Blob(['image'],{type:'image/png'}),title:'Greeting',author:'OpenAI',license:'AI-generated',sourceUrl:'',generation:{provider:'OpenAI',model:'test'}};}});
    assert.equal(result.ok,true,result.error);assert.equal(result.result.slideCount,1);
    if(fail){assert.equal(result.result.placeholderCount,1);assert.ok(state.createdSlide.shapes.some(s=>s.imagePlaceholder?.description==='A colorful greeting illustration'));assert.match(result.result.warnings.join(),/HTTP 400/);}
    else{assert.equal(result.result.imageCount,1);assert.ok(state.createdSlide.shapes.some(s=>s.type==='image'&&s.imageSource.generation.provider==='OpenAI'));assert.ok(state.createdSlide.shapes.some(s=>s.name==='Image credits'));}
  }
});

test('Hello World inserts cover, three native labeled rounded columns and closing even when image generation fails', async t => {
  const previousFetch = globalThis.fetch; t.after(() => { globalThis.fetch = previousFetch; });
  globalThis.fetch = async () => Response.json({});
  const { state, tools } = fixture(); Object.assign(state.file, { width: 1280, height: 720, layouts: [{ id: 'layout' }] });
  const result = await tools.executeTool('desq_create_deck', { ...helloWorldSample(), fileId: 'file', pageId: 'page' }, { generateImage: async () => { throw Error('HTTP 400'); } });
  assert.equal(result.ok, true, result.error); assert.equal(result.result.slideCount, 3); assert.equal(result.result.placeholderCount, 2);
  const columns = state.createdSlides[1].shapes.filter(s => s.prstGeom?.$_prst === 'roundRect');
  assert.equal(columns.length, 3); assert.ok(columns.every(s => s.txBody.p.length === 2 && s.d && !/NaN|undefined/.test(s.d)));
  assert.equal(state.createdSlides[0].agentMetadata.layout, 'cover'); assert.equal(state.createdSlides[2].agentMetadata.layout, 'closing');
});

test('varied decks insert through the real preset geometry compiler as editable native slides', async () => {
  const { state, tools } = fixture();
  Object.assign(state.file, { width: 1280, height: 720, layouts: [{ id: 'layout' }] });
  const result = await tools.executeTool('desq_create_deck', { ...designSample(), fileId: 'file', pageId: 'page' });
  assert.equal(result.ok, true, result.error); assert.equal(result.result.slideCount, 10);
  const shapes = state.createdSlides.flatMap(p => p.shapes);
  assert.ok(shapes.some(s => s.prstGeom?.$_prst === 'chevron' && !/NaN|undefined/.test(s.d)));
  assert.ok(shapes.some(s => s.prstGeom?.$_prst === 'roundRect'));
  assert.ok(shapes.some(s => s.name === 'Timeline rail'));
  assert.ok(state.createdSlides.every(p => p.agentMetadata.strategy.thesis === designSample().strategy.thesis));
  assert.equal(state.saves, 10);
});

test('slide and deck Wikimedia misses use the host image generator before committing native pictures', async t => {
  const previousFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = previousFetch; });
  globalThis.fetch = async () => Response.json({ query: { pages: {} } });
  for (const deck of [false, true]) {
    const { state, tools } = fixture();
    Object.assign(state.file, { width: 1280, height: 720, layouts: [{ id: 'layout' }] });
    const image = { query: 'Abstract greeting', alt: 'Greeting' };
    const args = deck ? deckInput() : { fileId: 'file', pageId: 'page', title: 'Hello', images: [image] };
    if (deck) args.slides[1].images = [image];
    let generated = 0;
    const result = await tools.executeTool(deck ? 'desq_create_deck' : 'desq_create_slide', args, { generateImage: async () => {
      generated++; return { blob: new Blob(['mock png bytes'], { type: 'image/png' }), title: 'Greeting', author: 'OpenAI', license: 'AI-generated', sourceUrl: '', generation: { provider: 'OpenAI', model: 'test' } };
    } });
    assert.equal(result.ok, true, result.error); assert.equal(generated, 1);
    const picture = state.createdSlides.flatMap(s => s.shapes).find(s => s.type === 'image');
    assert.equal(picture.blipFill.blip.$_target, 'stored-image.webp');
    assert.equal(picture.imageSource.license, 'AI-generated'); assert.equal(picture.imageSource.generation.provider, 'OpenAI');
  }
  const { state, tools } = fixture(); Object.assign(state.file, { width: 1280, height: 720, layouts: [{ id: 'layout' }] });
  const result = await tools.executeTool('desq_create_slide', { fileId: 'file', pageId: 'page', title: 'Hello', images: [{ query: 'Hello', alt: 'Hello' }] },
    { generateImage: async () => { throw new Error('Image generation access denied'); } });
  assert.equal(result.ok, true); assert.ok(state.createdSlide.shapes.some(s => s.imagePlaceholder)); assert.ok(state.createdSlide.shapes.some(s => s.name === "Image description" && s.txBody.p.some(p => p.r.some(r => r.t === "Hello")))); assert.equal(result.result.placeholderCount, 1); assert.match(result.result.warnings.join(), /access denied/);
});

const deckInput = () => ({ fileId: 'file', pageId: 'page', title: 'A coherent deck', audience: 'Executives', objective: 'Decide next steps', slides: [
  { title: 'Start', purpose: 'Introduce', layout: 'cover', subtitle: 'A clear message' },
  { title: 'Evidence', purpose: 'Explain', layout: 'content', bullets: ['A concise point', 'Another point'] },
  { title: 'Decision', purpose: 'Conclude', layout: 'closing', subtitle: 'Approve discovery' },
] });

test('complete decks preflight before inserting, preserve order, persist and report progress', async () => {
  const { state, tools } = fixture();
  Object.assign(state.file, { width: 1280, height: 720, sourceFormat: 'pptx', layouts: [{ id: 'layout' }] });
  const progress = [];
  const result = await tools.executeTool('desq_create_deck', deckInput(), { onProgress: message => progress.push(message) });
  assert.equal(result.ok, true, result.error);
  assert.equal(result.result.slideCount, 3);
  assert.deepEqual(state.createdSlides.map(s => s.name), ['Start', 'Evidence', 'Decision']);
  assert.equal(state.file.slides.length, 4); assert.equal(state.saves, 3);
  assert.equal(state.slide.id, 'generated-page-3');
  assert.equal(progress.some(p => p.includes('3 of 3')), true);
  assert.equal(state.createdSlides.every(s => s.layoutid === 'layout' && s.id === 'page'), true);
});

test('a bad later deck slide cannot leave earlier pages behind', async () => {
  const { state, tools } = fixture();
  Object.assign(state.file, { width: 1280, height: 720, layouts: [{ id: 'layout' }] });
  const args = deckInput(); args.slides[2] = { title: 'Bad', purpose: 'Test', layout: 'custom', elements: [{ kind: 'table', x: 54, y: 170, width: 500, height: 400, rows: [['a', 'b'], ['c']] }] };
  const result = await tools.executeTool('desq_create_deck', args);
  assert.equal(result.ok, false); assert.match(result.error, /rectangular/);
  assert.equal(state.createdSlide, undefined); assert.equal(state.saves, 0);
});

test('deck cancellation reports partial insertion and never inserts subsequent pages', async () => {
  const { state, tools } = fixture();
  Object.assign(state.file, { width: 1280, height: 720, layouts: [{ id: 'layout' }] });
  const controller = new AbortController(); state.onPaste = () => controller.abort();
  const result = await tools.executeTool('desq_create_deck', deckInput(), { signal: controller.signal });
  assert.equal(result.ok, false); assert.match(result.error, /1\/3 slides/);
  assert.equal(state.createdSlides.length, 1);
});

test('agent context reads imported singleton paragraphs and runs before model inference', async () => {
  for (const [paragraphs, expected] of [
    [{ r: { t: 'Singleton paragraph and run' } }, 'Singleton paragraph and run'],
    [[{ r: { t: 'First' } }, { r: [{ t: 'Second ' }, { t: 'line' }] }], 'First\nSecond line'],
    [{ r: [{ t: 'Two ' }, { t: 'runs' }] }, 'Two runs'],
    [{ r: { t: { '#text': 'Imported XML text' } } }, 'Imported XML text'],
    [[null, { r: null }], '\n'],
  ]) {
    const { state, tools } = fixture();
    state.slide.shapes[0].txBody.p = paragraphs;
    const before = structuredClone(state.slide.shapes[0].txBody);
    const result = await tools.executeTool('desq_get_page');
    assert.equal(result.ok, true, result.error);
    assert.equal(result.result.shapes[0].text, expected);
    assert.deepEqual(state.slide.shapes[0].txBody, before);
    assert.equal(state.saves, 0);
  }
});

test('generated slide is composed before insertion, persisted once, selected and thumbnailed', async () => {
  const { state, tools } = fixture();
  Object.assign(state.file, { width: 1280, height: 720, sourceFormat: 'pptx', layouts: [{ id: 'layout' }] });
  const result = await tools.executeTool('desq_create_slide', { fileId: 'file', pageId: 'page', title: 'Solar energy',
    subtitle: 'A renewable power source', bullets: ['Captures sunlight', 'Reduces operating emissions', 'Works at many scales'], theme: 'dark' });
  assert.equal(result.ok, true, result.error);
  assert.equal(result.result.pageId, 'generated-page');
  assert.equal(state.file.slides.length, 2);
  assert.equal(state.slide.id, 'generated-page');
  assert.equal(state.saves, 1); assert.equal(state.thumbnail, 'generated-page');
  assert.equal(state.createdSlide.id, 'page'); // Existing PPTX archive template.
  assert.equal(state.createdSlide.layoutid, 'layout');
  const text = state.createdSlide.shapes.flatMap(shape => shape.txBody?.p.flatMap(p => p.r.map(r => r.t)) || []);
  assert.ok(text.includes('Solar energy')); assert.ok(text.includes('Captures sunlight'));
  const bulletShapes = state.createdSlide.shapes.filter(shape => shape.txBody?.p[0]?.pPr?.buChar);
  assert.equal(bulletShapes.length, 1);
  assert.equal(bulletShapes[0].txBody.p.length, 3);
  assert.deepEqual(bulletShapes[0].txBody.p.map(p => p.r[0].t), ['Captures sunlight', 'Reduces operating emissions', 'Works at many scales']);
});

test('slide creation validates nested content and stale or unsupported documents before insertion', async () => {
  for (const extra of [{ title: ' ' }, { bullets: [''] }, { images: [{ query: 'solar panel', alt: 'Panels', url: 'https://evil.example' }] },
    { images: [{ query: 'solar panel' }] }, { bullets: Array(9).fill('point') }, { pageId: 'stale' }]) {
    const { state, tools } = fixture();
    Object.assign(state.file, { width: 1280, height: 720, layouts: [{ id: 'layout' }] });
    const result = await tools.executeTool('desq_create_slide', { fileId: 'file', pageId: 'page', title: 'Solar energy', ...extra });
    assert.equal(result.ok, false); assert.equal(state.createdSlide, undefined); assert.equal(state.saves, 0);
  }
  const { state, tools } = fixture();
  state.file.sourceFormat = 'docx';
  assert.match((await tools.executeTool('desq_create_slide', { fileId: 'file', pageId: 'page', title: 'Solar energy' })).error, /presentation/);
});

test('slide image preparation embeds media and aborts before insertion on search failure or document drift', async () => {
  const previousFetch = globalThis.fetch;
  try {
    for (const mode of ['success', 'failure', 'drift', 'cancel']) {
      const { state, tools } = fixture();
      Object.assign(state.file, { width: 1280, height: 720, layouts: [{ id: 'layout' }] });
      const controller = new AbortController();
      globalThis.fetch = async url => {
        if (mode === 'failure') throw new Error('Image service unavailable');
        if (url.includes('/w/api.php?')) return Response.json({ query: { pages: { 1: { title: 'File:Solar.jpg', imageinfo: [{
          mime: 'image/jpeg', url: 'https://upload.wikimedia.org/solar.jpg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:Solar.jpg',
          extmetadata: { Artist: { value: 'Photographer' }, LicenseShortName: { value: 'CC BY 4.0' } },
        }] } } } });
        if (mode === 'drift') state.file.id = 'different-document';
        if (mode === 'cancel') controller.abort();
        return new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/jpeg' } });
      };
      const result = await tools.executeTool('desq_create_slide', { fileId: 'file', pageId: 'page', title: 'Solar energy',
        bullets: ['Renewable power'], images: [{ query: 'solar panel', alt: 'Solar panel' }] }, { signal: controller.signal });
      if (mode === 'success') {
        assert.equal(result.ok, true, result.error); assert.equal(result.result.imageCount, 1);
        assert.equal(state.createdSlide.shapes.find(shape => shape.type === 'image').blipFill.blip.$_target, 'stored-image.webp');
        assert.equal(result.result.imageSources[0].license, 'CC BY 4.0');
      } else if (mode === 'failure') { assert.equal(result.ok, true, result.error); assert.equal(result.result.placeholderCount, 1); assert.equal(result.result.imageCount, 0); } else { assert.equal(result.ok, false); assert.equal(state.createdSlide, undefined); assert.equal(state.saves, 0); }
    }
  } finally { globalThis.fetch = previousFetch; }
});

test('text edits use a partial store patch, preserve default formatting, and save', async () => {
  const { state, tools } = fixture();
  assert.equal((await tools.executeTool('desq_set_shape_text', { ...target, text: 'First\nSecond' })).ok, true);
  assert.deepEqual(Object.keys(state.patches[0]).sort(), ['id', 'txBody']);
  const body = state.slide.shapes[0].txBody;
  assert.equal(body.bodyPr.$_anchor, 'ctr');
  assert.equal(body.p[0].pPr.$_algn, 'ctr');
  assert.equal(body.p[0].r[0].rPr.$_b, true);
  assert.equal(body.p[1].r[0].t, 'Second');
  assert.notEqual(body.p[0].id, body.p[1].id);
  assert.equal(state.saves, 1);
});

test('stale document and page identifiers prevent mutations', async () => {
  const { state, tools } = fixture();
  for (const args of [{ ...target, fileId: 'other' }, { ...target, pageId: 'other' }])
    assert.equal((await tools.executeTool('desq_move_shape', { ...args, x: 100, y: 100 })).ok, false);
  assert.equal(state.patches.length, 0);
  assert.equal(state.saves, 0);
  state.onFlush = () => { state.file.id = 'changed-during-flush'; };
  assert.equal((await tools.executeTool('desq_move_shape', { ...target, x: 100, y: 100 })).ok, false);
  assert.equal(state.patches.length, 0);
});

test('locked and linked text frames reject deletion and text replacement', async () => {
  for (const protection of ['locked', 'linkedTextbox', 'mainDoc', 'incomingLink']) {
    const { state, tools } = fixture();
    if (protection === 'incomingLink') state.incomingLinks.push('text');
    else state.slide.shapes[0][protection] = true;
    assert.equal((await tools.executeTool('desq_set_shape_text', { ...target, text: 'Replacement' })).ok, false);
    assert.equal((await tools.executeTool('desq_delete_shape', target)).ok, false);
    assert.equal(state.slide.shapes.length, 1);
    assert.equal(state.saves, 0);
  }
});

test('add, move, rename, and delete use public operations and persist changes', async () => {
  const { state, tools } = fixture();
  assert.equal((await tools.executeTool('desq_add_text', { fileId: 'file', pageId: 'page', text: 'Hello', x: 10, y: 20, width: 300, height: 80 })).result.shapeId, 'added');
  assert.equal(state.slide.shapes[1].txBody.p[0].r[0].t, 'Hello');
  assert.equal((await tools.executeTool('desq_move_shape', { ...target, x: 100, y: 50 })).ok, true);
  assert.equal(state.slide.shapes[0].x, 100);
  assert.equal(state.slide.shapes[0].w, 200);
  assert.equal((await tools.executeTool('desq_rename_document', { fileId: 'file', name: 'Plan' })).ok, true);
  assert.equal(state.file.name, 'Plan');
  assert.equal((await tools.executeTool('desq_delete_shape', target)).ok, true);
  assert.equal(state.deselected, true);
  assert.equal(state.slide.shapes.length, 1);
  assert.equal(state.saves, 4);
});

test('read responses are paginated and contain no live document references', async () => {
  const { state, tools } = fixture();
  const response = await tools.executeTool('desq_get_page', { offset: 0, limit: 1 });
  assert.equal(response.result.shapes.length, 1);
  assert.equal(response.result.shapes[0].text, 'Original');
  response.result.shapes[0].text = 'Changed externally';
  assert.equal(state.slide.shapes[0].txBody.p[0].r[0].t, 'Original');
  const second = await tools.executeTool('desq_get_page', { offset: 1, limit: 1 });
  assert.equal(second.result.shapes.length, 0);
});

test('a red textbox uses default placement and true red fill, not color words as text', async () => {
  const { state, tools } = fixture();
  const result = await tools.executeTool('desq_add_text', { fileId: 'file', pageId: 'page', fillColor: 'red', textColor: 'white' });
  assert.equal(result.ok, true);
  const shape = state.slide.shapes.at(-1);
  assert.equal(shape.solidFill.uniClr.$_val, 'FF0000');
  assert.equal(shape.txBody.p[0].r[0].rPr.solidFill.uniClr.$_val, 'FFFFFF');
  assert.equal(shape.txBody.p[0].r[0].t, 'Text');
  assert.deepEqual([shape.x, shape.y, shape.w, shape.h], [100, 100, 300, 100]);
  const invalid = await tools.executeTool('desq_add_text', { fileId: 'file', pageId: 'page', fillColor: 'not-a-color' });
  assert.equal(invalid.ok, false);
  assert.equal(state.saves, 1);
});

test('AutoShape insertion uses a real ellipse preset, validates shape types, and persists', async () => {
  const { state, tools } = fixture();
  const args = { fileId: 'file', pageId: 'page', shape: 'oval', fillColor: 'red' };
  const result = await tools.executeTool('desq_add_autoshape', args);
  assert.equal(result.ok, true);
  const shape = state.slide.shapes.at(-1);
  assert.equal(shape.type, 'ellipse');
  assert.equal(shape.prstGeom.$_prst, 'ellipse');
  assert.equal(shape.d, 'FE0,0,200,120');
  assert.equal(shape.solidFill.uniClr.$_val, 'FF0000');
  assert.equal(state.saves, 1);
  assert.equal((await tools.executeTool('desq_add_autoshape', { ...args, shape: 'anything' })).ok, false);
  assert.equal((await tools.executeTool('desq_add_autoshape', { ...args, fillColor: 'anything' })).ok, false);
  assert.equal(state.slide.shapes.length, 2);
});

test('every palette AutoShape uses real serializable preset geometry at different aspect ratios', async () => {
  assert.ok(AUTOSHAPES.length > 100);
  const failures = [];
  for (const preset of AUTOSHAPES) for (const [width, height] of [[200, 120], [80, 240]]) {
    const { state, tools } = fixture();
    const result = await tools.executeTool('desq_add_autoshape', { fileId: 'file', pageId: 'page', shape: preset.id, width, height, fillColor: 'red' });
    if (!result.ok) { failures.push(`${preset.id} ${width}x${height}: ${result.error}`); continue; }
    const shape = state.slide.shapes.at(-1);
    assert.equal(shape.prstGeom.$_prst, preset.id);
    assert.ok(shape.d.length > 0);
    assert.ok(!/NaN|Infinity|undefined|null/.test(shape.d), preset.id);
    assert.doesNotThrow(() => structuredClone(shape));
    assert.equal(shape.noFill, preset.noFill);
    if (preset.noFill) { assert.equal(shape.solidFill, null); assert.equal(shape.ln.solidFill.uniClr.$_val, 'FF0000'); }
    assert.equal(state.saves, 1);
  }
  assert.deepEqual(failures, []);
});

test('star aliases preserve star geometry transforms and circles enforce equal dimensions', async () => {
  assert.equal(resolveAutoshape('5-point star').id, 'star5');
  assert.equal(resolveAutoshape('rounded rectangle').id, 'roundRect');
  const { state, tools } = fixture();
  const args = { fileId: 'file', pageId: 'page' };
  assert.equal((await tools.executeTool('desq_add_autoshape', { ...args, shape: 'star' })).ok, true);
  const star = state.slide.shapes.at(-1);
  assert.equal(star.prstGeom.$_prst, 'star5'); assert.ok(star.prstTxMargin);
  assert.ok((star.d.match(/L/g) || []).length >= 9);
  assert.equal((await tools.executeTool('desq_add_autoshape', { ...args, shape: 'circle', width: 100, height: 150 })).ok, false);
});


test('validated cloud relative-move plans reach the adapter with the computed destination', async () => {
  const { parseToolPlan } = await import('../editor-vuejs/src/lib/agent/agent-plan.mjs');
  const { state, tools } = fixture();
  state.selected = ['text'];
  const plan = parseToolPlan(JSON.stringify({ message: 'Move down', calls: [{ name: 'desq_move_shape_by', arguments: { dy: 200 } }] }), tools.listTools(),
    { document: editorAdapter.getDocument({}), page: editorAdapter.getPage({}) });
  const result = await tools.executeTool(plan.calls[0].name, plan.calls[0].arguments);
  assert.equal(result.ok, true);
  assert.equal(state.slide.shapes[0].x, 10);
  assert.equal(state.slide.shapes[0].y, 220);
  assert.equal(state.saves, 1);
});

test('relative movement resolves live selection and calculates from the latest position', async () => {
  const { state, tools } = fixture();
  state.selected = ['text'];
  state.onFlush = () => { state.slide.shapes[0].y = 30; };
  const result = await tools.executeTool('desq_move_shape_by', { fileId: 'file', pageId: 'page', dy: 200 });
  assert.equal(result.ok, true);
  assert.equal(state.slide.shapes[0].x, 10);
  assert.equal(state.slide.shapes[0].y, 230);
  assert.equal(state.saves, 1);
});

test('relative movement rejects ambiguous targets, selection drift, protected shapes and out-of-range destinations before mutations', async () => {
  for (const kind of ['none', 'multiple', 'changed', 'locked', 'bounds', 'zero', 'missing']) {
    const { state, tools } = fixture();
    state.selected = ['text'];
    if (kind === 'none') state.selected = [];
    if (kind === 'multiple') state.selected = ['text', 'other'];
    if (kind === 'changed') state.onFlush = () => { state.selected = ['other']; };
    if (kind === 'locked') state.slide.shapes[0].locked = true;
    if (kind === 'bounds') state.slide.shapes[0].y = 9900;
    const args = { fileId: 'file', pageId: 'page', ...(kind === 'missing' ? {} : { dy: kind === 'zero' ? 0 : 200 }) };
    assert.equal((await tools.executeTool('desq_move_shape_by', args)).ok, false, kind);
    assert.equal(state.patches.length, 0, kind);
    assert.equal(state.saves, 0, kind);
  }
});

test('text formatting sets toolbar size across runs while preserving content, layout, and unrelated styles', async () => {
  const { state, tools } = fixture();
  state.selected = ['text'];
  state.slide.shapes[0].txBody.p[0].r.push({ t: ' second', rPr: { $_sz: 1200, $_i: 1 } });
  const result = await tools.executeTool('desq_format_text', { fileId: 'file', pageId: 'page', fontSize: 32 });
  assert.equal(result.ok, true);
  const shape = state.slide.shapes[0];
  assert.equal(shape.txBody.p[0].r[0].rPr.$_sz, 3200);
  assert.equal(shape.txBody.p[0].r[1].rPr.$_sz, 3200);
  assert.equal(shape.txBody.p[0].r[0].rPr.$_b, true);
  assert.equal(shape.txBody.p[0].r[1].rPr.$_i, 1);
  assert.equal(shape.txBody.p[0].r.map(run => run.t).join(''), 'Original second');
  assert.equal(shape.txBody.p[0].pPr.$_algn, 'ctr');
  assert.equal(shape.txBody.p[0].pPr.defRPr.$_sz, 3200);
  assert.equal(shape.txBody.bodyPr.defRPr.$_sz, 3200);
  assert.deepEqual([shape.x, shape.y, shape.w, shape.h], [10, 20, 200, 100]);
  assert.equal(state.saves, 1);
  assert.equal((await tools.executeTool('desq_format_text', { fileId: 'file', pageId: 'page', bold: false, italic: true, underline: true, fontFamily: 'Arial', textColor: 'red' })).ok, true);
  const style = state.slide.shapes[0].txBody.p[0].r[0].rPr;
  assert.equal(style.$_b, 0);
  assert.equal(style.$_i, 1);
  assert.equal(style.$_u, 'sng');
  assert.equal(style.latin.$_typeface, 'Arial');
  assert.equal(style.solidFill.uniClr.$_val, 'FF0000');
});

test('formatting rejects missing styles, invalid size/color, protected or nontext targets, and selection drift without mutations', async () => {
  for (const kind of ['empty', 'large', 'boolean', 'color', 'font', 'locked', 'nontext', 'changed']) {
    const { state, tools } = fixture(); state.selected = ['text'];
    const args = { fileId: 'file', pageId: 'page', fontSize: 24 };
    if (kind === 'empty') delete args.fontSize;
    if (kind === 'large') args.fontSize = 1000;
    if (kind === 'boolean') args.bold = 'true';
    if (kind === 'color') args.textColor = 'not-a-color';
    if (kind === 'font') args.fontFamily = ' ';
    if (kind === 'locked') state.slide.shapes[0].locked = true;
    if (kind === 'nontext') delete state.slide.shapes[0].txBody;
    if (kind === 'changed') state.onFlush = () => { state.selected = ['other']; };
    assert.equal((await tools.executeTool('desq_format_text', args)).ok, false, kind);
    assert.equal(state.patches.length, 0, kind);
    assert.equal(state.saves, 0, kind);
  }
});

test('insert paragraphs into the selected textbox preserves existing mixed runs and inherits insertion formatting', async () => {
  const { state, tools } = fixture(); state.selected = ['text'];
  const body = state.slide.shapes[0].txBody;
  body.p[0].r.push({ t: ' ending', rPr: { $_sz: 3200, $_i: 1 } });
  body.p.push({ id: 'last', r: [{ t: 'Last paragraph', rPr: { $_sz: 1400 } }] });
  const original = structuredClone(body.p);
  const result = await tools.executeTool('desq_insert_text', { fileId: 'file', pageId: 'page', text: 'Disclaimer\r\nSecond line' });
  assert.equal(result.ok, true);
  assert.equal(state.slide.shapes.length, 1);
  assert.deepEqual(state.slide.shapes[0].txBody.p.slice(0, 2), original);
  assert.equal(state.slide.shapes[0].txBody.p[2].r[0].t, 'Disclaimer');
  assert.equal(state.slide.shapes[0].txBody.p[2].r[0].rPr.$_sz, 1400);
  assert.equal(result.result.insertedParagraphs, 2);
  assert.equal(state.saves, 1);
  assert.equal((await tools.executeTool('desq_insert_text', { ...target, afterParagraph: 1, text: 'Middle' })).ok, true);
  assert.equal(state.slide.shapes[0].txBody.p[1].r[0].t, 'Middle');
  assert.equal(state.slide.shapes[0].txBody.p[1].r[0].rPr.$_i, 1);
  assert.deepEqual(state.slide.shapes[0].txBody.p[2], original[1]);
});

test('paragraph insertion rejects invalid targets, positions, empty content, and selection drift before mutation', async () => {
  for (const kind of ['blank', 'range', 'locked', 'nontext', 'selection', 'drift']) {
    const { state, tools } = fixture(); state.selected = ['text'];
    const args = { fileId: 'file', pageId: 'page', text: 'Disclaimer' };
    if (kind === 'blank') args.text = ' ';
    if (kind === 'range') args.afterParagraph = 2;
    if (kind === 'locked') state.slide.shapes[0].locked = true;
    if (kind === 'nontext') delete state.slide.shapes[0].txBody;
    if (kind === 'selection') state.selected = [];
    if (kind === 'drift') state.onFlush = () => { state.selected = ['other']; };
    assert.equal((await tools.executeTool('desq_insert_text', args)).ok, false, kind);
    assert.equal(state.patches.length, 0, kind);
    assert.equal(state.saves, 0, kind);
  }
});


test('cursor insertion restores the saved editor caret, uses text history path, and saves without replacing the textbox', async () => {
  const { state, tools } = fixture(); state.selected = ['text'];
  editorAdapter.clearTextCursor();
  let inserted;
  state.cursor = { shapeId: 'text', paragraph: 1, offset: 3, insert: text => { inserted = text; } };
  editorAdapter.rememberTextCursor();
  const cursor = editorAdapter.getDocument({}).textCursor;
  assert.equal(cursor.offset, 3);
  // Focusing the agent does not overwrite the saved caret.
  state.cursor = null; editorAdapter.rememberTextCursor();
  const result = await tools.executeTool('desq_insert_text_at_cursor', { fileId: 'file', pageId: 'page', cursorId: cursor.cursorId, text: 'Hello' });
  assert.equal(result.ok, true);
  assert.equal(inserted, 'Hello');
  assert.equal(state.patches.length, 0);
  assert.equal(state.saves, 1);
  assert.equal(editorAdapter.getDocument({}).textCursor, null);
});

test('cursor insertion rejects bookmarks superseded during inference and protected shapes', async () => {
  const { state, tools } = fixture(); state.selected = ['text'];
  editorAdapter.clearTextCursor();
  state.cursor = { shapeId: 'text', paragraph: 1, offset: 3, insert: () => { throw new Error('Unexpected insertion'); } };
  editorAdapter.rememberTextCursor();
  const old = editorAdapter.getDocument({}).textCursor;
  editorAdapter.rememberTextCursor();
  assert.equal((await tools.executeTool('desq_insert_text_at_cursor', { ...target, shapeId: undefined })).ok, false);
  assert.equal((await tools.executeTool('desq_insert_text_at_cursor', { fileId: 'file', pageId: 'page', cursorId: old.cursorId, text: 'Hello' })).ok, false);
  state.slide.shapes[0].locked = true;
  const current = editorAdapter.getDocument({}).textCursor;
  assert.equal((await tools.executeTool('desq_insert_text_at_cursor', { fileId: 'file', pageId: 'page', cursorId: current.cursorId, text: 'Hello' })).ok, false);
  assert.equal(state.saves, 0);
});

test('a text range selection clears the earlier saved caret instead of inserting at an old position', () => {
  const { state } = fixture(); state.selected = ['text'];
  state.cursor = { shapeId: 'text', paragraph: 1, offset: 3, insert() {} };
  editorAdapter.rememberTextCursor();
  assert.ok(editorAdapter.getDocument({}).textCursor);
  state.cursor = { unavailable: true };
  editorAdapter.rememberTextCursor();
  assert.equal(editorAdapter.getDocument({}).textCursor, null);
});


// Exercise the actual public bookmark implementation, including DOM drift guards.
const cursorSource = (await readFile('shared-vuejs/src/edlib/text/updateText.ts', 'utf8')).split('export function captureTextCursor()')[1];
const cursorModule = await transform(`
const f = () => globalThis.__cursorFixture;
const vSelect = { get editingTextObject() { return f().editing; } };
const gid = () => ({ querySelector: () => f().box });
const window = { getSelection: () => f().selection };
const document = { createRange: () => ({ selectNodeContents() {}, setEnd() {}, toString: () => 'abc' }), execCommand: (...args) => { f().command = args; return f().success; } };
const Node = { ELEMENT_NODE: 1 };
const updateText = (...args) => { f().updated = args; };
export function captureTextCursor()${cursorSource}`, { loader: 'ts', format: 'esm' });
const { captureTextCursor: captureRealCursor } = await import('data:text/javascript;base64,' + Buffer.from(cursorModule.code).toString('base64'));

test('public cursor bookmark restores exact range and uses native text insertion, rejecting changed DOM and failed commands', () => {
  const paragraph = {};
  const node = { nodeType: 1, closest: () => paragraph };
  const range = { startContainer: node, endContainer: node, startOffset: 3, cloneRange() { return { ...this, collapse() { this.startOffset = 6; } }; } };
  const f = globalThis.__cursorFixture = {
    editing: 'text', success: true,
    box: { isContentEditable: true, isConnected: true, innerHTML: '<p>abcdef</p>', contains: n => n === node || n === paragraph, querySelectorAll: () => [paragraph], focus() {} },
    selection: { rangeCount: 1, isCollapsed: true, getRangeAt: () => range, removeAllRanges() {}, addRange: r => { f.restored = r; } },
  };
  const cursor = captureRealCursor();
  assert.equal(cursor.offset, 3);
  assert.equal(cursor.paragraph, 1);
  cursor.insert('Hello');
  assert.deepEqual(f.command, ['insertText', false, 'Hello']);
  assert.equal(f.restored.startOffset, 3);
  assert.deepEqual(f.updated, [false, true, ['text']]);
  f.box.innerHTML = 'changed';
  assert.equal(cursor.isValid(), false);
  assert.throws(() => cursor.insert('Again'), /changed/);
  f.box.innerHTML = '<p>abcdef</p>'; f.success = false;
  assert.throws(() => cursor.insert('Again'), /could not insert/);
  f.selection.isCollapsed = false;
  assert.equal(captureRealCursor().hasSelection, true);
  assert.equal(captureRealCursor().offset, 3);
  f.success = true; captureRealCursor().insert('After selected text');
  assert.equal(f.restored.startOffset, 6);
  f.selection.isCollapsed = true; f.editing = '';
  assert.equal(captureRealCursor(), null);
});


test('append insertion supports a selected table cell and preserves its properties and sibling cells', async () => {
  const { state, tools } = fixture();
  const body = structuredClone(state.slide.shapes[0].txBody);
  state.slide.shapes = [{ id: 'table', type: 'table', graphic: { graphicData: { tbl: { tr: [{ tc: [{ txBody: body, tcPr: { fill: 'keep' } }, { txBody: structuredClone(body) }] }] } } } }];
  state.selected = ['table']; state.targetOverride = { shapeId: 'tbl:table:0:0', kind: 'cell' };
  const sibling = structuredClone(state.slide.shapes[0].graphic.graphicData.tbl.tr[0].tc[1]);
  assert.equal((await tools.executeTool('desq_insert_text', { fileId: 'file', pageId: 'page', text: 'Appended' })).ok, true);
  const cells = state.slide.shapes[0].graphic.graphicData.tbl.tr[0].tc;
  assert.equal(cells[0].txBody.p[1].r[0].t, 'Appended');
  assert.equal(cells[0].tcPr.fill, 'keep');
  assert.deepEqual(cells[1], sibling);
  assert.equal(state.saves, 1);
});


test('text insertion initializes an empty oval without changing geometry or styling', async () => {
  const { state, tools } = fixture();
  state.slide.shapes = [{ id: 'oval', type: 'ellipse', $_otag: 'sp', x: 40, y: 80, w: 200, h: 120, d: 'E0,0,200,120', solidFill: { color: 'blue' } }];
  state.selected = ['oval']; state.targetOverride = { shapeId: 'oval', kind: 'shape' };
  const before = structuredClone(state.slide.shapes[0]);
  const result = await tools.executeTool('desq_insert_text', { fileId: 'file', pageId: 'page', text: 'Hello oval' });
  assert.equal(result.ok, true);
  assert.equal(state.slide.shapes.length, 1);
  assert.equal(state.slide.shapes[0].txBody.p[0].r[0].t, 'Hello oval');
  const { txBody, ...remaining } = state.slide.shapes[0];
  assert.deepEqual(remaining, before);
  assert.equal(state.saves, 1);
});


test('empty AutoShapes support text except lines and polygons', async () => {
  for (const type of ['diamond', 'star5', 'chevron', 'cloud', 'line', 'polygon']) {
    const { state, tools } = fixture();
    state.slide.shapes = [{ id: 'auto', type, $_otag: 'sp' }];
    state.selected = ['auto']; state.targetOverride = { shapeId: 'auto', kind: 'shape' };
    const result = await tools.executeTool('desq_insert_text', { fileId: 'file', pageId: 'page', text: 'Hello' });
    const allowed = !['line', 'polygon'].includes(type);
    assert.equal(result.ok, allowed, type);
    assert.equal(state.saves, allowed ? 1 : 0);
    assert.equal(!!state.slide.shapes[0].txBody, allowed);
  }
});

test('image storage failures retain placeholders and finish every deck page',async t=>{
  const previousFetch=globalThis.fetch;t.after(()=>{globalThis.fetch=previousFetch;});globalThis.fetch=async()=>Response.json({});
  for(const deck of [false,true]){
    const {state,tools}=fixture();Object.assign(state.file,{width:1280,height:720,layouts:[{id:'layout'}]});
    state.onProcessImage=()=>{throw Error('Image decoder failed');};
    const image={query:'A greeting',alt:'Greeting'};
    const args=deck?deckInput():{fileId:'file',pageId:'page',title:'Hello',images:[image]};
    if(deck)args.slides[1].images=[image];
    const result=await tools.executeTool(deck?'desq_create_deck':'desq_create_slide',args,{generateImage:async()=>({blob:new Blob(['bad'],{type:'image/png'}),title:'Greeting',author:'AI',license:'AI-generated',sourceUrl:''})});
    assert.equal(result.ok,true,result.error);assert.equal(result.result.placeholderCount,1);assert.equal(result.result.imageCount,0);
    assert.equal(state.createdSlides.length,deck?args.slides.length:1);assert.match(result.result.warnings.join(),/decoder failed/);
  }
});

test('failed clip conversion keeps later pages and omits unused image credits',async t=>{
  const previousFetch=globalThis.fetch;t.after(()=>{globalThis.fetch=previousFetch;});globalThis.fetch=async()=>Response.json({});
  const {state,tools}=fixture();Object.assign(state.file,{width:1280,height:720,layouts:[{id:'layout'}]});
  const result=await tools.executeTool('desq_create_deck',{fileId:'file',pageId:'page',title:'Clip fallback',audience:'Readers',objective:'Continue processing',slides:[
    {title:'Photo',purpose:'Show subject',layout:'svg',svg:'<svg viewBox="0 0 1280 720"><image x="40" y="120" width="300" height="200" data-query="Portrait" aria-label="Portrait" clip-path="url(#missing)"/></svg>'},
    {title:'Closing',purpose:'Finish',layout:'svg',svg:'<svg viewBox="0 0 1280 720"><text x="40" y="100">Thank you</text></svg>'}
  ]},{generateImage:async()=>({blob:new Blob(['image'],{type:'image/png'}),title:'Portrait',author:'AI',license:'AI-generated',sourceUrl:''})});
  assert.equal(result.ok,true,result.error);assert.equal(result.result.slideCount,2);assert.equal(result.result.placeholderCount,1);assert.equal(result.result.imageCount,0);
  assert.ok(!state.createdSlides[0].shapes.some(s=>s.name==='Image credits'));assert.match(result.result.warnings.join(),/clipPath/);
});

test('thumbnail failures never prevent later deck pages from being inserted and saved',async()=>{
  const {state,tools}=fixture();Object.assign(state.file,{width:1280,height:720,layouts:[{id:'layout'}]});
  state.onSave=options=>{assert.equal(options.skipGenerateThumb,true,'Persistence must not wait for raster previews');};
  state.onThumbnail=(id,options)=>{assert.equal(state.saves,3);assert.equal(options.timeoutMs,60000);throw Error('Slide preview image could not be decoded.');};
  const progress=[];
  const result=await tools.executeTool('desq_create_deck',deckInput(),{onProgress:message=>progress.push(message)});
  assert.equal(result.ok,true,result.error);assert.equal(result.result.slideCount,3);assert.equal(state.saves,3);
  assert.equal(result.result.warnings.filter(w=>w.startsWith('Thumbnail not refreshed')).length,3);
  assert.ok(progress.some(p=>p.includes('Opening slide 3')));assert.ok(progress.some(p=>p.includes('Refreshing preview 3')));
});


test('edit tab replaces one slide in place without inserting pages', async () => {
  const { state, tools } = fixture();
  Object.assign(state.file, { width: 1280, height: 720, layouts: [{ id: 'layout' }] });
  state.file.slides.push({ id: 'next', name: 'Next' });
  const result = await tools.executeTool('desq_create_deck', { fileId: 'file', pageId: 'page', title: 'Updated', audience: 'Readers', objective: 'Update this slide',
    slides: [{ title: 'Updated', purpose: 'Explain', layout: 'svg', svg: '<svg viewBox="0 0 1280 720"><text x="100" y="100">New text</text></svg>' }] }, { replaceCurrent: true });
  assert.equal(result.ok, true, result.error);
  assert.equal(result.result.replaced, true);
  assert.deepEqual(state.file.slides.map(slide => slide.id), ['page', 'next']);
  assert.equal(state.file.slides[0].name, 'Updated');
  assert.equal(state.slide.id, 'page');
  assert.equal(state.slide.shapes[0].txBody.p[0].r[0].t, 'New text');
  assert.equal(state.createdSlides, undefined);
  assert.equal(state.saves, 1);
  assert.equal(state.thumbnail, 'page');
});

test('replacement rejects multiple pages and protected existing shapes before mutation', async () => {
  for (const locked of [false, true]) {
    const { state, tools } = fixture();
    Object.assign(state.file, { width: 1280, height: 720, layouts: [{ id: 'layout' }] });
    state.slide.shapes[0].locked = locked;
    const page = { title: 'Updated', purpose: 'Explain', layout: 'svg', svg: '<svg viewBox="0 0 1280 720"><text x="100" y="100">New text</text></svg>' };
    const result = await tools.executeTool('desq_create_deck', { fileId: 'file', pageId: 'page', title: 'Updated', audience: 'Readers', objective: 'Update', slides: locked ? [page] : [page, page] }, { replaceCurrent: true });
    assert.equal(result.ok, false);
    assert.match(result.error, locked ? /locked or linked/ : /exactly one/);
    assert.equal(state.replaced, undefined);
    assert.equal(state.saves, 0);
  }
});


function pinnedEditFixture() {
  const f = fixture(), { state } = f;
  Object.assign(state.file, { width: 1280, height: 720, layouts: [{ id: 'layout' }], slides: [{ id: 'page' }, { id: 'other' }] });
  state.pages = { page: state.slide, other: { id: 'other', shapes: [{ id: 'other-text', type: 'text', txBody: { p: [{ r: [{ t: 'Keep this slide' }] }] } }] } };
  state.slide = state.pages.other;
  return { ...f, args: { fileId: 'file', pageId: 'page', title: 'Pinned edit', audience: 'Readers', objective: 'Update original',
    slides: [{ title: 'Pinned edit', purpose: 'Explain', layout: 'svg', svg: '<svg viewBox="0 0 1280 720"><text x="80" y="100">Updated original</text></svg>' }] } };
}

test('submitted slide is replaced after navigation and the viewed slide is restored', async () => {
  const { state, tools, args } = pinnedEditFixture();
  const otherBefore = structuredClone(state.pages.other);
  const result = await tools.executeTool('desq_create_deck', args, { replaceCurrent: true });
  assert.equal(result.ok, true, result.error);
  assert.deepEqual(result.result.pageIds, ['page']);
  assert.equal(state.pages.page.shapes[0].txBody.p[0].r[0].t, 'Updated original');
  assert.deepEqual(state.pages.other, otherBefore);
  assert.equal(state.slide.id, 'other');
  assert.deepEqual(state.navigations, ['page', 'other']);
  assert.equal(state.saves, 1);
});

test('deleted target and changed document never redirect a submitted edit', async () => {
  for (const change of ['delete', 'document']) {
    const { state, tools, args } = pinnedEditFixture();
    if (change === 'delete') state.file.slides = state.file.slides.filter(slide => slide.id !== 'page');
    else state.file.id = 'different-file';
    const result = await tools.executeTool('desq_create_deck', args, { replaceCurrent: true });
    assert.equal(result.ok, false);
    assert.match(result.error, change === 'delete' ? /submitted slide no longer exists/ : /open document changed/);
    assert.equal(state.replaced, undefined);
    assert.equal(state.saves, 0);
    assert.equal(state.slide.id, 'other');
  }
});

test('navigation during slide preparation does not cancel or retarget replacement', async () => {
  const { state, tools, args } = pinnedEditFixture();
  state.slide = state.pages.page;
  const result = await tools.executeTool('desq_create_deck', args, { replaceCurrent: true, onProgress: message => {
    if (message === 'Checking deck structure and text layout…') state.slide = state.pages.other;
  } });
  assert.equal(result.ok, true, result.error);
  assert.equal(state.pages.page.shapes[0].txBody.p[0].r[0].t, 'Updated original');
  assert.equal(state.pages.other.shapes[0].txBody.p[0].r[0].t, 'Keep this slide');
  assert.equal(state.slide.id, 'other');
});


test('deck thumbnails rebuild only after all slides are saved, and completion waits for the last preview', async () => {
  const {state,tools}=fixture();Object.assign(state.file,{width:1280,height:720,layouts:[{id:'layout'}]});
  const previews=[];
  let release, begun;
  const started=new Promise(resolve=>{begun=resolve;});
  const lastPreview=new Promise(resolve=>{release=resolve;});
  state.onThumbnail=async(id,options)=>{
    assert.equal(state.saves,3); assert.equal(state.createdSlides.length,3);
    assert.equal(state.slide.id,'generated-page-3');
    assert.equal(options.timeoutMs,60000); previews.push(id);
    if(previews.length===3){begun();await lastPreview;}
  };
  let complete=false;
  const work=tools.executeTool('desq_create_deck',deckInput()).then(result=>{complete=true;return result;});
  await started; assert.equal(complete,false);
  release(); const result=await work;
  assert.equal(result.ok,true,result.error);
  assert.deepEqual(previews,result.result.pageIds);
  assert.equal(state.slide.id,'generated-page-3');
});

test('partial deck insertion still rebuilds previews for committed pages', async () => {
  const {state,tools}=fixture();Object.assign(state.file,{width:1280,height:720,layouts:[{id:'layout'}]});
  let insertions=0;const previews=[];
  state.onPaste=()=>{if(++insertions===2)throw Error('Insertion failed');};
  state.onThumbnail=id=>previews.push(id);
  const result=await tools.executeTool('desq_create_deck',deckInput());
  assert.equal(result.ok,false);assert.match(result.error,/stopped after 1\/3/);
  assert.deepEqual(previews,['generated-page']);
});


function blankStarterFixture() {
  const fixtureResult=fixture();const {state}=fixtureResult;
  Object.assign(state.file,{width:1280,height:720,layouts:[{id:'layout'}]});
  state.slide.shapes=[];
  state.storedSlides={page:structuredClone(state.slide)};
  return fixtureResult;
}

test('a sole empty starter is removed only after all generated slides are persisted', async () => {
  const {state,tools}=blankStarterFixture();
  state.onPaste=()=>assert.ok(state.file.slides.some(s=>s.id==='page'));
  state.onSave=()=>{if(!state.file.slides.some(s=>s.id==='page'))assert.equal(state.createdSlides.length,3);};
  state.onThumbnail=()=>assert.ok(!state.file.slides.some(s=>s.id==='page'));
  const result=await tools.executeTool('desq_create_deck',deckInput());
  assert.equal(result.ok,true,result.error);
  assert.deepEqual(state.file.slides.map(s=>s.id),result.result.pageIds);
  assert.equal(state.saves,4);
  assert.equal(state.slide.id,'generated-page-3');
});

test('single-slide generation also removes the sole empty starter', async () => {
  const {state,tools}=blankStarterFixture();
  const result=await tools.executeTool('desq_create_slide',{fileId:'file',pageId:'page',title:'Hello'});
  assert.equal(result.ok,true,result.error);
  assert.deepEqual(state.file.slides.map(s=>s.id),[result.result.pageId]);
});

test('starter cleanup preserves partial decks, multiple existing slides and newly added starter content', async () => {
  for(const scenario of ['partial','multiple','edited','image']) {
    const {state,tools}=blankStarterFixture();
    if(scenario==='multiple')state.file.slides.push({id:'existing'});
    if(scenario==='image')state.slide.bg={bgPr:{blipFill:{blip:{$_rEmbed:'photo'}}}};
    let insertions=0;
    state.onPaste=()=>{
      if(scenario==='partial'&&++insertions===2)throw Error('Failed insertion');
      if(scenario==='edited')state.storedSlides.page.shapes=[{id:'user-content'}];
    };
    const result=await tools.executeTool('desq_create_deck',deckInput());
    assert.equal(result.ok,scenario!=='partial',result.error);
    assert.ok(state.file.slides.some(s=>s.id==='page'),scenario);
  }
});

test('failed thumbnails retry after the complete first pass and finish before returning', async () => {
  const {state,tools}=fixture();Object.assign(state.file,{width:1280,height:720,layouts:[{id:'layout'}]});
  const calls=[];
  state.onThumbnail=id=>{ calls.push(id); if(id==='generated-page-2' && calls.length===2) throw Error('Transient renderer failure'); };
  const result=await tools.executeTool('desq_create_deck',deckInput());
  assert.equal(result.ok,true,result.error);
  assert.deepEqual(calls,['generated-page','generated-page-2','generated-page-3','generated-page-2']);
  assert.equal(result.result.warnings.some(w=>w.startsWith('Thumbnail not refreshed')),false);
});

test('agent registers SVG Google Fonts before inserting and rendering thumbnails, preserving local fonts', async () => {
  const {state,tools}=fixture();Object.assign(state.file,{width:1280,height:720,layouts:[{id:'layout'}],fonts:[{family:'Lato',type:'local',name:'lato.woff'}]});
  const expected=[{family:'Lato',type:'local',name:'lato.woff'},{family:'Space Grotesk',type:'google'},{family:'Inter',type:'google'}];
  state.onPaste=()=>assert.deepEqual(state.file.fonts,expected);
  state.onThumbnail=()=>assert.deepEqual(state.file.fonts,expected);
  const result=await tools.executeTool('desq_create_deck',{fileId:'file',pageId:'page',title:'Fonts',audience:'Readers',objective:'Check typography',slides:[{title:'Type',purpose:'Show text',layout:'svg',svg:'<svg viewBox="0 0 1280 720" font-family="Inter"><text x="80" y="100" font-family="Space Grotesk">Heading</text><text x="80" y="200">Body</text><text x="80" y="300" font-family="Lato">Embedded</text></svg>'}]});
  assert.equal(result.ok,true,result.error);
  assert.deepEqual(state.file.fonts,expected);
});
