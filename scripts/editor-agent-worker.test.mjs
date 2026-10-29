import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getLocalModel } from '../editor-vuejs/src/lib/agent/local-models.mjs';

const workerSource = fs.readFileSync('editor-vuejs/src/lib/agent/local-agent.worker.mjs', 'utf8')
  .replace(/^import[^\n]+\n/gm, '');

function fixture(inputLength, failure, key = 'qwen-4b', features = ['shader-f16']) {
  const messages = [], env = { backends: { onnx: { wasm: {} } } };
  let generations = 0, generationOptions, disposed = 0;
  const self = {
    navigator: { gpu: { async requestAdapter() { return { features: new Set(features) }; } } },
    postMessage: message => messages.push(message),
  };
  const tokenizer = {
    apply_chat_template(messages, options) {
      assert.equal(options.tools, undefined);
      return { input_ids: { dims: [1, typeof inputLength === 'function' ? inputLength() : inputLength], dispose() { disposed++; } } };
    },
  };
  const generator = async (messages, options) => { generationOptions = options; generations++; if (failure) throw new WebAssembly.RuntimeError(failure); return [{ generated_text: [{ role: 'assistant', content: 'result' }] }]; };
  generator.tokenizer = tokenizer;
  new Function('self', 'pipeline', 'env', 'getLocalModel', workerSource)(self,
    async (task, id, options) => {
      assert.equal(task, 'text-generation');
      assert.equal(id, getLocalModel(key).id);
      assert.equal(options.dtype, getLocalModel(key).dtype === 'auto-q4' ? 'q4f16' : getLocalModel(key).dtype);
      assert.equal(options.device, 'webgpu');
      return generator;
    }, env, getLocalModel);
  return { self, messages, env, generations: () => generations, options: () => generationOptions, disposed: () => disposed };
}

test('oversized prompts are rejected before entering model inference', async () => {
  const f = fixture(9000);
  await f.self.onmessage({ data: { type: 'generate', id: 1, messages: [] } });
  assert.equal(f.generations(), 0);
  assert.equal(f.disposed(), 1);
  assert.match(f.messages.at(-1).error, /9000 tokens; limit 8192/);
  assert.equal(f.messages.at(-1).fatal, false);
  assert.equal(f.env.backends.onnx.wasm.numThreads, 1);
  assert.equal(f.env.backends.onnx.wasm.proxy, false);
});

test('WASM traps report fatal recovery and token/dtype diagnostics', async () => {
  const f = fixture(2048, 'memory access out of bounds');
  await f.self.onmessage({ data: { type: 'generate', id: 1, messages: [] } });
  assert.equal(f.messages.at(-1).fatal, true);
  assert.match(f.messages.at(-1).error, /q4f16, 2048 input tokens/);
  assert.match(f.messages.at(-1).error, /No editor tools were executed/);
});

test('bounded inference still returns decoded output', async () => {
  const f = fixture(1024);
  await f.self.onmessage({ data: { type: 'generate', id: 1, messages: [] } });
  assert.equal(f.generations(), 1);
  const result = f.messages.at(-1);
  assert.equal(result.type, 'result');
  assert.equal(result.text, 'result');
  assert.equal(result.metrics.backend, 'webgpu');
  assert.equal(result.metrics.inputTokens, 1024);
  assert.ok(result.metrics.inferenceMs >= 0);
});

test('OrtRun buffer errors require a fresh worker instead of reusing a failed session', async () => {
  const f = fixture(500, "failed to call OrtRun(). ERROR_CODE: 1, ERROR_MESSAGE: Failed to download data from buffer: [Invalid Buffer] is invalid due to a previous error.");
  await f.self.onmessage({ data: { type: 'generate', id: 1, messages: [] } });
  assert.equal(f.messages.at(-1).fatal, true);
  assert.match(f.messages.at(-1).error, /Load the local model again/);
});


test('Qwen optimized export is retained alongside Gemma E4B and Phi instruct', async () => {
  const { LOCAL_MODELS } = await import('../editor-vuejs/src/lib/agent/local-models.mjs');
  assert.deepEqual(LOCAL_MODELS.map(model => model.key), ['qwen-4b','qwen-0.8b','qwen-2b','gemma-4-e4b','phi-4-mini-instruct']);
  for (const removed of ['qwen', 'gemma-4-e2b', 'phi-4-mini-reasoning', 'unsupported']) assert.throws(() => getLocalModel(removed), /supported local model/);
  const f = fixture(200);
  await f.self.onmessage({ data: { type: 'load', id: 1, model: 'qwen-4b' } });
  assert.equal(f.messages.at(-1).runtime.model, LOCAL_MODELS[0].id);
});

test('Qwen 0.8B loads its optimized export and generates through the local worker', async () => {
  const f = fixture(500, undefined, 'qwen-0.8b');
  await f.self.onmessage({ data: { type: 'load', id: 1, model: 'qwen-0.8b' } });
  assert.equal(f.messages.at(-1).runtime.model, 'onnx-community/Qwen3.5-0.8B-ONNX-OPT');
  assert.equal(f.messages.at(-1).runtime.dtype, 'q4f16');
  await f.self.onmessage({ data: { type: 'generate', id: 2, model: 'qwen-0.8b', messages: [], maxNewTokens: 4096 } });
  assert.equal(f.messages.at(-1).type, 'result');
  assert.equal(f.options().max_new_tokens, 4096);
});

test('Qwen 2B loads its optimized export and generates through the local worker', async () => {
  const f = fixture(500, undefined, 'qwen-2b');
  await f.self.onmessage({ data: { type: 'load', id: 1, model: 'qwen-2b' } });
  assert.equal(f.messages.at(-1).runtime.model, 'onnx-community/Qwen3.5-2B-ONNX-OPT');
  assert.equal(f.messages.at(-1).runtime.dtype, 'q4f16');
  await f.self.onmessage({ data: { type: 'generate', id: 2, model: 'qwen-2b', messages: [], maxNewTokens: 4096 } });
  assert.equal(f.messages.at(-1).type, 'result');
  assert.equal(f.options().max_new_tokens, 4096);
});

test('stage budgets replace the old 384-token command limit without tool schemas', async () => {
  const f = fixture(3000);
  for (const maxNewTokens of [2048,4096,1536]) {
    await f.self.onmessage({ data: { type: 'generate', id: maxNewTokens, messages: [], maxNewTokens } });
    assert.equal(f.options().max_new_tokens, maxNewTokens);
    assert.equal(f.options().tools, undefined);
    assert.equal(f.messages.at(-1).metrics.maxNewTokens, maxNewTokens);
  }
  assert.equal(f.disposed(),3);
  await f.self.onmessage({ data: { type: 'generate', id: 9, messages: [], maxNewTokens: 9000 } });
  assert.equal(f.generations(),3); assert.match(f.messages.at(-1).error,/generation budget/);
});

 test('Phi instruct uses the requested ONNX export and bounded generation',async()=>{
  const f=fixture(500,undefined,'phi-4-mini-instruct');
  await f.self.onmessage({data:{type:'generate',id:1,model:'phi-4-mini-instruct',messages:[],maxNewTokens:1024}});
  assert.equal(getLocalModel('phi-4-mini-instruct').id,'webgpu/Phi-4-mini-instruct-ONNX-OPT');
  assert.equal(f.messages.at(-1).type,'result');
  assert.equal(f.messages.at(-1).metrics.dtype,'q4f16');
  assert.equal(f.options().max_new_tokens,1024);
});

test('Phi fails before downloading weights when float16 GPU support is unavailable',async()=>{
  const f=fixture(500,undefined,'phi-4-mini-instruct',[]);
  await f.self.onmessage({data:{type:'load',id:1,model:'phi-4-mini-instruct'}});
  assert.match(f.messages.at(-1).error,/shader-f16/);
  assert.equal(f.generations(),0);
});
