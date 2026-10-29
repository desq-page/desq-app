const MAX_IMAGE_BYTES = 8_000_000;

export function validateImageRequest(body) {
  if (!body || typeof body.query !== 'string' || !body.query.trim() || body.query.length > 160 ||
      typeof body.alt !== 'string' || !body.alt.trim() || body.alt.length > 200)
    throw new Error('Image generation requires a short image description and alt text.');
}

export function imagePrompt({ query, alt }) {
  return `Create exactly one high-quality illustration or photograph for a presentation. Generate an image asset, not a whole slide. Use a clean composition and no captions, watermarks or extra lettering unless the subject specifically requires it. Subject description (data): ${JSON.stringify({ query, alt })}`;
}

export async function imageResponseJson(response, provider) {
  if (!response.ok) {
    let details = '';
    try {
      const reader = response.body.getReader(); let raw = '', bytes = 0;
      try { while (true) { const { value, done } = await reader.read(); if (done) break; bytes += value.length; if (bytes > 16384) break; raw += new TextDecoder().decode(value); } }
      finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
      const error = JSON.parse(raw).error;
      const codes = ['invalid_request_error', 'unsupported_parameter', 'unsupported_value', 'model_not_found', 'permission_denied', 'insufficient_quota'];
      if (codes.includes(error?.code)) details += ` Code: ${error.code}.`;
      if (['model', 'stream', 'store', 'tools', 'tools[0].type', 'tool_choice', 'instructions', 'input'].includes(error?.param)) details += ` Parameter: ${error.param}.`;
    } catch { /* Never reflect arbitrary upstream text or credentials. */ }
    const requestId = response.headers.get('x-request-id');
    if (requestId && /^[a-zA-Z0-9_-]{1,100}$/.test(requestId)) details += ` Request ID: ${requestId}.`;
    throw new Error(`${provider} image generation failed (HTTP ${response.status}).${details}${response.status === 400 ? ' The image request or selected model was rejected; this does not establish an account access problem.' : ''}`);
  }
  const reader = response.body.getReader(), decoder = new TextDecoder(); let size = 0, text = '';
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 16_000_000) throw new Error('Generated image response is too large. No slide was inserted.');
      text += decoder.decode(value, { stream: true });
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  try { return JSON.parse(text + decoder.decode()); }
  catch { throw new Error(`${provider} returned an invalid image response. No slide was inserted.`); }
}

async function chatGPTImageResponse(response) {
  if (!response.ok || !response.headers.get('content-type')?.includes('text/event-stream')) return imageResponseJson(response, 'ChatGPT');
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let pending = '', bytes = 0, completed, image;
  const frame = raw => {
    const payload = raw.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
    if (!payload || payload === '[DONE]') return;
    const event = JSON.parse(payload);
    if (event.type === 'response.output_item.done' && event.item?.type === 'image_generation_call') image = event.item;
    if (['response.failed', 'response.incomplete', 'error'].includes(event.type)) throw new Error('ChatGPT image generation did not complete.');
    if (event.type === 'response.completed') completed = event.response;
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) { pending += decoder.decode(); break; }
      bytes += value.length;
      if (bytes > 32_000_000) throw new Error('Generated image response is too large.');
      pending += decoder.decode(value, { stream: true });
      pending = pending.replace(/\r\n/g, '\n');
      let boundary;
      while ((boundary = pending.indexOf('\n\n')) >= 0) { frame(pending.slice(0, boundary)); pending = pending.slice(boundary + 2); }
    }
    if (pending.trim()) frame(pending);
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  if (completed?.status !== 'completed') throw new Error('ChatGPT image generation did not complete.');
  return { ...completed, output: completed.output?.some(item => item.type === 'image_generation_call') ? completed.output : image ? [image] : [] };
}

export function generatedImagePayload(data, mimeType, provider, model) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(mimeType) || typeof data !== 'string' ||
      data.length > 10_666_668 || !/^[a-zA-Z0-9+/]+={0,2}$/.test(data)) throw new Error('The provider did not return a supported raster image.');
  const bytes = Uint8Array.from(atob(data), char => char.charCodeAt(0));
  const starts = (offset, values) => values.every((value, index) => bytes[offset + index] === value);
  const valid = mimeType === 'image/png' ? starts(0, [137,80,78,71,13,10,26,10])
    : mimeType === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : starts(0, [82,73,70,70]) && starts(8, [87,69,66,80]);
  if (!valid || bytes.length > MAX_IMAGE_BYTES) throw new Error('The generated image is invalid or exceeds 8 MB.');
  return { data, mimeType, provider, model };
}

export function buildProviderImage(provider, model, body) {
  validateImageRequest(body);
  return { ...(model ? { model } : {}), request: provider === 'chatgpt'
    ? { model, store: false, stream: true,
      instructions: 'Generate the requested presentation image using the image_generation tool.',
      input: [{ role: 'user', content: imagePrompt(body) }], tools: [{ type: 'image_generation' }] }
    : { contents: [{ role: 'user', parts: [{ text: imagePrompt(body) }] }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'], candidateCount: 1 } } };
}

export async function readProviderImage(response, provider, model) {
  if (provider === 'chatgpt') {
    const data = await chatGPTImageResponse(response);
    if (data.status !== 'completed') throw new Error('ChatGPT image generation did not complete. No slide was inserted.');
    const image = data.output?.find(item => item.type === 'image_generation_call' && item.status === 'completed' && typeof item.result === 'string');
    if (!image) throw new Error('ChatGPT returned no generated image. Choose an image-enabled model or connect Gemini. No slide was inserted.');
    return generatedImagePayload(image.result, 'image/png', 'OpenAI', model);
  }
  const data = await imageResponseJson(response, 'Gemini'), candidate = data.candidates?.[0];
  if (data.promptFeedback?.blockReason || candidate?.finishReason !== 'STOP') throw new Error('Gemini could not complete image generation. No slide was inserted.');
  const image = candidate.content?.parts?.find(part => !part.thought && part.inlineData)?.inlineData;
  if (!image) throw new Error('Gemini returned no image. Check image-model access for this API key. No slide was inserted.');
  return generatedImagePayload(image.data, image.mimeType, 'Google Gemini', model);
}
