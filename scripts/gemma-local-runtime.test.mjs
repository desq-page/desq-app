import test from "node:test";
import assert from "node:assert/strict";
import {
  gemmaPrompt,
  gemmaResponse,
  createGemmaRuntime,
} from "../editor-vuejs/src/lib/agent/gemma-local-runtime.mjs";
import { getLocalModel } from "../editor-vuejs/src/lib/agent/local-models.mjs";
test("Gemma uses its own turn tokens without enabling thinking, and strips non-final output", () => {
  const prompt = gemmaPrompt([
    { role: "system", content: "Write Markdown" },
    { role: "user", content: "Topic" },
    { role: "assistant", content: "Answer" },
  ]);
  assert.match(prompt, /<\|turn>system\nWrite Markdown<turn\|>/);
  assert.ok(prompt.endsWith("<|turn>model\n"));
  assert.ok(!prompt.includes("<|think|>"));
  assert.equal(
    gemmaResponse("<|channel>thought\ninternal<channel|># Slide<turn|>"),
    "# Slide",
  );
});
test("Gemma adapter streams cached weights, uses total-context budgets and preserves output", async () => {
  const spec = getLocalModel("gemma-4-e4b"),
    progress = [],
    updates = [];
  let options,
    closed = false;
  const cache = {
    match: async () =>
      new Response(new Uint8Array([1, 2, 3]), {
        headers: { "content-length": "3" },
      }),
  };
  const engine = {
    sizeInTokens: () => 64,
    setOptions: async (options) => updates.push(options),
    generateResponse: async () => "# Slide\nContent",
    close: () => {
      closed = true;
    },
  };
  const runtime = await createGemmaRuntime(spec, {
    cacheStorage: { open: async () => cache },
    fetchFile: () => {
      throw Error("Cached weights must be reused");
    },
    onProgress: (p) => progress.push(p),
    fileset: { wasmLoaderPath: "loader.js", wasmBinaryPath: "model.wasm" },
    loadLibrary: async () => ({
      LlmInference: {
        createFromOptions: async (fileset, config) => {
          options = config;
          await config.baseOptions.modelAssetBuffer.read();
          return engine;
        },
      },
    }),
  });
  assert.equal(options.maxTokens, 12288);
  assert.equal(options.maxNumImages, 0);
  assert.equal(options.supportAudio, false);
  const result = await runtime.generate(
    [{ role: "user", content: "A topic" }],
    { max_new_tokens: 256 },
  );
  assert.equal(updates.length, 0);
  assert.match(result[0].generated_text[0].content, /# Slide/);
  assert.equal(progress[0].progress, 100);
  runtime.dispose();
  assert.equal(closed, true);
});
test("model HTML responses fail clearly before loading the inference engine", async () => {
  await assert.rejects(
    createGemmaRuntime(getLocalModel("gemma-4-e4b"), {
      cacheStorage: null,
      fileset: {},
      loadLibrary: async () => ({}),
      fetchFile: async () =>
        new Response("<!DOCTYPE html>", {
          headers: { "content-type": "text/html" },
        }),
    }),
    /web page instead of model weights/,
  );
});

test("Gemma streaming cancellation bounds output without reloading model weights", async () => {
  let cancelled = false, generating = false;
  const engine = {
    sizeInTokens: (text) => { assert.equal(generating, false, "Never tokenize during streaming"); return text.length; },
    generateResponse: async (prompt, callback) => {
      generating = true;
      callback("x".repeat(800), false);
      generating = false;
      return "x".repeat(160);
    },
    cancelProcessing: () => {
      cancelled = true;
    },
    close() {},
    setOptions() {
      throw Error("Must not reload weights");
    },
  };
  const runtime = await createGemmaRuntime(getLocalModel("gemma-4-e4b"), {
    cacheStorage: null,
    fetchFile: async () => new Response(new Uint8Array([1])),
    fileset: {},
    loadLibrary: async () => ({
      LlmInference: { createFromOptions: async () => engine },
    }),
  });
  const result = await runtime.generate([{ role: "user", content: "Test" }], {
    max_new_tokens: 128,
  });
  assert.equal(cancelled, true);
  assert.equal(result[0].generated_text[0].content.length, 128);
});

test('Gemma streams progress and stops only after the complete outer HTML section', async () => {
  let active = false, cancelled = 0;
  const progress = [];
  const html = '<section><section>Nested</section><h1>Finished</h1></section>';
  const engine = {
    sizeInTokens: text => { assert.equal(active, false); return Math.ceil(text.length / 4); },
    async generateResponse(prompt, callback) {
      active = true;
      callback('<section><section>Nested</section>', false);
      assert.equal(cancelled, 0);
      callback('<h1>Finished</h1></section>', false);
      assert.equal(cancelled, 1);
      active = false;
      return html + 'unwanted continuation';
    },
    cancelProcessing() { cancelled++; }, close() {},
  };
  const runtime = await createGemmaRuntime(getLocalModel('gemma-4-e4b'), {
    cacheStorage: null, fetchFile: async () => new Response(new Uint8Array([1])),
    fileset: {}, onProgress: event => progress.push(event),
    loadLibrary: async () => ({LlmInference: {createFromOptions: async () => engine}}),
  });
  const result = await runtime.generate([{role:'user',content:'Create HTML'}], {max_new_tokens:256,stopSequence:'</section>'});
  assert.equal(result[0].generated_text[0].content, html);
  assert.ok(progress.some(event => event.status === 'generating' && event.characters > 0));
});

test('Gemma accepts the 5594-token template prompt and retains the increased input guard', async()=>{
  let promptTokens=5594, generations=0;
  const spec=getLocalModel('gemma-4-e4b');
  const messages=[{role:'user',content:'Template and source evidence'}];
  const prompt=gemmaPrompt(messages);
  const runtime=await createGemmaRuntime(spec,{
    cacheStorage:null,fetchFile:async()=>new Response(new Uint8Array([1])),fileset:{},
    loadLibrary:async()=>({LlmInference:{createFromOptions:async(_fileset,options)=>{
      assert.equal(options.maxTokens,12288);
      return {sizeInTokens:text=>text===prompt?promptTokens:16,
        generateResponse:async()=>{generations++;return 'Generated content';},close(){}};
    }}}),
  });
  const result=await runtime.generate(messages,{max_new_tokens:256});
  assert.equal(result[0].generated_text[0].content,'Generated content');
  assert.equal(generations,1);
  promptTokens=8193;
  await assert.rejects(runtime.generate(messages,{max_new_tokens:256}),/input-token limit/);
  assert.equal(generations,1);
  runtime.dispose();
});
