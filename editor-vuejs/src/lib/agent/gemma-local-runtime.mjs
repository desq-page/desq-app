// Gemma 4 .task models use MediaPipe/LiteRT, matching the linked WebGPU demo.
export function gemmaPrompt(messages) {
  return (
    messages
      .map(
        (message) =>
          `<|turn>${message.role === "assistant" ? "model" : message.role}\n${String(message.content).replace(/<\|(?:turn|channel|think|tool)[^>]*>|<turn\|>|<channel\|>/g, "")}<turn|>\n`,
      )
      .join("") + "<|turn>model\n"
  );
}
export function gemmaResponse(text) {
  return String(text)
    .replace(/<\|channel>thought[\s\S]*?<channel\|>/g, "")
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/<turn\|>|<\|turn>model\s*/g, "")
    .trim();
}
export async function createGemmaRuntime(
  spec,
  {
    onProgress = () => {},
    fetchFile = fetch,
    cacheStorage = globalThis.caches,
    loadLibrary,
    fileset,
  } = {},
) {
  const { LlmInference } = await loadLibrary();
  let cache;
  try {
    cache = await cacheStorage?.open("savanna-gemma-models-v1");
  } catch {
    onProgress({
      status: "warning",
      file: "Model cache unavailable; downloading directly.",
    });
  }
  let response = await cache?.match(spec.url);
  if (!response) {
    response = await fetchFile(spec.url);
    if (!response.ok || !response.body)
      throw Error(`Gemma model download failed (HTTP ${response.status}).`);
    if (
      /text\/html|application\/json/.test(
        response.headers.get("content-type") || "",
      )
    )
      throw Error(
        "Gemma model download returned a web page instead of model weights.",
      );
    // Cache streaming writes without constructing a multi-gigabyte ArrayBuffer.
    if (cache) {
      const copy = response.clone();
      cache.put(spec.url, copy).catch(() =>
        onProgress({
          status: "warning",
          file: "Model cache unavailable; future loads may download weights again.",
        }),
      );
    }
  }
  const size = Number(response.headers.get("content-length")) || 0;
  let loaded = 0;
  const stream = response.body.pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        loaded += chunk.byteLength;
        onProgress({
          status: "progress",
          file: spec.label,
          progress: size ? (loaded / size) * 100 : 0,
          loaded,
          total: size,
        });
        controller.enqueue(chunk);
      },
    }),
  );
  const engine = await LlmInference.createFromOptions(fileset, {
    baseOptions: { modelAssetBuffer: stream.getReader() },
    maxTokens: spec.maxInputTokens + spec.maxOutputTokens,
    topK: 1,
    temperature: 0,
    randomSeed: 17,
    numResponses: 1,
    maxNumImages: 0,
    supportAudio: false,
  });
  const countTokens = (messages) => {
    const count = engine.sizeInTokens(gemmaPrompt(messages));
    if (!Number.isInteger(count) || count < 0)
      throw Error("Gemma could not measure the prompt token count.");
    return count;
  };
  return {
    tokenizer: {
      apply_chat_template(messages) {
        return {
          input_ids: {
            dims: [1, countTokens(messages)],
            dispose() {},
          },
        };
      },
    },
    async generate(messages, { max_new_tokens, stopSequence }) {
      const prompt = gemmaPrompt(messages),
        inputTokens = countTokens(messages);
      if (inputTokens > spec.maxInputTokens)
        throw Error("Gemma prompt exceeds its input-token limit.");
      // Do not call back into the WASM tokenizer while generation owns the
      // engine. The demo counts tokens only after completion, too.
      let collected = "", cancelled = false, lastProgress = -Infinity, completeLength = 0;
      const started = performance.now();
      let output = await engine.generateResponse(prompt, (chunk, done) => {
        collected += chunk;
        const now = performance.now();
        if (done || now - lastProgress >= 500) {
          lastProgress = now;
          onProgress({ status: "generating", characters: collected.length,
            elapsedMs: Math.round(now - started) });
        }
        if (stopSequence && collected.includes(stopSequence)) {
          const end = collected.lastIndexOf(stopSequence) + stopSequence.length;
          const candidate = collected.slice(0, end);
          // Nested section elements must finish before stopping the root section.
          if (stopSequence !== '</section>' ||
              (candidate.match(/<section[\s>]/gi) || []).length ===
              (candidate.match(/<\/section>/gi) || []).length) completeLength = end;
        }
        // Character cap is only an emergency bound; enforce actual tokens once
        // the engine has finished. Complete HTML can stop at its closing section.
        if (!done && !cancelled && (collected.length >= max_new_tokens * 6 || completeLength)) {
          cancelled = true;
          engine.cancelProcessing();
        }
      });
      if (completeLength) output = collected.slice(0, completeLength);
      if ((engine.sizeInTokens(output) || 0) > max_new_tokens) {
        let low = 0,
          high = output.length;
        while (low < high) {
          const mid = Math.ceil((low + high) / 2);
          if (
            (engine.sizeInTokens(output.slice(0, mid)) || 0) <= max_new_tokens
          )
            low = mid;
          else high = mid - 1;
        }
        output = output.slice(0, low).replace(/[\uD800-\uDBFF]$/, "");
      }
      return [
        {
          generated_text: [
            {
              role: "assistant",
              content: gemmaResponse(output),
            },
          ],
        },
      ];
    },
    dispose: () => engine.close(),
  };
}
