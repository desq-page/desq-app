import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProviderImage, readProviderImage, generatedImagePayload } from '../editor-vuejs/src/lib/agent/provider-images.mjs';
import { resolveSlideImage } from '../editor-vuejs/src/lib/agent/generated-slide.mjs';
import { generateAgentImage } from '../editor-vuejs/src/lib/agent/generated-image-client.mjs';

// Unit fixtures inject the upstream response at the browser parser boundary.
async function generateImage(provider, { model = 'gemini-2.5-flash-image', body, fetchImpl }) {
  const payload = buildProviderImage(provider, model, body);
  const response = await fetchImpl(`/api/agent/${provider}/image`, {
    headers: { 'X-Editor-Agent': '1' }, body: JSON.stringify(payload),
  });
  return readProviderImage(response, provider, model);
}
const generateChatGPTImage = options => generateImage('chatgpt', options);
const generateGeminiImage = options => generateImage('gemini', options);

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9iUAAAAASUVORK5CYII=';
const image = { query: 'colorful abstract greeting illustration hello world', alt: 'A colorful greeting illustration' };
const asset = () => ({ blob: new Blob([Buffer.from(png,'base64')], { type: 'image/png' }), title: image.alt,
  author: 'OpenAI', license: 'AI-generated', sourceUrl: '', generation: { provider: 'OpenAI', model: 'test-model' } });

test('failed generation yields an explicit placeholder and preserves cancellation', async () => {
  const controller = new AbortController();
  const options = { placeholderOnFailure: true, fetchImpl: async () => Response.json({}), generateImage: async () => { throw Error('HTTP 400'); } };
  const result = await resolveSlideImage(image, options);
  assert.equal(result.placeholder, true); assert.equal(result.description, image.query); assert.match(result.warning, /HTTP 400/);
  assert.equal(result.blob, undefined);
  controller.abort(); await assert.rejects(resolveSlideImage(image, { ...options, signal: controller.signal }));
});

test('ChatGPT streaming images require completion and recover omitted terminal output', async () => {
  const events = [{ type: 'response.output_item.done', item: { type: 'image_generation_call', status: 'completed', result: png } },
    { type: 'response.completed', response: { status: 'completed', output: [] } }];
  const run = events => generateChatGPTImage({ model: 'test', body: image, fetchImpl: async () => new Response(events.map(e => `data: ${JSON.stringify(e)}\n\n`).join(''), { headers: { 'content-type': 'text/event-stream' } }) });
  assert.equal((await run(events)).data, png);
  await assert.rejects(run(events.slice(0, 1)), /did not complete/);
  await assert.rejects(generateChatGPTImage({ model: 'test', body: image, fetchImpl: async () => Response.json({ error: { code: 'unsupported_parameter', param: 'tools', message: 'secret' } }, { status: 400 }) }), e => /Parameter: tools/.test(e.message) && !e.message.includes('secret'));
});

test('Wikimedia miss and search failure generate one image, preserving provenance', async () => {
  for (const search of [()=>Response.json({ query: { pages: {} } }), ()=>new Response('',{status:503})]) {
    let calls=0; const progress=[];
    const result=await resolveSlideImage(image,{fetchImpl:search,generateImage:async (request)=>{calls++;assert.deepEqual(request,image);return asset();},onProgress:m=>progress.push(m)});
    assert.equal(calls,1);assert.equal(result.license,'AI-generated');assert.equal(result.sourceUrl,'');assert.ok(progress.some(message => message.includes('Generating')));
  }
});

test('cancellation never starts fallback generation; generation failure is not silently replaced', async () => {
  const controller=new AbortController();controller.abort();let calls=0;
  await assert.rejects(resolveSlideImage(image,{signal:controller.signal,fetchImpl:async()=>{throw Error('aborted');},generateImage:()=>{calls++;}}));
  assert.equal(calls,0);
  await assert.rejects(resolveSlideImage(image,{fetchImpl:async()=>Response.json({}),generateImage:async()=>{throw Error('Image access denied');}}),/Image access denied/);
  await assert.rejects(resolveSlideImage(image,{fetchImpl:async()=>Response.json({}),generateImage:async()=>({blob:new Blob(['<svg/>'],{type:'image/svg+xml'})})}),/no usable raster/);
});

test('frontend builds image-generation requests for the credential proxy without credentials', async () => {
  const result=await generateChatGPTImage({model:'test-model',body:image,fetchImpl:async(url,options)=>{
    assert.equal(url,'/api/agent/chatgpt/image');assert.equal(options.headers.Authorization,undefined);
    const body=JSON.parse(options.body).request;assert.equal(body.tools[0].type,'image_generation');assert.equal(body.stream,true);assert.ok(body.input[0].content.includes(image.query));
    return Response.json({status:'completed',output:[{type:'image_generation_call',status:'completed',result:png}]});
  }});
  assert.equal(result.mimeType,'image/png');assert.equal(result.provider,'OpenAI');
  await assert.rejects(generateChatGPTImage({model:'test',body:image,fetchImpl:async()=>Response.json({error:'secret'},{status:403})}),e=>e.message.includes('HTTP 403')&&!e.message.includes('secret'));
  await assert.rejects(generateChatGPTImage({model:'test',body:image,fetchImpl:async()=>Response.json({status:'incomplete',output:[]})}),/did not complete/);
});

test('Gemini uses an image model, rejects blocked/thought-only responses and validates raster bytes', async () => {
  const result=await generateGeminiImage({body:image,fetchImpl:async(url,options)=>{
    assert.equal(url,'/api/agent/gemini/image');assert.equal(options.headers['x-goog-api-key'],undefined);
    assert.deepEqual(JSON.parse(options.body).request.generationConfig.responseModalities,['TEXT','IMAGE']);
    return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{inlineData:{data:png,mimeType:'image/png'}}]}}]});
  }});
  assert.equal(result.provider,'Google Gemini');
  await assert.rejects(generateGeminiImage({body:image,fetchImpl:async()=>Response.json({candidates:[{finishReason:'SAFETY'}]})}),/could not complete/);
  for(const data of ['aGVsbG8=','https://example.com/x.png','']) assert.throws(()=>generatedImagePayload(data,'image/png','test','model'));
  assert.throws(()=>generatedImagePayload(png,'image/svg+xml','test','model'));
});

test('client decodes generated raster assets and forwards request cancellation without credentials', async () => {
  const controller=new AbortController(),execution=new AbortController();let seen;
  const result=await generateAgentImage(async(path,request)=>{seen=request;assert.equal(path,'image');return {data:png,mimeType:'image/png',provider:'OpenAI',model:'test'};},controller.signal,'test',image,{signal:execution.signal});
  assert.equal(result.blob.type,'image/png');assert.equal(result.generation.prompt,image.query);assert.equal(seen.body.model,'test');
  execution.abort();assert.equal(seen.signal.aborted,true);
});
