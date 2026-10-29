import test from 'node:test';
import assert from 'node:assert/strict';
import { createAgentService } from '../cloudflare-publisher/src/agent/service.mjs';
import { chatgptRequest, createChatGPTAgent } from '../editor-vuejs/src/lib/agent/chatgpt-agent.mjs';
import { geminiRequest, createGeminiAgent } from '../editor-vuejs/src/lib/agent/gemini-agent.mjs';
import { createEditorTools } from '../editor-vuejs/src/lib/agent/editor-tools.mjs';
import { DECK_AUTHORING_VERSION } from '../editor-vuejs/src/lib/agent/deck-authoring.mjs';
import { validateProviderPayload } from '../cloudflare-publisher/src/agent/proxy.mjs';
const origin = 'https://editor.test';
const context = { document: { fileId: 'file' }, page: { pageId: 'page', shapes: [] } };
const text = JSON.stringify({ message: 'Renamed', calls: [{ name: 'savanna_rename_document', arguments: { name: '预算' } }] });
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9iUAAAAASUVORK5CYII=';

function browserFixture(t) {
  const upstream = [], browserRequests = [], cookies = new Map();
  const providerFetch = async (url, options) => {
    upstream.push({ url, options });
    if (url.includes('googleapis.com')) {
      assert.equal(options.headers['x-goog-api-key'], 'gemini-secret');
      if (url.includes('/models?')) return Response.json(new URL(url).searchParams.has('pageToken')
        ? { models: [{ name: 'models/gemini-second', supportedGenerationMethods: ['generateContent'] }] }
        : { models: [{ name: 'models/gemini-first', supportedGenerationMethods: ['generateContent'] }, { name: 'models/gemini-image', supportedGenerationMethods: ['generateContent'] }], nextPageToken: 'next' });
      const payload = JSON.parse(options.body);
      const resultText = payload.systemInstruction?.parts?.[0]?.text.includes('Rewrite the image description') ? 'rooftop solar panels' : (payload.instructions || payload.systemInstruction?.parts?.[0]?.text)?.includes('Rephrase this slide text') ? 'Concise source facts.' : (payload.instructions || payload.systemInstruction?.parts?.[0]?.text)?.includes('Inspect the actual image') ? JSON.stringify({matches:false,reason:'Peach fruit, not blossoms.'}) : text;
      return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: payload.generationConfig.responseModalities
        ? [{ inlineData: { mimeType: 'image/png', data: png } }]
        : [{ thought: true, text: 'Hidden thought' }, { text: resultText }] } }], usageMetadata: { promptTokenCount: 42 } });
    }
    assert.equal(options.headers.Authorization, 'Bearer openai-secret');
    if (url.endsWith('/models')) return Response.json({ data: [{ id: 'gpt-test' }, { id: 'gpt-image-test' }, { id: 'text-embedding-test' }] });
    const payload = JSON.parse(options.body);
    const resultText = payload.instructions?.includes('Rewrite the image description') ? 'rooftop solar panels' : (payload.instructions || payload.systemInstruction?.parts?.[0]?.text)?.includes('Rephrase this slide text') ? 'Concise source facts.' : (payload.instructions || payload.systemInstruction?.parts?.[0]?.text)?.includes('Inspect the actual image') ? JSON.stringify({matches:false,reason:'Peach fruit, not blossoms.'}) : text;
    const completed = { type: 'response.completed', response: { status: 'completed', output: payload.tools
      ? [{ type: 'image_generation_call', status: 'completed', result: png }]
      : [{ type: 'message', content: [{ type: 'output_text', text: resultText }] }], usage: { input_tokens: 43 } } };
    const bytes = new TextEncoder().encode(`data: ${JSON.stringify(completed)}\n\n`);
    return new Response(new ReadableStream({ start(controller) {
      for (let i = 0; i < bytes.length; i += 7) controller.enqueue(bytes.slice(i, i + 7));
      controller.close();
    } }), { headers: { 'Content-Type': 'text/event-stream' } });
  };
  const service = createAgentService({ origins: [origin], hostId: 'test', fetchImpl: providerFetch });
  const savedFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    const absolute = new URL(url, origin), provider = absolute.pathname.split('/')[3];
    const headers = new Headers(options.headers);
    headers.set('Origin', origin);
    if (cookies.has(provider)) headers.set('Cookie', cookies.get(provider));
    browserRequests.push({ url: String(url), options });
    const response = absolute.origin === 'https://generativelanguage.googleapis.com'
      ? await providerFetch(absolute.href, options) : await service.fetch(new Request(absolute, { ...options, headers }));
    const cookie = response.headers.get('set-cookie');
    if (cookie) cookies.set(provider, cookie.split(';')[0]);
    return response;
  };
  t.after(() => { globalThis.fetch = savedFetch; });
  return { upstream, browserRequests, service };
}

test('frontend owns prompt assembly, model pagination/filtering, raw response parsing and progress', async t => {
  const { upstream, browserRequests } = browserFixture(t);
  await chatgptRequest('connect', { body: { apiKey: 'openai-secret' } });
  assert.deepEqual((await chatgptRequest('models')).models, [{ id: 'gpt-test', label: 'gpt-test' }]);
  const google = await geminiRequest('connect', { body: { apiKey: 'gemini-secret' } });
  assert.deepEqual(google.models.map(model => model.id), ['models/gemini-first', 'models/gemini-second']);
  assert.ok(browserRequests.some(request => request.url.includes('pageToken=next')));
  for (const [request, model] of [[chatgptRequest, 'gpt-test'], [geminiRequest, 'models/gemini-second']]) {
    const progress = [];
    const result = await request('plan', { body: { model, command: 'Rename the document to 预算', context }, onProgress: message => progress.push(message) });
    assert.equal(result.text, text);
    assert.equal(result.authoringVersion, DECK_AUTHORING_VERSION);
    assert.ok(progress.some(message => message.includes('Waiting')));
    assert.ok(progress.some(message => message.includes('Receiving')));
  }
  for (const request of browserRequests.filter(request => request.url.endsWith('/plan'))) {
    const payload = JSON.parse(request.options.body);
    assert.deepEqual(Object.keys(payload).sort(), ['model', 'request']);
    assert.ok(JSON.stringify(payload.request).includes('savanna_rename_document'));
    assert.ok(!JSON.stringify(request.options.headers).includes('-secret'));
  }
  assert.ok(upstream.filter(request => request.url.endsWith('/responses') || request.url.includes(':generateContent')).every(request => !JSON.parse(request.options.body).context));
});

test('frontend decodes generated images and produces validated editor calls through OpenAI proxy and direct Gemini', async t => {
  browserFixture(t);
  await chatgptRequest('connect', { body: { apiKey: 'openai-secret' } }); await chatgptRequest('models');
  await geminiRequest('connect', { body: { apiKey: 'gemini-secret' } });
  for (const [request, model, create] of [[chatgptRequest, 'gpt-test', createChatGPTAgent], [geminiRequest, 'models/gemini-first', createGeminiAgent]]) {
    const result = await request('image', { body: { model, query: 'A sunrise', alt: 'Sunrise' } });
    assert.equal(result.mimeType, 'image/png'); assert.equal(result.data, png);
    const agent = create(model);
    const plan = await agent.plan('Rename the document', createEditorTools({}).listTools(), context);
    assert.equal(plan.calls[0].arguments.fileId, 'file');
    assert.equal(plan.calls[0].arguments.name, '预算');
    agent.dispose();
  }
});

test('proxy rejects alternate destinations, credentials and model substitution in prepared payloads', () => {
  const body = { model: 'gpt-test', request: { model: 'gpt-test', store: false, stream: true, input: [] } };
  validateProviderPayload(body, 'chatgpt');
  for (const field of ['url', 'headers', 'apiKey', 'tools']) assert.throws(() => validateProviderPayload({ ...body, request: { ...body.request, [field]: 'bad' } }, 'chatgpt'), /Unsupported/);
  assert.throws(() => validateProviderPayload({ ...body, request: { ...body.request, model: 'different' } }, 'chatgpt'), /Invalid OpenAI/);
});

test('browser heartbeat continues while awaiting a provider and stops on cancellation', async t => {
  const savedFetch = globalThis.fetch, savedInterval = globalThis.setInterval, savedClear = globalThis.clearInterval;
  let tick, cleared = false;
  globalThis.setInterval = callback => { tick = callback; return 123; };
  globalThis.clearInterval = id => { if (id === 123) cleared = true; };
  globalThis.fetch = async (url, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true });
  });
  t.after(() => { globalThis.fetch = savedFetch; globalThis.setInterval = savedInterval; globalThis.clearInterval = savedClear; });
  const progress = [], controller = new AbortController();
  const pending = chatgptRequest('plan', { body: { model: 'gpt-test', command: 'Create a slide', context }, signal: controller.signal, onProgress: message => progress.push(message) });
  assert.equal(progress.length, 1);
  tick(); assert.equal(progress.length, 2);
  controller.abort();
  await assert.rejects(pending, /Cancelled/);
  assert.equal(cleared, true);
});


test('both cloud agents request plain keywords through their text transports without slide prompts', async t => {
  const { upstream } = browserFixture(t);
  await chatgptRequest('connect', { body: { apiKey: 'openai-secret' } }); await chatgptRequest('models');
  await geminiRequest('connect', { body: { apiKey: 'gemini-secret' } });
  for (const [create, model] of [[createChatGPTAgent, 'gpt-test'], [createGeminiAgent, 'models/gemini-first']]) {
    const agent = create(model);
    assert.equal(await agent.imageKeywords({ query: 'A photograph of solar panels on a rooftop', alt: 'Solar panels' }), 'rooftop solar panels');
    const payload = JSON.parse(upstream.at(-1).options.body);
    const instructions = payload.instructions || payload.systemInstruction.parts[0].text;
    assert.ok(instructions.includes('2 to 4 concise Wikimedia Commons search keywords'));
    assert.ok(!instructions.includes('savanna_create_deck'));
    agent.dispose();
  }
});

test('keyword prompts receive the deck language and request native names without translated filler', async () => {
  const {buildProviderKeywords}=await import('../editor-vuejs/src/lib/agent/provider-request.mjs');
  const payload=buildProviderKeywords('chatgpt',{model:'test',query:'Vietnamese pink blossoms Tet',alt:'Hoa đào',language:'vi'});
  assert.equal(JSON.parse(payload.request.input[0].content).language,'vi');
  assert.match(payload.request.instructions,/hoa mai/);
  assert.match(payload.request.instructions,/hoa đào/);
  assert.match(payload.request.instructions,/Preserve diacritics/);
});

test('both cloud agents send actual image pixels for relevance checks through their existing transports', async t => {
  const {upstream}=browserFixture(t);
  await chatgptRequest('connect',{body:{apiKey:'openai-secret'}});await chatgptRequest('models');
  await geminiRequest('connect',{body:{apiKey:'gemini-secret'}});
  for(const [create,model] of [[createChatGPTAgent,'gpt-test'],[createGeminiAgent,'models/gemini-first']]) {
    const agent=create(model);
    const verdict=await agent.imageMatches({query:'hoa đào',alt:'Peach blossoms for Tet',title:'Peach.jpg',blob:new Blob([Buffer.from(png,'base64')],{type:'image/png'})});
    assert.equal(verdict.matches,false);
    const payload=JSON.parse(upstream.at(-1).options.body);
    if(payload.input){
      assert.equal(payload.input[0].content[1].type,'input_image');
      assert.equal(payload.input[0].content[1].image_url,`data:image/png;base64,${png}`);
      assert.match(payload.input[0].content[0].text,/hoa đào/);
    }else{
      assert.equal(payload.contents[0].parts[1].inlineData.data,png);
      assert.equal(payload.contents[0].parts[1].inlineData.mimeType,'image/png');
    }
    agent.dispose();
  }
});

test('image relevance responses are strict and oversized previews never reach the provider', async () => {
  const {parseImageRelevance,requestImageRelevance}=await import('../editor-vuejs/src/lib/agent/image-relevance.mjs');
  assert.throws(()=>parseImageRelevance('{"matches":"yes","reason":"fruit"}'),/invalid image relevance/);
  assert.throws(()=>parseImageRelevance('probably fine'));
  let calls=0;
  await assert.rejects(requestImageRelevance(async()=>{calls++;},new AbortController().signal,'test',{query:'hoa đào',blob:new Blob([new Uint8Array(450001)],{type:'image/png'})}),/limit/);
  assert.equal(calls,0);
});

test('metadata relevance requests contain text only and permit an inconclusive verdict', async () => {
  const {buildImageRelevance,requestImageRelevance,parseImageRelevance}=await import('../editor-vuejs/src/lib/agent/image-relevance.mjs');
  for(const provider of ['chatgpt','gemini']){
    const result=await requestImageRelevance(async(path,options)=>{
      assert.equal(path,'image-match');assert.equal(options.body.data,undefined);
      const {request}=buildImageRelevance(provider,options.body);
      const content=provider==='chatgpt'?request.input[0].content:request.contents[0].parts;
      assert.equal(content.length,1);
      const text=provider==='chatgpt'?content[0].text:content[0].text;
      assert.equal(JSON.parse(text).metadata.ImageDescription,'A peach fruit');
      return {text:JSON.stringify({matches:null,reason:'Insufficient metadata'})};
    },new AbortController().signal,'test',{query:'hoa đào',title:'Image.jpg',metadata:{ImageDescription:'A peach fruit'}});
    assert.equal(result.matches,null);
  }
  assert.throws(()=>parseImageRelevance('{"matches":null,"reason":"Uncertain"}'),/invalid image relevance/);
});


test('cloud text rewrites use the active provider through its normal authenticated transport',async t=>{
 const {browserRequests}=browserFixture(t);
 await chatgptRequest('connect',{body:{apiKey:'openai-secret'}});await chatgptRequest('models');
 await geminiRequest('connect',{body:{apiKey:'gemini-secret'}});
 for(const [create,model] of [[createChatGPTAgent,'gpt-test'],[createGeminiAgent,'models/gemini-first']]){
  const agent=create(model);
  assert.equal(await agent.rewriteText({text:'The complete original source facts.',maxLength:25}),'Concise source facts.');
  agent.dispose();
 }
 assert.ok(browserRequests.some(r=>r.url.endsWith('/chatgpt/plan')&&r.options.body.includes('Rephrase this slide text')));
});

test('schema-first template requests use the existing authenticated transports',async t=>{
 const {browserRequests,upstream}=browserFixture(t);
 await chatgptRequest('connect',{body:{apiKey:'openai-secret'}});await chatgptRequest('models');
 await geminiRequest('connect',{body:{apiKey:'gemini-secret'}});
 const schema={type:'object',additionalProperties:false,properties:{title:{type:'string'}}};
 for(const [request,model]of [[chatgptRequest,'gpt-test'],[geminiRequest,'models/gemini-first']]){
  await request('template-outline',{body:{model,command:'Create one slide',context:{families:[]}}});
  await request('template-content',{body:{model,command:'Create one slide',schema,title:'Facts',contentBrief:'Source evidence',imageBudget:0}});
 }
 assert.ok(browserRequests.some(r=>r.url.endsWith('/chatgpt/plan')&&r.options.body.includes('Fill the supplied content JSON schema')));
 const gemini=upstream.filter(r=>r.url.includes(':generateContent')).map(r=>JSON.parse(r.options.body));
 assert.deepEqual(gemini.at(-1).generationConfig.responseJsonSchema,schema);
});
