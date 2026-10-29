// Integration fixtures exercise the same browser builders/parsers around the
// credential proxy, rather than expecting the host to interpret provider data.
import { buildProviderPlan, providerModels } from '../editor-vuejs/src/lib/agent/provider-request.mjs';
import { buildProviderImage, readProviderImage } from '../editor-vuejs/src/lib/agent/provider-images.mjs';
import { readCompletedResponse } from '../editor-vuejs/src/lib/agent/openai-response.mjs';
import { readGeminiPlan } from '../editor-vuejs/src/lib/agent/gemini-response.mjs';
export function preparedBody(provider, path, body) {
  return path === 'plan' ? buildProviderPlan(provider, body) : path === 'image' ? buildProviderImage(provider, body.model, body) : body;
}
export async function browserResult(provider, path, response) {
  try {
    if (response.ok && path === 'plan') return provider === 'chatgpt' ? await readCompletedResponse(response) : readGeminiPlan(await response.json());
    if (response.ok && path === 'image') return await readProviderImage(response, provider, response.headers.get('X-Editor-Image-Model'));
    const data = await response.json();
    return data.catalog ? { ...data, models: providerModels(provider, data.catalog, data.authMode) } : data;
  } catch (error) { return { error: error.message }; }
}
