// The server controls destinations, credentials, budgets and transport only.
// Editor prompts, provider output interpretation and all document work live in
// the browser. A caller cannot supply a URL or authorization header here.
export function validateProviderPayload(body, provider, image = false) {
  const request = body?.request;
  if (!request || typeof request !== 'object' || Array.isArray(request) || JSON.stringify(request).length > 750_000)
    throw new Error('Invalid or oversized provider request. Refresh the editor and retry.');
  const allowed = provider === 'chatgpt'
    ? ['model', 'store', 'stream', 'instructions', 'input', ...(image ? ['tools'] : [])]
    : ['systemInstruction', 'contents', 'generationConfig'];
  if (Object.keys(request).some(key => !allowed.includes(key))) throw new Error('Unsupported provider request field.');
  if (provider === 'chatgpt') {
    if (request.model !== body.model || request.store !== false || request.stream !== true || !Array.isArray(request.input))
      throw new Error('Invalid OpenAI proxy request.');
    if (image && (!Array.isArray(request.tools) || request.tools.length !== 1 || request.tools[0].type !== 'image_generation'))
      throw new Error('Only image generation is supported on this endpoint.');
  } else {
    if (!Array.isArray(request.contents) || request.generationConfig?.candidateCount !== 1 ||
      (!image && (!Number.isInteger(request.generationConfig?.maxOutputTokens) || request.generationConfig.maxOutputTokens < 1 || request.generationConfig.maxOutputTokens > 32768)))
      throw new Error('Invalid Gemini proxy request.');
  }
  return request;
}

export async function relayProviderResponse(response, res, { maxBytes, version, imageModel }) {
  if (!response.body) throw new Error('The provider returned an empty response.');
  res.set('Content-Type', response.headers.get('content-type') || 'application/json');
  res.set('Cache-Control', 'no-store');
  res.set('X-Accel-Buffering', 'no');
  res.set('X-Editor-Agent-Version', version);
  if (imageModel) res.set('X-Editor-Image-Model', imageModel);
  res.flushHeaders();
  const reader = response.body.getReader(); let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) throw new Error('Provider response exceeded the transport limit.');
      if (res.destroyed) break;
      res.write(value);
    }
    if (!res.destroyed) res.end();
  } catch (error) {
    res.destroy(new Error('Provider stream interrupted.'));
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
