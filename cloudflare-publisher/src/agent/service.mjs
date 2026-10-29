import {fetchSourceHTML} from './source-url.mjs';
import { createChatGPTProvider } from './chatgpt.mjs';
import { createGeminiProvider } from './gemini.mjs';

export const isAgentPath = path => path === '/api/agent' || path.startsWith('/api/agent/');

export function createAgentState() {
  return { chatgpt: new Map(), gemini: new Map(), attempts: new Map() };
}

// Persist only credentials/registration data, never controllers or in-flight work.
export function snapshotAgentState(state) {
  return Object.fromEntries(Object.entries(state).map(([name, map]) => [name,
    [...map].map(([id, value]) => [id, Object.fromEntries(Object.entries(value)
      .filter(([key]) => !['controller', 'imageController', 'refreshing', 'busy'].includes(key))
      .map(([key, item]) => [key, item instanceof Set ? [...item] : item]))]) ]));
}

export function restoreAgentState(snapshot) {
  const state = createAgentState();
  for (const name of Object.keys(state)) for (const [id, value] of snapshot?.[name] || []) {
    if (value.expiresAt <= Date.now()) continue;
    state[name].set(id, { ...value, ...(value.models ? { models: new Set(value.models) } : {}) });
  }
  return state;
}

export function createAgentService({ origins, hostId, localOAuth = false, hostedOAuth, getRedirectUri,
  fetchImpl = fetch, geminiApiKey, geminiImageModel, state = createAgentState(), onCredentialsChanged, oauthSessionMaxAgeMs, validateSourceHost }) {
  if (!origins?.length || origins.some(origin => new URL(origin).origin !== origin))
    throw new Error('Explicit editor origins are required for agent hosting.');
  const trustedRequest = req => {
    // Compare the actual URL/Host with configuration, never forwarded headers.
    return origins.some(origin => new URL(origin).host === req.headers.host);
  };
  const chatgpt = createChatGPTProvider({ hostId, origins, trustedRequest, fetchImpl,
    authMode: localOAuth || hostedOAuth ? 'oauth' : 'api-key', hostedOAuth, getRedirectUri,
    sessions: state.chatgpt, attempts: state.attempts, onCredentialsChanged, sessionMaxAgeMs: oauthSessionMaxAgeMs, validateSourceHost });
  const gemini = createGeminiProvider({ origins, trustedRequest, fetchImpl,
    apiKey: geminiApiKey, imageModel: geminiImageModel, sessions: state.gemini });
  return {
    state,
    async fetch(request) {
      const path = new URL(request.url).pathname;
      if (path === '/api/agent/sources/url') {
        if (request.method !== 'POST') return new Response('Method not allowed', {status:405});
        if (!origins.includes(new URL(request.url).origin) || request.headers.get('origin') !== new URL(request.url).origin)
          return new Response('Forbidden', {status:403});
        try {
          if (Number(request.headers.get('content-length')) > 8192) throw Error('URL request is too large.');
          const body = await request.text();
          if (body.length > 8192) throw Error('URL request is too large.');
          const {url} = JSON.parse(body);
          return Response.json(await fetchSourceHTML(url, {fetchImpl, signal:request.signal, validateHost:validateSourceHost}), {headers:{'Cache-Control':'no-store'}});
        } catch (error) { return Response.json({error:error.message || 'Could not retrieve HTML source.'}, {status:400}); }
      }
      if (path.startsWith('/api/agent/chatgpt/')) return chatgpt.fetch(request);
      if (path.startsWith('/api/agent/gemini/')) return gemini.fetch(request);
      return Response.json({ error: 'Unknown agent endpoint.' }, { status: 404 });
    },
    async callback(request) {
      if (!localOAuth || new URL(request.url).pathname !== '/auth/callback')
        return new Response('Not found', { status: 404 });
      // The loopback listener passes only this route. State and PKCE authenticate it.
      const url = new URL(request.url);
      url.host = new URL(origins[0]).host;
      return chatgpt.fetch(new Request(url, request));
    },
  };
}
