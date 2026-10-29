import { inferenceError } from './provider-errors.mjs';
const MAX_PLAN_CHARS = 256_000;

export async function readCompletedResponse(response, onProgress) {
  if (!response.ok) throw await inferenceError(response);
  if (!response.body) throw new Error('ChatGPT returned an empty stream.');
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let buffer = '', bytes = 0, completed, refused = false;
  const parts = new Map();
  const bounded = text => {
    if (text.length > MAX_PLAN_CHARS) throw new Error(`ChatGPT editor plan exceeded ${MAX_PLAN_CHARS.toLocaleString('en-US')} characters. Request fewer slides or simpler content. No edits applied.`);
    return text;
  };
  const messageText = output => (Array.isArray(output) ? output : []).filter(item => item?.type === 'message')
    .flatMap(item => Array.isArray(item.content) ? item.content : []).filter(item => item?.type === 'output_text' && typeof item.text === 'string').map(item => item.text).join('');
  function consume(frame) {
    const data = frame.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
    if (!data || data === '[DONE]') return;
    const event = JSON.parse(data);
    onProgress?.(event.type);
    if (['response.failed', 'response.incomplete', 'error'].includes(event.type)) {
      const raw = event.response?.incomplete_details?.reason || event.response?.error?.code || event.error?.code || event.code || event.type;
      const reason = typeof raw === 'string' && /^[a-zA-Z0-9_.-]{1,80}$/.test(raw) ? raw : event.type;
      throw new Error(`ChatGPT could not complete the request (${reason}). No edits applied.`);
    }
    if (event.type === 'response.completed') {
      if (event.response?.status !== 'completed') throw new Error('ChatGPT response was not completed.');
      completed = event.response;
    }
    if (event.type === 'response.refusal.done') refused = true;
    if (['response.output_text.delta', 'response.output_text.done'].includes(event.type)) {
      const output = Number.isInteger(event.output_index) ? event.output_index : 0;
      const content = Number.isInteger(event.content_index) ? event.content_index : 0;
      const key = `${output}:${content}`;
      const previous = parts.get(key)?.text || '';
      const text = event.type.endsWith('.done') ? event.text : previous + (event.delta || '');
      if (typeof text !== 'string') throw new Error('ChatGPT returned invalid streamed text. No edits applied.');
      parts.set(key, { output, content, text: bounded(text) });
      bounded([...parts.values()].map(part => part.text).join(''));
    }
    if (event.type === 'response.output_item.done' && event.item?.type === 'message') {
      const output = Number.isInteger(event.output_index) ? event.output_index : 0;
      for (const [content, part] of (event.item.content || []).entries()) {
        if (part.type === 'refusal') refused = true;
        if (part.type === 'output_text' && typeof part.text === 'string') parts.set(`${output}:${content}`, { output, content, text: bounded(part.text) });
      }
    }
  }
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 4_000_000) throw new Error('ChatGPT response exceeded the allowed stream size. Request fewer slides. No edits applied.');
      buffer = (buffer + decoder.decode(value, { stream: true })).replace(/\r\n/g, '\n');
      let boundary;
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
        consume(frame);
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) consume(buffer); // Accept a final SSE event without a trailing blank line.
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  if (!completed) throw new Error('ChatGPT stream ended before completion. No edits applied.');
  if ((completed.output || []).some(item => item?.content?.some(part => part.type === 'refusal'))) refused = true;
  if (refused) throw new Error('ChatGPT declined this request. Rephrase it and try again. No edits applied.');
  // Some streams carry the text in output events but omit it from the terminal
  // snapshot. Never execute that text until a successful completion arrives.
  const text = bounded(messageText(completed.output) || [...parts.values()].sort((a, b) => a.output - b.output || a.content - b.content).map(part => part.text).join(''));
  if (!text.trim()) throw new Error('ChatGPT completed without an editor plan (no output text). Try the request again or choose another model. No edits applied.');
  return { text, inputTokens: completed.usage?.input_tokens || 0 };
}

