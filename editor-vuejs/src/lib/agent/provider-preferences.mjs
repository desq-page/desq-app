const KEY = 'desq.agent.provider.v1';
const PROVIDERS = new Set(['chatgpt', 'gemini', 'local']);

export function readAgentProvider(storage) {
  try {
    const store = storage || globalThis.localStorage;
    const value = store.getItem(KEY);
    return PROVIDERS.has(value) ? value : 'chatgpt';
  } catch { return 'chatgpt'; }
}

export function saveAgentProvider(provider, storage) {
  if (!PROVIDERS.has(provider)) return;
  try { (storage || globalThis.localStorage).setItem(KEY, provider); }
  catch { /* Provider choice remains available for this session. */ }
}
