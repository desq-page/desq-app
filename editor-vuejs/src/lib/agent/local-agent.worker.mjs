import { pipeline, env } from '@huggingface/transformers';
import { createGemmaRuntime } from './gemma-local-runtime.mjs';
import { getLocalModel } from './local-models.mjs';

// This already runs in a dedicated worker. Avoid additional WASM threads and
// shared-memory growth inside the inference runtime.
env.allowLocalModels = false;
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.proxy = false;

let loading;
let busy = false;
let dtype;
let modelKey;

async function load(key = 'qwen-4b') {
  const spec = getLocalModel(key);
  if (loading && modelKey !== key) throw new Error('Stop the model before switching models.');
  modelKey = key;
  loading ??= (async () => {
    const adapter = await self.navigator.gpu?.requestAdapter();
    if (!adapter) throw new Error('WebGPU is unavailable. Use a WebGPU-enabled browser and GPU, or connect Gemini/OpenAI.');
    const progress_callback = progress => {
      if (progress.status === 'generating') self.postMessage({ type: 'progress', ...progress });
      if (progress.status === 'progress') self.postMessage({ type: 'progress', file: progress.file, progress: progress.progress });
    };
    if (spec.runtime === 'mediapipe') {
      dtype = spec.dtype;
      const [{default:wasmLoaderPath},{default:wasmBinaryPath}] = await Promise.all([
        import('@mediapipe/tasks-genai/genai_wasm_module_internal.js?url'),
        import('@mediapipe/tasks-genai/genai_wasm_module_internal.wasm?url'),
      ]);
      const runtime = await createGemmaRuntime(spec,{onProgress:progress_callback,
        loadLibrary:()=>import('@mediapipe/tasks-genai'), fileset:{wasmLoaderPath,wasmBinaryPath}});
      const generator=(...args)=>runtime.generate(...args);generator.tokenizer=runtime.tokenizer;
      return generator;
    }
    if(spec.requiresShaderF16&&!adapter.features.has('shader-f16'))
      throw Error('This Phi ONNX export requires a GPU with shader-f16 support. Choose Gemma or Qwen on this device.');
    dtype = spec.dtype === 'auto-q4' ? (adapter.features.has('shader-f16') ? 'q4f16' : 'q4') : spec.dtype;
    // The pipeline owns ONNX generation inputs, external weights and KV cache.
    const generator = await pipeline('text-generation', spec.id, {
      device: 'webgpu', dtype, progress_callback,
    });
    return generator;
  })().catch(error => { loading = undefined; throw error; });
  return loading;
}

self.onmessage = async ({ data }) => {
  if (busy) return;
  busy = true;
  let inputTokens = 0;
  try {
    const generator = await load(data.model);
    if (data.type === 'load') self.postMessage({ type: 'ready', id: data.id,
      runtime: { backend: 'webgpu', dtype, model: getLocalModel(data.model || 'qwen-4b').id } });
    else if (data.type === 'generate') {
      const messages = data.messages;
      const spec = getLocalModel(data.model || 'qwen-4b');
      const maxNewTokens = data.maxNewTokens ?? spec.maxOutputTokens;
      if (!Number.isInteger(maxNewTokens) || maxNewTokens < 1 || maxNewTokens > spec.maxOutputTokens)
        throw new Error('Invalid local generation budget.');
      const inputs = generator.tokenizer.apply_chat_template(messages, {
        add_generation_prompt: true, return_dict: true, enable_thinking: false,
      });
      try { inputTokens = inputs.input_ids.dims.at(-1); }
      finally { for (const tensor of Object.values(inputs)) tensor?.dispose?.(); }
      if (inputTokens > spec.maxInputTokens)
        throw new Error(`The slide context is too large (${inputTokens} tokens; limit ${spec.maxInputTokens}). Request fewer slides or shorter content.`);
      const started = performance.now();
      const output = await generator(messages, {
        max_new_tokens: maxNewTokens, do_sample: false,
        ...(spec.runtime === 'mediapipe' ? { stopSequence: data.stopSequence } : {}),
        tokenizer_encode_kwargs: { enable_thinking: false },
      });
      const text = output[0]?.generated_text?.at(-1)?.content;
      if (typeof text !== 'string') throw new Error('The model returned an unexpected response.');
      self.postMessage({ type: 'result', id: data.id, text,
        metrics: { backend: 'webgpu', dtype, inputTokens, maxNewTokens, inferenceMs: Math.round(performance.now() - started) } });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const fatal = /memory access out of bounds|out of memory|bad_alloc|unreachable|device.*lost|failed to call OrtRun\(\)/i.test(message);
    self.postMessage({ type: 'error', id: data.id, fatal,
      error: fatal ? `Local inference runtime failed (${dtype || 'loading'}, ${inputTokens} input tokens): ${message}. Load the local model again to restart. No editor tools were executed.` : message,
    });
  } finally { busy = false; }
};
