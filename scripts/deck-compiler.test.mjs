import test from 'node:test';
import assert from 'node:assert/strict';
import { compileDeck, deckImageRequests } from '../editor-vuejs/src/lib/agent/deck-compiler.mjs';
import { deckSchema } from '../editor-vuejs/src/lib/agent/deck-schema.mjs';
import { validateArguments, createEditorTools } from '../editor-vuejs/src/lib/agent/editor-tools.mjs';
import { parseToolPlan } from '../editor-vuejs/src/lib/agent/local-agent.mjs';
import { createGeminiAgent } from '../editor-vuejs/src/lib/agent/gemini-agent.mjs';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

let sequence = 0;
const options = { width: 1280, height: 720, genId: () => `deck-${++sequence}`, geometry: (p, w, h) => ({ d: `R0,0,${w},${h}` }) };
const spec = () => ({ title: 'Energy strategy', audience: 'Business leaders', objective: 'Choose next steps', design: { accent: '#087F75' }, slides: [
  { title: 'Energy strategy', purpose: 'Introduce the decision', layout: 'cover', subtitle: 'An actionable plan' },
  { title: 'Why act', purpose: 'Explain motivation', layout: 'content', bullets: ['Improve resilience', 'Evaluate costs', 'Plan a phased rollout'] },
  { title: 'Options', purpose: 'Compare two options', layout: 'comparison', items: [{ title: 'Pilot', body: 'Start with a small installation.' }, { title: 'Scale', body: 'Expand after measuring results.' }] },
  { title: 'Roadmap', purpose: 'Sequence implementation', layout: 'timeline', items: [{ title: 'Assess', body: 'Gather requirements.' }, { title: 'Test', body: 'Run a pilot.' }, { title: 'Decide', body: 'Review outcomes.' }] },
  { title: 'Illustrative targets', purpose: 'Explain sample targets', layout: 'metrics', items: [{ value: '3', title: 'Sites', body: 'Illustrative pilot scope' }, { value: '90 days', title: 'Review window', body: 'Illustrative timeline' }] },
  { title: 'Next steps', purpose: 'Ask for a decision', layout: 'closing', subtitle: 'Approve a discovery workshop.' },
] });
const element = (extra) => ({ x: 54, y: 170, width: 1172, height: 450, ...extra });
const textOf = shape => shape.txBody?.p.flatMap(p => p.r.map(r => r.t)).join('\n');

test('missing images compile to editable placeholders with visible description and no false credits', () => {
  const deck = spec(), descriptor = { query: 'Solar panels under a blue sky', alt: 'Solar panels' };
  deck.slides[1].images = [descriptor];
  const result = compileDeck(deck, { ...options, assets: new Map([['1:hero', { placeholder: true, warning: 'Image unavailable' }]]) });
  const shapes = result.pages[1].shapes;
  assert.ok(shapes.some(s => s.imagePlaceholder?.description === descriptor.query));
  assert.ok(shapes.some(s => textOf(s)?.includes(descriptor.query)));
  assert.ok(!shapes.some(s => s.blipFill)); assert.ok(result.warnings.includes('Image unavailable'));
});

test('deck layouts compile to editable native objects with unique IDs, shared design and paragraph bullets', () => {
  const deck = spec(); validateArguments(deckSchema, deck);
  const result = compileDeck(deck, options);
  assert.equal(result.pages.length, 6);
  const ids = result.pages.flatMap(p => p.shapes.map(s => s.id));
  assert.equal(new Set(ids).size, ids.length);
  const bullets = result.pages[1].shapes.filter(s => s.txBody?.p.some(p => p.pPr.buChar));
  assert.equal(bullets.length, 1); assert.equal(bullets[0].txBody.p.length, 3);
  assert.equal(result.pages.every(p => p.showMaster === '0' && p.agentMetadata.audience === deck.audience), true);
  assert.equal(result.pages[0].shapes.some(s => textOf(s) === deck.slides[0].title), true);
  assert.equal(result.pages[2].shapes.some(s => textOf(s) === 'Pilot'), true);
  assert.doesNotThrow(() => JSON.stringify(result));
});

test('rich text, arbitrary presets, native tables and chart data survive JSON serialization', () => {
  const deck = spec(); deck.slides[1] = { title: 'Evidence', purpose: 'Show supplied data', layout: 'custom', elements: [
    element({ kind: 'table', width: 550, rows: [['Option', 'Cost'], ['A', '$10'], ['B', '$20']] }),
    element({ kind: 'chart', x: 650, width: 576, chartType: 'bar', categories: ['A', 'B'], series: [{ name: 'Cost', values: [10, 20] }], dataLabel: 'Illustrative data, USD' }),
  ] };
  deck.slides[2] = { title: 'Diagram', purpose: 'Illustrate a relation', layout: 'custom', elements: [
    element({ kind: 'shape', width: 200, height: 200, shape: 'star5' }),
    element({ kind: 'text', x: 330, width: 800, paragraphs: [{ runs: [{ text: 'Important ', bold: true }, { text: 'finding', italic: true }] }] }),
  ] };
  validateArguments(deckSchema, deck);
  const pages = JSON.parse(JSON.stringify(compileDeck(deck, options).pages));
  assert.equal(pages[1].shapes.find(s => s.type === 'table').graphic.graphicData.tbl.tr[1].tc[0].txBody.p[0].r[0].t, 'A');
  assert.deepEqual(pages[1].shapes.find(s => s.type === 'chart').chartData.series[0].data, [10, 20]);
  const chartPart = pages[1].shapes.find(s => s.type === 'chart').graphic.graphicData['c:chart'].chartJson;
  assert.deepEqual(chartPart['c:chartSpace']['c:chart']['c:plotArea']['c:barChart']['c:ser'][0]['c:val']['c:numLit']['c:pt'].map(p => p['c:v']), ['10', '20']);
  assert.equal(pages[2].shapes.some(s => s.prstGeom?.$_prst === 'star5'), true);
  const rich = pages[2].shapes.find(s => s.name === 'Text').txBody.p[0].r;
  assert.equal(rich[0].rPr.$_b, 1); assert.equal(rich[1].rPr.$_i, 1);
});

test('generated charts satisfy the real Savanna PPTX chart serializer contract', () => {
  const path = 'shared-vuejs/src/edlib/pptx/export/gen-shape.ts';
  const source = ts.createSourceFile(path, fs.readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
  const fn = source.statements.find(s => s.name?.text === 'genChart');
  const context = { structuredClone, nodeAsArray: x => Array.isArray(x) ? x : [x], getNextRId: () => 'rId1' };
  vm.runInNewContext(ts.transpileModule(fn.getText(source), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  for (const chartType of ['bar', 'line', 'pie']) {
    const deck = spec(); deck.slides[1] = { title: 'Data', purpose: 'Explain', layout: 'custom', elements: [element({ kind: 'chart', chartType,
      categories: ['A', 'B'], series: [{ name: 'Cost', values: [10,20] }], dataLabel: 'Illustrative, USD' })] };
    const chart = compileDeck(deck, options).pages[1].shapes.find(s => s.type === 'chart');
    const out = {}, packageParts = { '[Content_Types].xml': { Types: { Override: [] } } };
    context.genChart(chart, out, 'ppt/slides/_rels/slide1.xml.rels', packageParts);
    assert.equal(out.graphic.graphicData['c:chart']['$_r:id'], 'rId1');
    assert.equal(packageParts['[Content_Types].xml'].Types.Override[0].$_PartName, '/ppt/charts/chart1.xml');
    assert.ok(packageParts['ppt/charts/chart1.xml']['c:chartSpace']['c:chart']['c:plotArea'][`c:${chartType}Chart`]);
  }
});

test('invalid charts, ragged tables, text overflow and unsafe element bounds fail before insertion', () => {
  const bad = [
    element({ kind: 'table', rows: [['a', 'b'], ['c']] }),
    element({ kind: 'chart', chartType: 'bar', categories: ['a'], series: [{ name: 'X', values: [1, 2] }], dataLabel: 'Example' }),
    element({ kind: 'chart', chartType: 'pie', categories: ['a'], series: [{ name: 'X', values: [-1] }], dataLabel: 'Example' }),
    element({ kind: 'chart', chartType: 'bar', categories: ['a'], series: [{ name: 'X', values: [1] }] }),
    element({ kind: 'text', text: 'Long text '.repeat(100), width: 100, height: 20 }),
    element({ kind: 'shape', shape: 'rect', x: 1200, width: 200 }),
    element({ kind: 'shape' }),
  ];
  for (const e of bad) {
    const deck = spec(); deck.slides[1] = { title: 'Invalid', purpose: 'Test', layout: 'custom', elements: [e] };
    assert.throws(() => compileDeck(deck, options));
  }
});

test('schema rejects scripts, URLs, excessive slides and unrecognized presets', () => {
  for (const mutate of [d => d.slides[0].script = 'alert(1)', d => d.slides = Array(21).fill(d.slides[0]),
    d => d.slides[1].elements = [element({ kind: 'image', query: 'sun', alt: 'Sun', url: 'https://invalid' })],
    d => d.slides[1].elements = [element({ kind: 'shape', shape: 'unknown' })]]) {
    const d = spec(); mutate(d); assert.throws(() => validateArguments(deckSchema, d));
  }
});

test('image manifests, credit attribution and dimensional scaling retain native image references', () => {
  const deck = spec(); deck.slides[1].images = [{ query: 'solar panels', alt: 'Solar panels' }];
  const requests = deckImageRequests(deck); assert.equal(requests.length, 1);
  const assets = new Map([[requests[0].key, { media: { name: 'photo.webp', w: 800, h: 600 }, title: 'Solar', author: 'Author', license: 'CC BY', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Solar.jpg' }]]);
  const result = compileDeck(deck, { ...options, width: 1920, height: 1080, assets });
  const picture = result.pages[1].shapes.find(s => s.type === 'image');
  assert.equal(picture.blipFill.blip.$_target, 'photo.webp');
  assert.equal(result.pages[1].shapes.some(s => textOf(s)?.includes('CC BY')), true);
  assert.ok(result.pages[0].bg.bgPr.solidFill);
  assert.ok(!result.pages[0].shapes.some(shape => shape.name === 'Background'));
  assert.ok(result.pages[0].shapes.every(shape => shape.x + shape.w <= 1920));
});

test('deck plans bind captured document and page and cannot mix creation with other calls', () => {
  const tools = createEditorTools({}).listTools();
  const call = { name: 'savanna_create_deck', arguments: spec() };
  const plan = parseToolPlan(JSON.stringify({ message: 'Build the deck', calls: [call] }), tools, { document: { fileId: 'file' }, page: { pageId: 'page' } });
  assert.equal(plan.calls[0].arguments.fileId, 'file'); assert.equal(plan.calls[0].arguments.pageId, 'page');
  assert.throws(() => parseToolPlan(JSON.stringify({ message: '', calls: [call, call] }), tools), /one creation call/);
});

test('cloud deck validation repairs a bad draft once before exposing an executable plan', async () => {
  const requests = [], tools = createEditorTools({}).listTools();
  const bad = spec(); delete bad.slides[1].bullets;
  bad.slides[1].layout = 'custom'; bad.slides[1].elements = [element({ kind: 'table', rows: [['a','b'],['c']] })];
  const agent = createGeminiAgent('test', async (path, { body }) => {
    requests.push(body);
    return { text: JSON.stringify({ message: 'A deck', calls: [{ name: 'savanna_create_deck', arguments: requests.length === 1 ? bad : spec() }] }), inferenceMs: 1, inputTokens: 10 };
  });
  const plan = await agent.plan('Build a professional deck', tools, { document: { fileId: 'f', width: 1280, height: 720 }, page: { pageId: 'p', shapes: [] } });
  assert.equal(requests.length, 2); assert.match(requests[1].context.deckRepair.validationError, /rectangular/);
  assert.equal(plan.metrics.repaired, true); assert.equal(plan.metrics.inputTokens, 20);
  assert.equal(plan.calls[0].arguments.slides.length, 6); agent.dispose();
});

test('unrepairable drafts stop after one correction and provider failures are never retried', async () => {
  let count = 0;
  const tools = createEditorTools({}).listTools(), context = { document: { fileId: 'f' }, page: { pageId: 'p', shapes: [] } };
  const agent = createGeminiAgent('test', async () => { count++; return { text: '{"calls":[{"name":"savanna_create_deck"}]}' }; });
  await assert.rejects(agent.plan('Build a deck', tools, context)); assert.equal(count, 2); agent.dispose();
  count = 0;
  const unavailable = createGeminiAgent('test', async () => { count++; throw new Error('quota exhausted'); });
  await assert.rejects(unavailable.plan('Build a deck', tools, context), /quota/); assert.equal(count, 1); unavailable.dispose();
});

test('long image source URLs become compact linked credits without blocking native slides',()=>{
  const url='https://commons.wikimedia.org/wiki/File:'+('Solar_panels_'.repeat(300))+'.jpg';
  const asset={title:'Solar panels',author:'Photographer',license:'CC BY 4.0',sourceUrl:url,media:{name:'solar.png',w:400,h:300}};
  const deck={...spec(),slides:[{title:'Solar',purpose:'Explain',layout:'svg',svg:'<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720"><image x="50" y="50" width="400" height="300" data-query="solar panels" aria-label="Solar panels"/></svg>'}]};
  const result=compileDeck(deck,{...options,assets:new Map([['0:svg:0',asset]])});
  assert.equal(result.pages.length,1);
  const image=result.pages[0].shapes.find(s=>s.blipFill);
  assert.equal(image.imageSource.url,url);
  const footer=result.pages[0].shapes.find(s=>s.name==='Image credits');
  assert.match(textOf(footer),/Solar panels.*Photographer.*CC BY 4.0/);
  assert.ok(footer.txBody.p[0].r.some(r=>r.t.includes('Source')&&r.rPr.hlinkClick?.$_target===url));
  assert.ok(!textOf(footer).includes(url));
});

test('unfittable attribution retains a placeholder and full credit metadata while other images remain',()=>{
  const asset={title:'Solar',author:'A very long attribution '.repeat(500),license:'CC BY',sourceUrl:'https://example.com/source',media:{name:'solar.png',w:400,h:300}};
  const good={...asset,title:'Wind',author:'Photographer',sourceUrl:'https://example.com/wind',media:{name:'wind.png',w:400,h:300}};
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720"><image x="50" y="50" width="400" height="300" data-query="solar panels" aria-label="Solar panels"/><image x="500" y="50" width="400" height="300" data-query="wind turbines" aria-label="Wind turbines"/></svg>';
  const result=compileDeck({...spec(),slides:[{title:'Energy',purpose:'Explain',layout:'svg',svg}]},{...options,assets:new Map([['0:svg:0',asset],['0:svg:1',good]])});
  const page=result.pages[0];
  assert.equal(result.pages.length,1);
  assert.equal(page.shapes.filter(s=>s.blipFill).length,1);
  assert.ok(page.shapes.some(s=>s.imagePlaceholder));
  assert.ok(result.warnings.some(w=>w.includes('attribution')));
  assert.equal(page.agentMetadata.imageCredits[0].author,asset.author);
  const footer=page.shapes.find(s=>s.name==='Image credits');
  assert.match(textOf(footer),/Wind/);assert.ok(!textOf(footer).includes('Solar'));
});
