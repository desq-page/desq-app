import test from 'node:test';
import assert from 'node:assert/strict';
import { authoringEffort } from '../editor-vuejs/src/lib/agent/authoring-effort.mjs';
import { compactModelContext, parseToolPlan } from '../editor-vuejs/src/lib/agent/agent-plan.mjs';
import { editorPlanInstructions } from '../editor-vuejs/src/lib/agent/plan-instructions.mjs';
import { createEditorTools } from '../editor-vuejs/src/lib/agent/editor-tools.mjs';
import { checkedCloudPlan } from '../editor-vuejs/src/lib/agent/deck-preflight.mjs';
import { designSample } from './deck-design-sample.mjs';
const tools = createEditorTools({}).listTools();
const context = { document: { fileId: 'file', width: 1280, height: 720 }, page: { pageId: 'page', shapes: [], shapeCount: 0 } };
const response = () => ({ text: JSON.stringify({ message: 'Deck', calls: [{ name: 'desq_create_deck', arguments: designSample() }] }), inferenceMs: 10, inputTokens: 20 });

test('Quickly keywords select quick workflow; explicit effort survives context compaction and wins', () => {
  assert.equal(authoringEffort('Create slides quickly'), 'quick');
  assert.equal(authoringEffort('Create slides'), 'detailed');
  assert.equal(authoringEffort('Create slides quickly', { authoringEffort: 'detailed' }), 'detailed');
  assert.equal(compactModelContext({ ...context, authoringEffort: 'quick' }).authoringEffort, 'quick');
  assert.match(editorPlanInstructions(tools, { effort: 'quick' }), /QUICK GENERATE PROFILE/);
  assert.ok(!editorPlanInstructions(tools, { effort: 'quick' }).includes('STRATEGIST:'));
  assert.match(editorPlanInstructions(tools), /STRATEGIST:/);
});

test('quick cloud generation validates and previews a valid deck with one inference; detailed reviews it', async () => {
  for (const effort of ['quick', 'detailed']) {
    const requests = [], previews = [];
    const taskContext = { ...context, authoringEffort: effort };
    const result = await checkedCloudPlan({ tools, context: taskContext, parse: parseToolPlan, body: { command: 'Create a presentation', context: taskContext },
      request: async (path, options) => { requests.push(options.body); return response(); }, onPreview: proof => previews.push(proof) });
    assert.equal(requests.length, effort === 'quick' ? 1 : 2);
    assert.equal(result.response.reviewed, effort === 'detailed');
    assert.ok(previews.length > 0);
    assert.ok(result.plan.calls[0].arguments.slides.length > 0);
  }
});

test('quick generation repairs invalid schemas once without an automatic design review', async () => {
  const requests = [];
  const taskContext = { ...context, authoringEffort: 'quick' };
  const result = await checkedCloudPlan({ tools, context: taskContext, parse: parseToolPlan, body: { command: 'Create a presentation', context: taskContext },
    request: async (path, options) => {
      requests.push(options.body);
      const draft = response();
      if (requests.length === 1) { const json = JSON.parse(draft.text); json.calls[0].arguments.fontSize = 32; draft.text = JSON.stringify(json); }
      return draft;
    } });
  assert.equal(requests.length, 2);
  assert.match(requests[1].context.deckRepair.validationError, /fontSize/);
  assert.equal(requests[1].context.deckReview, undefined);
  assert.equal(result.response.repaired, true);
  assert.equal(result.response.reviewed, false);
  assert.equal(result.response.inferenceMs, 20);
});

test('quick generation rejects persistently invalid output before any edits', async () => {
  let calls = 0;
  const taskContext = { ...context, authoringEffort: 'quick' };
  await assert.rejects(checkedCloudPlan({ tools, context: taskContext, parse: parseToolPlan,
    body: { command: 'Create slides', context: taskContext }, request: async () => { calls++; return { text: JSON.stringify({ calls: [{ name: 'desq_create_deck', arguments: {} }] }) }; } }), /Missing argument/);
  assert.equal(calls, 2);
});

test('SVG tab exposes only the SVG transport and preserves the mode in compact context', () => {
  const original = JSON.stringify(tools);
  const instructions = editorPlanInstructions(tools, { effort: 'quick', slideAuthoring: 'svg' });
  const exposed = JSON.parse(instructions.split('Tool schemas: ')[1]);
  const slide = exposed.find(tool => tool.name === 'desq_create_deck').inputSchema.properties.slides.items;
  assert.deepEqual(slide.properties.layout.enum, ['svg']);
  assert.ok(slide.required.includes('svg'));
  assert.equal(slide.properties.elements, undefined);
  assert.equal(JSON.stringify(tools), original);
  assert.equal(compactModelContext({ ...context, slideAuthoring: 'svg' }).slideAuthoring, 'svg');
});

test('one-slide full-canvas legacy output is corrected to SVG before insertion', async () => {
  const taskContext = { ...context, slideAuthoring: 'svg', authoringEffort: 'quick' };
  const requests = [];
  const deck = { title: 'Test', audience: 'Readers', objective: 'Explain', slides: [
    { title: 'Test', purpose: 'Explain', layout: 'custom', elements: [
      { kind: 'shape', shape: 'rect', x: 0, y: 0, width: 1280, height: 720, fill: '#FFFFFF' },
    ] },
  ] };
  const result = await checkedCloudPlan({ tools, context: taskContext, parse: parseToolPlan,
    body: { command: 'Create exactly 1 slide', context: taskContext }, request: async (path, options) => {
      requests.push(options.body);
      if (requests.length === 2) deck.slides = [{ title: 'Test', purpose: 'Explain', layout: 'svg',
        svg: '<svg viewBox="0 0 1280 720"><rect width="1280" height="720" fill="#FFFFFF"/><text x="80" y="100">Test</text></svg>' }];
      return { text: JSON.stringify({ message: 'Slide', calls: [{ name: 'desq_create_deck', arguments: deck }] }) };
    } });
  assert.equal(requests.length, 2);
  assert.match(requests[1].context.deckRepair.validationError, /requires layout=svg/);
  assert.equal(result.plan.calls[0].arguments.slides[0].layout, 'svg');
  assert.equal(result.response.repaired, true);
});
