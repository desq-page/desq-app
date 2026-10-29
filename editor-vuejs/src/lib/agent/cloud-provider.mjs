import { buildImageRelevance } from './image-relevance.mjs';
import { buildProviderPlan, buildProviderTemplate, buildProviderRewrite, buildProviderKeywords, providerModels } from './provider-request.mjs';
import { buildProviderImage, readProviderImage, imageResponseJson } from './provider-images.mjs';
import { readCompletedResponse } from './openai-response.mjs';
import { readGeminiPlan } from './gemini-response.mjs';
import { DECK_AUTHORING_VERSION } from './deck-authoring.mjs';

// Browser owns prompts, provider formats, progress and output interpretation.
// The same-origin host supplies credentials and relays only bounded responses.
export async function cloudProviderRequest(provider, path, { signal, body, onProgress } = {}) {
  const label = provider === 'chatgpt' ? 'ChatGPT' : 'Gemini';
  const generation = ['plan', 'image', 'keywords', 'template-outline', 'template-content', 'rewrite', 'image-match'].includes(path);
  const payload = ['template-outline','template-content'].includes(path) ? buildProviderTemplate(provider,path,body) : path === 'rewrite' ? buildProviderRewrite(provider, body) : path === 'image-match' ? buildImageRelevance(provider, body) : path === 'keywords' ? buildProviderKeywords(provider, body) : path === 'plan' ? buildProviderPlan(provider, body)
    : path === 'image' ? buildProviderImage(provider, body.model, body) : body;
  const timeoutMs = path === 'image' ? 210_000 : path === 'plan' ? (provider === 'chatgpt' ? 630_000 : 150_000) : 150_000;
  const timeout = AbortSignal.timeout(timeoutMs);
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const started = performance.now();
  const subject = path === 'template-content' ? 'template content' : path === 'template-outline' ? 'template layout plan' : path === 'rewrite' ? 'concise text rewrite' : path === 'image-match' ? 'image relevance check' : path === 'keywords' ? 'image-search keywords' : path === 'image' ? 'image' : 'editor plan';
  let phase = `Waiting for ${label} to prepare the ${subject}`, lastProgress = -Infinity;
  const progress = () => {
    lastProgress = performance.now();
    onProgress?.(`${phase}… ${Math.floor((performance.now() - started) / 1000)}s elapsed`);
  };
  if (generation) progress();
  const heartbeat = generation && onProgress ? setInterval(progress, 10_000) : undefined;
  try {
    const response = await fetch(`/api/agent/${provider}/${['keywords', 'template-outline', 'template-content', 'rewrite', 'image-match'].includes(path) ? 'plan' : path}`, {
      method: payload === undefined ? 'GET' : 'POST', credentials: 'same-origin', signal: requestSignal,
      headers: { 'X-Editor-Agent': '1', ...(generation ? { Accept: provider === 'chatgpt' ? 'text/event-stream' : 'application/json' } : {}),
        ...(payload === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
    });
    if (!response.ok) {
      let data; try { data = await response.json(); } catch { /* Only normalized host errors are displayed. */ }
      throw new Error(typeof data?.error === 'string' ? data.error : `${label} request failed (HTTP ${response.status}).`);
    }
    if (!generation) {
      const data = await response.json();
      if (provider === 'gemini' && path === 'connect' && data.catalog) {
        let pageToken = data.nextPageToken;
        for (let page = 1; pageToken; page++) {
          if (page >= 10) throw new Error('Gemini model catalog is too large. Try again later.');
          const next = await fetch(`/api/agent/gemini/models?${new URLSearchParams({ pageToken })}`, {
            credentials: 'same-origin', signal: requestSignal, headers: { 'X-Editor-Agent': '1' },
          });
          const nextData = await next.json();
          if (!next.ok) throw new Error(nextData.error || 'Cannot load Gemini models.');
          data.catalog.push(...(nextData.catalog || []));
          pageToken = nextData.nextPageToken;
        }
        delete data.nextPageToken;
      }
      if (data.catalog) return { ...data, models: providerModels(provider, data.catalog, data.authMode) };
      return data;
    }
    if (response.headers.get('X-Editor-Agent-Version') !== DECK_AUTHORING_VERSION) {
      await response.body?.cancel();
      throw new Error('The editor server is running older authoring code. Restart the editor server and refresh the page. No edits applied.');
    }
    phase = `Receiving the ${subject} from ${label}`;
    progress();
    if (path === 'image') return await readProviderImage(response, provider, response.headers.get('X-Editor-Image-Model') || body.model);
    const result = provider === 'chatgpt'
      ? await readCompletedResponse(response, type => {
        if (type === 'response.output_text.delta' && performance.now() - lastProgress >= 2000) progress();
      })
      : readGeminiPlan(await imageResponseJson(response, 'Gemini'));
    requestSignal.throwIfAborted();
    return { ...result, authoringVersion: DECK_AUTHORING_VERSION, inferenceMs: performance.now() - started };
  } catch (error) {
    if (signal?.aborted) throw error;
    if (timeout.aborted) throw new Error(`${label} request timed out. No edits applied. Try fewer slides or another model.`);
    throw error;
  } finally { clearInterval(heartbeat); }
}
