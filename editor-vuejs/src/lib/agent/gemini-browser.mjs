import { buildImageRelevance } from './image-relevance.mjs';
import { buildProviderPlan, buildProviderTemplate, buildProviderRewrite, buildProviderKeywords, providerModels } from './provider-request.mjs';
import { buildProviderImage, readProviderImage } from './provider-images.mjs';
import { readGeminiPlan } from './gemini-response.mjs';
import { geminiAPIError } from './gemini-errors.mjs';
import { DECK_AUTHORING_VERSION } from './deck-authoring.mjs';

const API = 'https://generativelanguage.googleapis.com/v1beta';
async function readJson(response, limit = 2_000_000) {
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let source = '', bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) throw Error('Gemini response exceeded the allowed size.');
      source += decoder.decode(value, { stream: true });
    }
    return JSON.parse(source + decoder.decode());
  } catch (error) {
    if (error instanceof SyntaxError) throw Error('Gemini returned an invalid response.');
    throw error;
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

// Each browser owns its user's key. No credentials or Gemini traffic go to the
// editor backend. Persistence is managed by the existing connection preferences.
export function createGeminiBrowserClient({ fetchImpl = (...args) => fetch(...args), imageModel = 'gemini-2.5-flash-image' } = {}) {
  if (!/^gemini-[a-zA-Z0-9._-]+$/.test(imageModel)) throw Error('Invalid Gemini image model.');
  let apiKey = '', models = new Set(), connection = new AbortController();
  async function google(path, key, signal, payload) {
    const response = await fetchImpl(`${API}/${path}`, {
      method: payload === undefined ? 'GET' : 'POST', credentials: 'omit', signal,
      headers: { 'x-goog-api-key': key, ...(payload === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
    });
    if (!response.ok) throw await geminiAPIError(response, path.startsWith('models?') ? 'models' : 'generation', { direct: true });
    return response;
  }
  return async function request(path, { body, signal, onProgress } = {}) {
    if (path === 'disconnect') {
      connection.abort(); connection = new AbortController(); apiKey = ''; models.clear();
      return { disconnected: true };
    }
    if (!['connect', 'plan', 'keywords', 'template-outline', 'template-content', 'rewrite', 'image', 'image-match'].includes(path)) throw Error('Unknown Gemini browser request.');
    if (path === 'connect') {
      const key = body?.apiKey ?? apiKey;
      if (typeof key !== 'string' || !key.trim() || key.length > 512 || /[\r\n]/.test(key)) throw Error('Enter a valid Google AI Studio API key.');
      connection.abort(); connection = new AbortController(); apiKey = ''; models.clear();
      const combined = AbortSignal.any([connection.signal, AbortSignal.timeout(120_000), ...(signal ? [signal] : [])]);
      const catalog = []; let pageToken;
      for (let page = 0; ; page++) {
        if (page >= 10) throw Error('Gemini model catalog is too large.');
        const query = new URLSearchParams({ pageSize: '100', ...(pageToken ? { pageToken } : {}) });
        const data = await readJson(await google(`models?${query}`, key.trim(), combined));
        combined.throwIfAborted();
        catalog.push(...(Array.isArray(data.models) ? data.models : []));
        pageToken = data.nextPageToken;
        if (!pageToken) break;
        if (typeof pageToken !== 'string' || pageToken.length > 2048) throw Error('Invalid Gemini catalog page.');
      }
      const available = providerModels('gemini', catalog);
      if (!available.length) throw Error('No Gemini text models are available to this key.');
      apiKey = key.trim(); models = new Set(available.map(model => model.id));
      return { catalog, models: available, imageModel };
    }
    if (!apiKey) throw Error('Connect Gemini before sending a command.');
    const model = path === 'image' ? `models/${imageModel}` : body?.model;
    if (!/^models\/gemini-[a-zA-Z0-9._-]+$/.test(model) || (path !== 'image' && !models.has(model))) throw Error('Choose an available Gemini model.');
    const payload = path === 'image-match' ? buildImageRelevance('gemini', body) : path === 'image' ? buildProviderImage('gemini', model, body)
      : ['template-outline','template-content'].includes(path) ? buildProviderTemplate('gemini',path,body) : path === 'rewrite' ? buildProviderRewrite('gemini',body) : path === 'keywords' ? buildProviderKeywords('gemini', body) : buildProviderPlan('gemini', body);
    const timeout = AbortSignal.timeout(path === 'image' ? 210_000 : 150_000);
    const combined = AbortSignal.any([connection.signal, timeout, ...(signal ? [signal] : [])]);
    const started = performance.now(), subject = path === 'template-content' ? 'template content' : path === 'template-outline' ? 'template layout plan' : path === 'rewrite' ? 'concise text rewrite' : path === 'image-match' ? 'image relevance check' : path === 'image' ? 'image' : path === 'keywords' ? 'image-search keywords' : 'editor plan';
    let phase = `Waiting for Gemini to prepare the ${subject}`;
    const progress = () => onProgress?.(`${phase}… ${Math.floor((performance.now() - started) / 1000)}s elapsed`);
    progress();
    const heartbeat = onProgress ? setInterval(progress, 10_000) : undefined;
    try {
      const response = await google(`${model}:generateContent`, apiKey, combined, payload.request);
      phase = `Receiving the ${subject} from Gemini`; progress();
      const result = path === 'image' ? await readProviderImage(response, 'gemini', imageModel) : readGeminiPlan(await readJson(response));
      combined.throwIfAborted();
      return path === 'image' ? result : { ...result, authoringVersion: DECK_AUTHORING_VERSION, inferenceMs: performance.now() - started };
    } catch (error) {
      if (timeout.aborted && !signal?.aborted && !connection.signal.aborted) throw Error('Gemini request timed out. No edits applied. Try fewer slides or another model.');
      throw error;
    } finally { clearInterval(heartbeat); }
  };
}
