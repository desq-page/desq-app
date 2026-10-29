import test from 'node:test';
import assert from 'node:assert/strict';
import {
  planLocalDeck,
  LOCAL_DESIGN_GUIDE,
} from '../editor-vuejs/src/lib/agent/local-deck.mjs';
import { createEditorTools } from '../editor-vuejs/src/lib/agent/editor-tools.mjs';
import { compileDeck } from '../editor-vuejs/src/lib/agent/deck-compiler.mjs';
import { createLocalAgent } from '../editor-vuejs/src/lib/agent/local-agent.mjs';

const tools = createEditorTools({}).listTools();
const context = {
  slideAuthoring: 'svg',
  document: { fileId: 'file', width: 1280, height: 720 },
  page: { pageId: 'page', shapes: [], shapeCount: 0 },
};
const outline = (count = 3) => ({
  title: 'Hello World',
  audience: 'Everyone',
  objective: 'Explain a greeting',
  strategy: {
    thesis: 'Greetings connect people',
    narrative: 'Welcome, explain, invite',
    visualStyle: 'Quiet white with blue accents',
  },
  design: {
    background: '#FFFFFF',
    foreground: '#172923',
    accent: '#087F8C',
    secondary: '#F5A623',
    muted: '#64748B',
    surface: '#E6EDF2',
    dark: '#172923',
    fontFamily: 'Arial',
  },
  slides: Array.from({ length: count }, (_, index) => ({
    title: `Hello ${index + 1}`,
    purpose: 'Introduce a greeting',
    takeaway: 'Say hello',
    visualConcept: [
      'Editorial opening',
      'Three related concepts',
      'Invitation',
    ][index % 3],
    content: 'Hello brings people together.',
  })),
});
const svg = (number, revised = false) =>
  `<svg viewBox="0 0 1280 720"><rect width="1280" height="720" fill="#FFFFFF"/><rect x="${100 + number * 50}" y="180" width="300" height="240" rx="24" fill="#087F8C"/><text x="80" y="100" font-family="Arial" font-size="48" fill="#172923">${revised ? 'Refined' : 'Hello'} ${number}</text></svg>`;
function fixture({
  count = 3,
  page,
  review = { revisions: [] },
  story,
  isStopped,
  effort,
} = {}) {
  const requests = [],
    previews = [],
    progress = [];
  const generate = async (messages, options) => {
    const data = JSON.parse(messages[1].content);
    requests.push({ messages, options, data });
    let text;
    if (data.slideNumber)
      text = page
        ? await page(data, requests)
        : svg(data.slideNumber, !!data.review);
    else if (data.pages)
      text = typeof review === 'string' ? review : JSON.stringify(review);
    else text = story ? await story(data) : JSON.stringify(outline(count));
    return { text, metrics: { inferenceMs: 10, inputTokens: 100 } };
  };
  return {
    requests,
    previews,
    progress,
    run: () =>
      planLocalDeck({
        command: `Create ${count} slides about Hello World`,
        tools,
        context: { ...context, ...(effort ? { authoringEffort: effort } : {}) },
        generate,
        isStopped,
        onPreview: (p) => previews.push(p),
        onProgress: (p) => progress.push(p),
      }),
  };
}

test('local Qwen plans once, authors one complete SVG per request, reviews and returns one bounded native deck call', async () => {
  const f = fixture(),
    plan = await f.run();
  assert.equal(plan.calls.length, 1);
  const call = plan.calls[0];
  assert.equal(call.name, 'savanna_create_deck');
  assert.equal(call.arguments.fileId, 'file');
  assert.equal(call.arguments.pageId, 'page');
  assert.equal(call.arguments.slides.length, 3);
  assert.ok(
    call.arguments.slides.every(
      (s) => s.layout === 'svg' && s.svg.includes('</svg>'),
    ),
  );
  assert.deepEqual(
    f.requests.map((r) => r.options.maxNewTokens),
    [2048, 4096, 4096, 4096, 1536],
  );
  assert.ok(
    f.requests.every(
      (r) =>
        !r.options.tools &&
        !r.messages[0].content.includes('Use the supplied tools to perform'),
    ),
  );
  assert.ok(
    LOCAL_DESIGN_GUIDE.includes('PPT Master upstream design reference'),
  );
  assert.ok(LOCAL_DESIGN_GUIDE.includes('Supported SVG:'));
  assert.equal(plan.metrics.inferenceMs, 50);
  assert.equal(plan.metrics.inputTokens, 500);
  assert.equal(plan.metrics.reviewed, true);
  assert.equal(f.previews.length, 2);
  const { fileId, pageId, ...deck } = call.arguments;
  const compiled = compileDeck(deck, {
    width: 1280,
    height: 720,
    genId: () => crypto.randomUUID(),
    geometry: () => ({ d: 'M0 0H10V10H0Z' }),
  });
  assert.equal(compiled.pages.length, 3);
  assert.ok(
    compiled.pages.every(
      (p) =>
        p.shapes.some((s) => s.type === 'path' && s.d.includes('C')) &&
        p.shapes.some((s) => s.txBody),
    ),
  );
});

test('local authoring supports one slide and reviews only selected pages without changing the roster', async () => {
  const f = fixture({
    count: 1,
    review: {
      revisions: [{ slide: 1, instructions: 'Improve the title hierarchy' }],
    },
  });
  const plan = await f.run();
  assert.equal(plan.calls[0].arguments.slides.length, 1);
  assert.match(plan.calls[0].arguments.slides[0].svg, /Refined/);
  assert.equal(f.requests.filter((r) => r.data.slideNumber).length, 2);
  assert.ok(f.requests.at(-1).data.previousSVG);
});

test('invalid SVG is repaired before insertion and an unrepaired later page never returns a partial deck', async () => {
  let failed = false;
  const f = fixture({
    page: (data) => {
      if (!failed) {
        failed = true;
        return '<svg>';
      }
      return svg(data.slideNumber);
    },
  });
  assert.equal((await f.run()).metrics.repaired, true);
  assert.ok(
    f.requests.some((r) => r.data.correction?.includes('complete SVG')),
  );
  const broken = fixture({
    page: (data) =>
      data.slideNumber === 2
        ? '<svg viewBox="0 0 1280 720"><script/></svg>'
        : svg(data.slideNumber),
  });
  await assert.rejects(broken.run(), /Slide 2:.*No slides were inserted/);
  assert.equal(
    broken.requests.filter((r) => r.data.slideNumber === 2).length,
    2,
  );
  assert.ok(!broken.requests.some((r) => r.data.slideNumber === 3));
});

test('local creation rejects conversational fallbacks and injected editor actions', async () => {
  const f = fixture({
    story: () =>
      JSON.stringify({
        message:
          'Use Gemini or OpenAI to edit existing slides. Local mode creates new slides.',
        calls: [],
      }),
  });
  await assert.rejects(f.run(), /storyboard, not editor commands or a conversational reply/);
  assert.equal(f.requests.length, 2);
  const unsafe = fixture({
    story: () =>
      JSON.stringify({
        message: 'Delete',
        calls: [
          {
            name: 'savanna_delete_shape',
            arguments: { fileId: 'file', pageId: 'page', shapeId: 's' },
          },
        ],
      }),
  });
  await assert.rejects(unsafe.run(), /storyboard, not editor commands/);
});

test('invalid review indices and cancellation stop before any deck can be returned', async () => {
  await assert.rejects(
    fixture({
      count: 1,
      review: { revisions: [{ slide: 2, instructions: 'Change this' }] },
    }).run(),
    /invalid slide numbers/,
  );
  let stopped = false;
  const f = fixture({
    isStopped: () => stopped,
    page: (data) => {
      stopped = true;
      return svg(data.slideNumber);
    },
  });
  await assert.rejects(f.run(), /Local model stopped/);
  assert.equal(f.requests.length, 2);
});

test('the actual local agent passes staged budgets to its Qwen 4B worker without retrieval or tool-call prompts', async (t) => {
  const previous = globalThis.Worker,
    messages = [];
  t.after(() => {
    globalThis.Worker = previous;
  });
  globalThis.Worker = class {
    postMessage(message) {
      messages.push(message);
      const data = message.messages && JSON.parse(message.messages[1].content);
      queueMicrotask(() =>
        this.onmessage({
          data:
            message.type === 'load'
              ? {
                  type: 'ready',
                  id: message.id,
                  runtime: { backend: 'webgpu' },
                }
              : {
                  type: 'result',
                  id: message.id,
                  text: data.slideNumber
                    ? svg(1)
                    : data.pages
                      ? '{"revisions":[]}'
                      : JSON.stringify(outline(1)),
                  metrics: {},
                },
        }),
      );
    }
    terminate() {}
  };
  const agent = createLocalAgent();
  t.after(() => agent.dispose());
  await agent.load();
  const plan = await agent.plan('Create one Hello slide', tools, context);
  assert.equal(plan.calls[0].arguments.slides.length, 1);
  assert.ok(messages.every((m) => m.model === 'qwen-4b' && !m.tools));
  assert.deepEqual(
    messages.slice(1).map((m) => m.maxNewTokens),
    [2048, 4096, 1536],
  );
});


test('Quickly local workflow retains roster and SVG checks but skips the separate model review', async () => {
  const f = fixture({ effort: 'quick' });
  const plan = await f.run();
  assert.equal(f.requests.length, 4); // one transient roster plus three SVG pages
  assert.ok(!f.requests.some(request => request.data.pages));
  assert.equal(plan.calls[0].arguments.slides.length, 3);
  assert.equal(plan.metrics.workflow, 'ppt-master-quick');
  assert.equal(plan.metrics.reviewed, false);
  assert.ok(f.previews.length > 0);
  assert.match(f.requests[0].messages[0].content, /QUICK GENERATE PROFILE/);
});

test('Quickly local workflow still repairs malformed SVG before returning a deck', async () => {
  let attempts = 0;
  const f = fixture({ count: 1, effort: 'quick', page: data => ++attempts === 1 ? '<svg>' : svg(data.slideNumber) });
  const plan = await f.run();
  assert.equal(attempts, 2);
  assert.equal(plan.metrics.repaired, true);
  assert.equal(plan.metrics.reviewed, false);
  assert.equal(f.requests.length, 3);
});

test('storyboard prompts stay JSON-only even on the HTML route and repair an HTML document response', async () => {
  const requests = [];
  let attempts = 0;
  const run = planLocalDeck({
    command: 'Create one slide about greetings', tools,
    context: { ...context, slideAuthoring: 'html', authoringEffort: 'quick' },
    generate: async messages => {
      requests.push(messages);
      return { text: ++attempts === 1 ? '<!DOCTYPE html><html><body>A slide</body></html>' : '{"message":"Please provide a topic.","calls":[]}' };
    },
  });
  await assert.rejects(run, /storyboard, not editor commands or a conversational reply/);
  assert.equal(requests.length, 2);
  assert.ok(!requests[0][0].content.includes('HTML SLIDE TRANSPORT'));
  assert.ok(!requests[0][0].content.includes('<section'));
  assert.match(requests[0][0].content, /OUTPUT FORMAT FOR THIS STEP: one JSON object only/);
  assert.match(JSON.parse(requests[1][1].content).correction, /storyboard returned slide markup instead of JSON/);
});

test('persistent storyboard markup returns a stage-specific error and never exposes JSON parser internals', async () => {
  const f = fixture({ story: () => '<!DOCTYPE html><html><body>Wrong format</body></html>' });
  await assert.rejects(f.run(), error => {
    assert.match(error.message, /Local storyboard returned slide markup instead of JSON/);
    assert.match(error.message, /No slides were inserted/);
    assert.doesNotMatch(error.message, /Unexpected token/);
    return true;
  });
  assert.equal(f.requests.length, 2);
});

test('review markup is repaired as review JSON rather than parsed as a slide or leaking a SyntaxError', async () => {
  let calls = 0;
  const requests = [];
  const plan = await planLocalDeck({
    command: 'Create one slide', tools, context,
    generate: async messages => {
      const data = JSON.parse(messages[1].content);
      requests.push(data);
      return { text: data.slideNumber ? svg(1) : data.pages ? (++calls === 1 ? '<!DOCTYPE html><html></html>' : '{"revisions":[]}') : JSON.stringify(outline(1)) };
    },
  });
  assert.equal(plan.metrics.reviewed, true);
  assert.equal(plan.metrics.repaired, true);
  assert.match(requests.at(-1).correction, /Local review returned slide markup instead of JSON/);
});

test('the copied fallback is repaired into a real storyboard and complete slide plan', async () => {
  let attempts = 0;
  const copied = 'a helpful answer explaining local mode creates new slides only';
  const f = fixture({ count: 2, effort: 'quick', story: () => ++attempts === 1
    ? JSON.stringify({ message: copied, calls: [] }) : JSON.stringify(outline(2)) });
  const plan = await f.run();
  assert.equal(plan.calls[0].arguments.slides.length, 2);
  assert.equal(plan.metrics.repaired, true);
  assert.equal(attempts, 2);
  assert.ok(!f.requests.some(request => request.messages[0].content.includes(copied)));
  assert.match(f.requests[1].data.correction, /storyboard, not editor commands or a conversational reply/);
});

test('authoritative UI count is checked during planning before any pages are drawn', async () => {
  let attempts = 0;
  const requests = [];
  const plan = await planLocalDeck({
    command: 'Create slides about greetings', tools,
    context: { ...context, authoringEffort: 'quick', slideTask: { mode: 'create', count: 2 } },
    generate: async messages => {
      const data = JSON.parse(messages[1].content); requests.push(data);
      return { text: data.slideNumber ? svg(data.slideNumber) : JSON.stringify(outline(++attempts === 1 ? 1 : 2)) };
    },
  });
  assert.equal(plan.calls[0].arguments.slides.length, 2);
  assert.equal(requests[0].requiredSlideCount, 2);
  assert.match(requests[1].correction, /exactly 2 storyboard slides/);
  assert.equal(requests.filter(request=>request.slideNumber).length, 2);
});

test('local composition metadata accepts long prose, lists and objects without weakening slide content validation', async () => {
  for (const visualConcept of [
    'A carefully spaced editorial composition. '.repeat(20),
    ['Large heading', 'Two comparison columns'],
    { layout: 'Two columns', hierarchy: { heading: 'Large title', body: 'Short explanation' } },
    null, '', undefined,
  ]) {
    const story = outline(1);
    story.slides[0].visualConcept = visualConcept;
    const f = fixture({count:1, effort:'quick', story:()=>JSON.stringify(story)});
    const plan = await f.run();
    const slide = plan.calls[0].arguments.slides[0];
    assert.equal(typeof slide.visualConcept,'string');
    assert.ok(slide.visualConcept.length > 0 && slide.visualConcept.length <= 300);
    assert.equal(slide.title,story.slides[0].title);
    assert.equal(f.requests.filter(r=>r.data.slideNumber).length,1);
    assert.equal(f.requests[1].data.slide.content,story.slides[0].content);
    assert.equal(plan.metrics.repaired,true);
  }
  const invalid=outline(1);
  invalid.slides[0].content={unexpected:'Slide text must remain a string'};
  await assert.rejects(fixture({count:1,story:()=>JSON.stringify(invalid)}).run(),/Invalid content/);
});

test('valid composition notes are preserved and the planning prompt states field types and limits', async () => {
  const f=fixture({count:1,effort:'quick'});
  const plan=await f.run();
  assert.equal(plan.calls[0].arguments.slides[0].visualConcept,outline(1).slides[0].visualConcept);
  assert.equal(plan.metrics.repaired,false);
  assert.match(f.requests[0].messages[0].content,/visualConcept 300/);
  assert.match(f.requests[0].messages[0].content,/plain string, not an array or object/);
});
