import test from 'node:test';
import assert from 'node:assert/strict';
import { compileDeck } from '../editor-vuejs/src/lib/agent/deck-compiler.mjs';
import { DECK_PALETTES, deckDesign, contrastRatio, legibleInk, reviewDeck } from '../editor-vuejs/src/lib/agent/deck-design.mjs';
import { deckLayoutPreviews } from '../editor-vuejs/src/lib/agent/deck-preview.mjs';
import { deckSchema } from '../editor-vuejs/src/lib/agent/deck-schema.mjs';
import { createEditorTools, validateArguments } from '../editor-vuejs/src/lib/agent/editor-tools.mjs';
import { createGeminiAgent, geminiRequest } from '../editor-vuejs/src/lib/agent/gemini-agent.mjs';
import { createChatGPTAgent, chatgptRequest } from '../editor-vuejs/src/lib/agent/chatgpt-agent.mjs';
import { DECK_AUTHORING_VERSION } from '../editor-vuejs/src/lib/agent/deck-authoring.mjs';
import { designSample, helloWorldSample, HELLO_WORLD_PROMPT } from './deck-design-sample.mjs';
import { wrapDeckText } from '../editor-vuejs/src/lib/agent/deck-text.mjs';

let id = 0;
const options = { width: 1280, height: 720, genId: () => `design-${++id}`, geometry: (p, w, h) => ({ d: `R0,0,${w},${h}` }) };
const textOf = shape => shape.txBody?.p.flatMap(p => p.r.map(r => r.t)).join('\n') || '';

test('all palettes and new compositions preserve content, safe bounds and readable color contrast at multiple sizes', () => {
  for (const palette of Object.keys(DECK_PALETTES)) for (const size of [720, 1080]) {
    const deck = designSample(); deck.design.palette = palette;
    const before = structuredClone(deck); validateArguments(deckSchema, deck);
    const compiled = compileDeck(deck, { ...options, width: size * 16 / 9, height: size });
    assert.deepEqual(deck, before); assert.equal(compiled.pages.length, deck.slides.length);
    const ids = compiled.pages.flatMap(page => page.shapes.map(s => s.id)); assert.equal(new Set(ids).size, ids.length);
    for (const [i, page] of compiled.pages.entries()) {
      assert.ok(page.shapes.some(s => textOf(s) === deck.slides[i].title));
      for (const item of deck.slides[i].items || []) assert.ok(page.shapes.some(s => textOf(s) === item.title));
      for (const s of page.shapes) {
        assert.ok([s.x, s.y, s.w, s.h].every(Number.isFinite));
        assert.ok(s.x >= 0 && s.y >= 0 && s.x + s.w <= size * 16 / 9 + .01 && s.y + s.h <= size + .01, `${page.name}: ${s.name} exceeds canvas`);
      }
    }
    assert.equal(reviewDeck(deck, compiled).findings.filter(f => /contrast|small body/.test(f)).length, 0);
    assert.ok(compiled.pages[5].shapes.some(s => s.prstGeom?.$_prst === 'chevron'));
    assert.ok(compiled.pages[7].shapes.some(s => s.name === 'Timeline rail'));
    assert.ok(compiled.pages[6].shapes.some(s => s.name === 'Spoke'));
    assert.equal(new Set(compiled.pages.map(p => p.bg.bgPr.solidFill.uniClr.$_val)).size, 1);
  }
});

test('explicit design overrides and tones are respected; contrast checks identify unreadable colors', () => {
  const deck = designSample(); deck.design = { background: '#FFFFFF', foreground: '#FFFFEE', accent: '#FFDDAA', secondary: '#000080', dark: '#110022' };
  deck.slides[0].tone = 'base'; deck.slides[0].variant = 'band';
  const compiled = compileDeck(deck, options);
  assert.equal(compiled.pages[0].bg.bgPr.solidFill.uniClr.$_val, 'FFFFFF');
  assert.ok(reviewDeck(deck, compiled).findings.some(f => f.includes('contrast')));
  assert.equal(deckDesign(deck.design).accent, '#FFDDAA');
  assert.ok(contrastRatio(legibleInk('#FFDDAA'), '#FFDDAA') > 4.5);
  assert.throws(() => deckDesign({ palette: 'unknown' }), /palette/);
});

test('quality review detects repeated native compositions including custom slides', () => {
  const slide = { title: 'A clear point', purpose: 'Explain', layout: 'custom', elements: [{ kind: 'text', x: 54, y: 170, width: 1000, height: 400, text: 'An explanation' }] };
  const deck = { title: 'Repeated', audience: 'Leaders', objective: 'Learn', slides: Array.from({ length: 5 }, () => structuredClone(slide)) };
  assert.ok(reviewDeck(deck, compileDeck(deck, options)).findings.some(f => /three repeated/.test(f)));
});

test('layout proofs are bounded, escaped inert images with native composition cues', () => {
  const deck = designSample(); deck.slides[0].title = '<script>alert("x")</script>';
  const previews = deckLayoutPreviews(compileDeck(deck, options));
  assert.equal(previews.length, 6);
  const svg = decodeURIComponent(previews[0].url.split(',').slice(1).join(','));
  assert.ok(svg.includes('&lt;script&gt;')); assert.ok(!svg.includes('<script>')); assert.ok(svg.includes('<ellipse'));
  assert.ok(!svg.includes('foreignObject')); assert.ok(!svg.includes('href='));
});

test('both cloud providers review a valid draft once, report previews and keep ordinary edits to one request', async () => {
  const tools = createEditorTools({}).listTools(), context = { document: { fileId: 'f', width: 1280, height: 720 }, page: { pageId: 'p', shapes: [] } };
  for (const create of [createGeminiAgent, createChatGPTAgent]) {
    const requests = [], previews = [], progress = [];
    const agent = create('test', async (path, { body }) => {
      requests.push(body); return { text: JSON.stringify({ message: 'Drafted a deck', calls: [{ name: 'savanna_create_deck', arguments: designSample() }] }), inferenceMs: 2, inputTokens: 7 };
    });
    const plan = await agent.plan('Create a deck', tools, context, { onPreview: p => previews.push(p), onProgress: p => progress.push(p) });
    assert.equal(requests.length, 2); assert.equal(requests[1].context.deckReview.storyboard.length, 10);
    assert.equal(requests[1].context.deckReview.storyboard[2].takeaway, 'Learn before expanding');
    assert.equal(plan.metrics.reviewed, true); assert.equal(plan.metrics.inputTokens, 14); assert.equal(plan.metrics.inferenceMs, 4);
    assert.equal(previews.length, 2); assert.ok(progress.some(p => p.includes('Reviewing'))); agent.dispose();
    let count = 0;
    const edit = create('test', async () => { count++; return { text: JSON.stringify({ message: 'Hello', calls: [] }) }; });
    await edit.plan('Hello', tools, context); assert.equal(count, 1); edit.dispose();
  }
});

test('cancellation between draft and review prevents the second request', async () => {
  let count = 0;
  const agent = createGeminiAgent('test', async () => { count++; return { text: JSON.stringify({ message: 'Deck', calls: [{ name: 'savanna_create_deck', arguments: designSample() }] }) }; });
  await assert.rejects(agent.plan('Create a deck', createEditorTools({}).listTools(), { document: { fileId: 'f' }, page: { pageId: 'p' } }, { onPreview: () => agent.dispose() }));
  // The request boundary must check cancellation even if preview callbacks stop the agent.
  assert.equal(count, 1);
});

test('design review cannot change the slide count, switch to edit tools or retry failed inference', async () => {
  const tools = createEditorTools({}).listTools(), context = { document: { fileId: 'f' }, page: { pageId: 'p' } };
  for (const mode of ['count', 'tool', 'network']) {
    let count = 0;
    const agent = createChatGPTAgent('test', async () => {
      count++;
      if (count === 2 && mode === 'network') throw Error('Provider unavailable');
      const deck = designSample();
      if (count === 2 && mode === 'count') deck.slides.pop();
      const calls = count === 2 && mode === 'tool' ? [] : [{ name: 'savanna_create_deck', arguments: deck }];
      return { text: JSON.stringify({ message: 'Draft', calls }) };
    });
    await assert.rejects(agent.plan('Create a deck', tools, context), mode === 'count' ? /slide count/ : mode === 'network' ? /unavailable/ : /one complete deck/);
    assert.equal(count, 2); agent.dispose();
  }
});

test('maximum item counts with subtitles stay within the canvas for each new item layout', () => {
  for (const [layout, count] of [['agenda', 6], ['process', 5], ['hub-spoke', 4]]) {
    const deck = designSample(); deck.slides = [deck.slides[0], { title: 'A clear explanation', purpose: 'Explain', layout, subtitle: 'A short supporting line', takeaway: 'The central idea',
      items: Array.from({ length: count }, (_, i) => ({ title: `Step ${i + 1}`, body: 'A short explanation.' })) }];
    const compiled = compileDeck(deck, options);
    assert.ok(compiled.pages[1].shapes.every(s => s.y + s.h <= 720));
  }
});

test('word wrapping preserves whitespace-separated words and handles unspaced languages', () => {
  assert.deepEqual(wrapDeckText('Learn before expanding', 140, 18), ['Learn', 'before', 'expanding']);
  const cjk = '面向业务团队的演示文稿';
  assert.equal(wrapDeckText(cjk, 50, 18).join(''), cjk);
  assert.ok(wrapDeckText('Two short words', 500, 18, 'Arial', text => text.length * 5).length === 1);
});

test('the exact Hello World brief repairs text/image-only output into a native three-column content page', async () => {
  const tools = createEditorTools({}).listTools(), context = { document: { fileId: 'f', width: 1280, height: 720 }, page: { pageId: 'p' } };
  for (const create of [createChatGPTAgent, createGeminiAgent]) {
    const requests = [];
    const agent = create('test', async (path, { body }) => {
      requests.push(body);
      const deck = helloWorldSample();
      if (requests.length < 2) {
        const middle = deck.slides[1];
        middle.layout = 'content'; middle.bullets = middle.items.map(item => item.body); delete middle.items;
        middle.images = [{ query: 'colorful hello world abstract', alt: 'Hello World illustration' }];
      }
      return { text: JSON.stringify({ message: 'A Hello World deck', calls: [{ name: 'savanna_create_deck', arguments: deck }] }) };
    });
    const plan = await agent.plan(HELLO_WORLD_PROMPT, tools, context);
    assert.equal(requests.length, 2); assert.match(requests[1].context.deckRepair.validationError, /no informational native shapes/);
    assert.equal(requests[1].context.deckReview, undefined);
    const deck = plan.calls[0].arguments;
    assert.deepEqual(deck.slides.map(s => s.layout), ['cover', 'three-column', 'closing']);
    const assets = new Map([[`0:hero`, { placeholder: true }], [`2:hero`, { placeholder: true }]]);
    const native = compileDeck(deck, { ...options, assets });
    const modules = native.pages[1].shapes.filter(s => s.prstGeom?.$_prst === 'roundRect');
    assert.equal(modules.length, 3);
    assert.ok(modules.every(s => s.txBody?.p.length === 2));
    assert.equal(new Set(modules.map(s => s.x)).size, 3);
    assert.equal(new Set(native.pages.map(p => p.bg.bgPr.solidFill.uniClr.$_val)).size, 1);
    agent.dispose();
  }
});

test('persistently basic decks stop after one composition repair; uniform-layout intent remains supported', async () => {
  const tools = createEditorTools({}).listTools(), context = { document: { fileId: 'f' }, page: { pageId: 'p' } };
  for (const uniform of [false, true]) {
    let count = 0;
    const agent = createGeminiAgent('test', async () => {
      count++;
      const deck = helloWorldSample();
      deck.slides = Array.from({ length: 3 }, () => ({ title: 'Hello World', purpose: 'Explain', layout: 'content', bullets: ['A simple greeting'], images: [{ query: 'colorful greeting', alt: 'Greeting' }] }));
      return { text: JSON.stringify({ message: 'Deck', calls: [{ name: 'savanna_create_deck', arguments: deck }] }) };
    });
    if (uniform) { await agent.plan('Create 3 slides using the same layout', tools, context); assert.equal(count, 2); }
    else { await assert.rejects(agent.plan(HELLO_WORLD_PROMPT, tools, context), /Deck composition check failed/); assert.equal(count, 2); }
    agent.dispose();
  }
});

test('custom labeled AutoShapes retain their native text rather than silently discarding it', () => {
  const deck = helloWorldSample();
  deck.slides[1] = { title: 'Hello in a shape', purpose: 'Test editable shape labels', layout: 'custom', elements: [
    { kind: 'shape', shape: 'roundRect', x: 54, y: 180, width: 600, height: 300, text: 'A native editable label', fill: '#087F8C' }] };
  const page = compileDeck(deck, options).pages[1];
  const shape = page.shapes.find(s => s.prstGeom?.$_prst === 'roundRect');
  assert.equal(textOf(shape), 'A native editable label'); assert.equal(shape.$_otag, 'sp');
});

test('OpenAI rejects stale proxy versions while direct Gemini parses Google responses without proxy headers', async t => {
  const previousFetch = globalThis.fetch; t.after(() => { globalThis.fetch = previousFetch; });
  const body = { model: 'test', command: 'Explain', context: { document: { fileId: 'f' }, page: { pageId: 'p' } } };
  for (const request of [chatgptRequest]) {
    globalThis.fetch = async () => Response.json({ text: 'Old protocol' });
    await assert.rejects(request('plan', { body }), /older authoring code/);
    const text = JSON.stringify({ message: 'New code', calls: [] });
    globalThis.fetch = async () => request === chatgptRequest
      ? new Response(`data: ${JSON.stringify({ type: 'response.completed', response: { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text }] }] } })}\n\n`, { headers: { 'Content-Type': 'text/event-stream', 'X-Editor-Agent-Version': DECK_AUTHORING_VERSION } })
      : Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] } }] }, { headers: { 'X-Editor-Agent-Version': DECK_AUTHORING_VERSION } });
    assert.equal((await request('plan', { body })).authoringVersion, DECK_AUTHORING_VERSION);
  }
  const text = JSON.stringify({ message: 'Direct Google', calls: [] });
  globalThis.fetch = async url => {
    assert.ok(String(url).startsWith('https://generativelanguage.googleapis.com/'));
    return String(url).includes('/models?')
      ? Response.json({ models: [{ name: 'models/gemini-test', supportedGenerationMethods: ['generateContent'] }] })
      : Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] } }] });
  };
  await geminiRequest('connect', { body: { apiKey: 'user-key' } });
  assert.equal((await geminiRequest('plan', { body: { ...body, model: 'models/gemini-test' } })).authoringVersion, DECK_AUTHORING_VERSION);
  await geminiRequest('disconnect');
});
