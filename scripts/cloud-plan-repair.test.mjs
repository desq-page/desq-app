import test from 'node:test';
import assert from 'node:assert/strict';
import { checkedCloudPlan } from '../editor-vuejs/src/lib/agent/deck-preflight.mjs';
import { parseToolPlan } from '../editor-vuejs/src/lib/agent/agent-plan.mjs';
import { createEditorTools } from '../editor-vuejs/src/lib/agent/editor-tools.mjs';
const tools = createEditorTools({}).listTools();
const context = { document: { fileId: 'f' }, page: { pageId: 'p' } };
const text = args => JSON.stringify({ message: 'Add text', calls: [{ name: 'savanna_add_text', arguments: args }] });
test('invalid non-deck arguments are repaired once before execution', async () => {
  const requests = [], progress = [];
  const result = await checkedCloudPlan({ tools, context, parse: parseToolPlan,
    body: { command: 'Add hello', context }, onProgress: message => progress.push(message),
    request: async (path, options) => {
      requests.push(options.body);
      return { text: requests.length === 1 ? text({ text: 'Hello', fontSize: 24 }) : text({ text: 'Hello' }), inferenceMs: 10 };
    } });
  assert.equal(requests.length, 2);
  assert.match(requests[1].context.planRepair.validationError, /savanna_add_text: Unknown argument: fontSize/);
  assert.equal(result.plan.calls[0].arguments.text, 'Hello');
  assert.equal(result.response.repaired, true);
  assert.equal(result.response.inferenceMs, 20);
  assert.ok(progress.some(message => message.includes('Correcting')));
});
test('repeated invalid output stops after one correction; provider errors do not retry', async () => {
  let requests = 0;
  await assert.rejects(checkedCloudPlan({ tools, context, parse: parseToolPlan, body: { command: 'Add hello', context },
    request: async () => { requests++; return { text: text({ fontSize: 24 }) }; } }), /savanna_add_text: Unknown argument: fontSize/);
  assert.equal(requests, 2);
  requests = 0;
  await assert.rejects(checkedCloudPlan({ tools, context, parse: parseToolPlan, body: { command: 'Add hello', context },
    request: async () => { requests++; throw new Error('Connection failed'); } }), /Connection failed/);
  assert.equal(requests, 1);
});

test('deck strategy fields returned at the top level are nested before validation', () => {
  const deck = { title: 'Test', audience: 'Readers', objective: 'Explain',
    thesis: 'A clear point', narrative: 'Explain then conclude', visualStyle: 'Quiet and spacious',
    slides: [{ title: 'Overview', purpose: 'Explain the topic', layout: 'content' }] };
  const parse = args => parseToolPlan(JSON.stringify({ calls: [{ name: 'savanna_create_deck', arguments: args }] }), tools, context).calls[0].arguments;
  const result = parse(deck);
  assert.deepEqual(result.strategy, { thesis: deck.thesis, narrative: deck.narrative, visualStyle: deck.visualStyle });
  assert.equal(Object.hasOwn(result, 'visualStyle'), false);
  assert.equal(result.fileId, 'f');
  assert.equal(parse({ ...deck, strategy: result.strategy }).strategy.visualStyle, deck.visualStyle);
  assert.throws(() => parse({ ...deck, strategy: { ...result.strategy, visualStyle: 'Different' } }), /Conflicting strategy.visualStyle/);
  assert.throws(() => parse({ ...deck, visualStyle: 123 }), /visualStyle/);
  assert.throws(() => parse({ ...deck, unsupportedStyle: 'Invalid' }), /Unknown argument: unsupportedStyle/);
  const { thesis, narrative, ...incomplete } = deck;
  assert.throws(() => parse(incomplete), /Missing argument: thesis/);
});

test('malformed SVG JSON is repaired once with a useful error and no partial edit', async () => {
  let requests = 0;
  const result = await checkedCloudPlan({ tools, context, parse: parseToolPlan,
    body: { command: 'Add hello', context }, request: async (path, options) => {
      requests++;
      if (requests === 1) return { text: '{"message":"SVG <text font-family="Inter">"}' };
      assert.match(options.body.context.planRepair.validationError, /malformed command JSON/);
      assert.match(options.body.context.planRepair.validationError, /escape quotes/);
      return { text: text({ text: 'Hello' }) };
    } });
  assert.equal(requests, 2);
  assert.equal(result.plan.calls[0].arguments.text, 'Hello');
});
