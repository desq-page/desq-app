import { CLIPTokenizer } from '@huggingface/transformers';
import WebSR from '@websr/websr';
import { env, InferenceSession, Tensor } from 'onnxruntime-web/webgpu';
import wasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm?url';

// The upstream Space publishes the revision and exact sizes of this asset set.
const modelRoot = 'https://huggingface.co/utkucoban/NanoDiffuser/resolve/14cff72356365c3586ee38a2237332525889b69c/';
const sizes = {
  'manifest.json': 679,
  'tokenizer/tokenizer.json': 3642073,
  'tokenizer/tokenizer_config.json': 391,
  'text_encoder_q4.onnx': 165192,
  'text_encoder_q4.onnx.data': 66276792,
  'unet_mixed_q4q8.onnx': 58597136,
  'unet_mixed_q4q8.onnx.data': 269300480,
  'vae_decoder_fp16.onnx': 29879,
  'vae_decoder_fp16.onnx.data': 2441088,
};
const totalBytes = Object.values(sizes).reduce((total, size) => total + size, 0);
const latentShape = [1, 4, 64, 64];
const tokenCount = 77;
const imageSize = 512;
const upscaleSize = imageSize * 2;
const upscaleWeightsUrl = 'https://cdn.jsdelivr.net/gh/sb2702/websr@v0.1.1/weights/websr/cnn-m.bin';
let assets;
let upscaleWeights;
let running = false;

function progress(message, percent) {
  self.postMessage({ type: 'progress', message, percent });
}

async function loadAssets() {
  let cache;
  try { cache = await caches.open('desq-nanodiffuser-v1'); } catch {}
  const files = new Map();
  let loaded = 0;
  let lastPercent = -1;
  for (const [path, expectedSize] of Object.entries(sizes)) {
    const url = new URL(path, modelRoot).href;
    let blob;
    try {
      const cached = await cache?.match(url);
      blob = await cached?.blob();
      if (blob?.size !== expectedSize) {
        blob = undefined;
        if (cached) await cache.delete(url);
      }
    } catch {}

    const report = (bytes) => {
      const percent = Math.floor((loaded + bytes) / totalBytes * 100);
      if (percent !== lastPercent) {
        progress('Loading model files', percent);
        lastPercent = percent;
      }
    };

    if (!blob) {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Could not download NanoDiffuser’s ${path}.`);
      const reader = response.body.getReader();
      const chunks = [];
      let received = 0;
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          received += value.byteLength;
          if (received > expectedSize) throw new Error(`Unexpected size for ${path}.`);
          chunks.push(value);
          report(received);
        }
      } finally {
        await reader.cancel();
      }
      blob = new Blob(chunks);
      if (blob.size !== expectedSize) throw new Error(`The download of ${path} was incomplete. Try again.`);
      try { await cache?.put(url, new Response(blob)); } catch {}
    }
    report(blob.size);
    loaded += blob.size;
    files.set(path, blob);
  }
  const readJson = async path => JSON.parse(await files.get(path).text());
  const manifest = await readJson('manifest.json');
  const tokenizer = new CLIPTokenizer(
    await readJson('tokenizer/tokenizer.json'),
    await readJson('tokenizer/tokenizer_config.json'),
  );
  return { files, manifest, tokenizer };
}

async function runModel(files, name, inputs, outputName, shape) {
  let session;
  let outputs;
  try {
    session = await InferenceSession.create(new Uint8Array(await files.get(name).arrayBuffer()), {
      executionProviders: [{ name: 'webgpu', preferredLayout: 'NCHW' }],
      graphOptimizationLevel: 'all',
      externalData: [{ path: `${name}.data`, data: files.get(`${name}.data`) }],
    });
    outputs = await session.run(inputs);
    const output = outputs[outputName];
    if (!output || output.dims.join() !== shape.join()) {
      throw new Error(`Diffuser returned an unexpected ${outputName} shape.`);
    }
    const data = await output.getData();
    // Copy the output before releasing the inference session and its tensors.
    return Float32Array.from(output.type === 'float16' && data instanceof Uint16Array
      ? new Float16Array(data.buffer, data.byteOffset, data.length)
      : data);
  } finally {
    for (const tensor of Object.values(inputs)) tensor.dispose();
    for (const tensor of Object.values(outputs || {})) tensor.dispose();
    await session?.release();
  }
}

function gaussianNoise(length) {
  const random = crypto.getRandomValues(new Uint32Array(length));
  const noise = new Float32Array(length);
  for (let i = 0; i < length; i += 2) {
    const radius = Math.sqrt(-2 * Math.log((random[i] + 1) / 2 ** 32));
    const angle = 2 * Math.PI * random[i + 1] / 2 ** 32;
    noise[i] = radius * Math.cos(angle);
    noise[i + 1] = radius * Math.sin(angle);
  }
  return noise;
}

const halfTensor = (values, shape) => new Tensor('float16', Float16Array.from(values), shape);

async function upscaleImage(source) {
  progress('Upscaling image to 1024 × 1024');
  upscaleWeights ||= fetch(upscaleWeightsUrl).then(async response => {
    if (!response.ok) throw new Error('Could not download the WebSR upscaling model. Try again.');
    return WebSR.parseBinaryWeights(await response.arrayBuffer());
  }).catch(error => {
    upscaleWeights = undefined;
    throw error;
  });
  const weights = await upscaleWeights;
  const gpu = await WebSR.initWebGPU();
  if (!gpu) throw new Error('WebSR could not initialize WebGPU.');
  const output = new OffscreenCanvas(upscaleSize, upscaleSize);
  let bitmap;
  let upscaler;
  try {
    bitmap = await createImageBitmap(source);
    upscaler = new WebSR({
      canvas: output,
      gpu,
      network_name: 'websr/cnn-m',
      weights,
      outputResolution: { width: upscaleSize, height: upscaleSize },
    });
    await upscaler.render(bitmap);
    await gpu.queue.onSubmittedWorkDone();
    if (output.width !== upscaleSize || output.height !== upscaleSize) {
      throw new Error('WebSR returned an unexpected image size.');
    }
    return await output.convertToBlob({ type: 'image/png' });
  } finally {
    bitmap?.close();
    if (upscaler) await upscaler.destroy();
    else gpu.destroy();
  }
}

async function generate(prompt) {
  if (typeof Float16Array !== 'function' || !await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' })) {
    throw new Error('Diffuser requires a recent browser with WebGPU and hardware acceleration.');
  }
  env.wasm.numThreads = 1;
  env.wasm.wasmPaths = { wasm: new URL(wasmUrl, self.location.href).href };
  env.webgpu.powerPreference = 'high-performance';

  assets ||= loadAssets().catch(error => {
    assets = undefined;
    throw error;
  });
  const { files, manifest: { models, scheduler }, tokenizer } = await assets;
  progress('Encoding prompt');
  const { input_ids } = tokenizer([prompt], { padding: 'max_length', truncation: true, max_length: tokenCount });
  const embeddingShape = [1, tokenCount, 768];
  const embeddings = await runModel(files, models.textEncoder, {
    input_ids: new Tensor('int32', Int32Array.from(input_ids.data, Number), [1, tokenCount]),
  }, 'encoder_hidden_states', embeddingShape);

  progress('Generating image');
  const initial = gaussianNoise(4 * 64 * 64).map(value => value * scheduler.initNoiseSigma);
  const prediction = await runModel(files, models.unet, {
    sample: halfTensor(initial.map(value => value * scheduler.modelInputScale), latentShape),
    timestep: new Tensor('float32', Float32Array.of(scheduler.timestep), [1]),
    encoder_hidden_states: halfTensor(embeddings, embeddingShape),
  }, 'noise_pred', latentShape);
  const latent = initial.map((value, index) =>
    scheduler.sampleCoefficient * value + scheduler.outputCoefficient * prediction[index]);

  progress('Decoding image');
  const decoded = await runModel(files, models.decoder, {
    latent: halfTensor(latent, latentShape),
  }, 'image', [1, 3, imageSize, imageSize]);
  const pixelCount = imageSize ** 2;
  const rgba = new Uint8ClampedArray(pixelCount * 4);
  for (let i = 0; i < pixelCount; i++) {
    rgba[i * 4] = decoded[i] * 255;
    rgba[i * 4 + 1] = decoded[i + pixelCount] * 255;
    rgba[i * 4 + 2] = decoded[i + pixelCount * 2] * 255;
    rgba[i * 4 + 3] = 255;
  }
  const canvas = new OffscreenCanvas(imageSize, imageSize);
  canvas.getContext('2d').putImageData(new ImageData(rgba, imageSize, imageSize), 0, 0);
  return upscaleImage(canvas);
}

self.onmessage = async ({ data: { prompt } }) => {
  if (running) return;
  running = true;
  try {
    const image = await generate(prompt);
    self.postMessage({ type: 'result', image });
  } catch (error) {
    self.postMessage({ type: 'error', message: error.message || 'Image generation failed.' });
  } finally {
    running = false;
  }
};
