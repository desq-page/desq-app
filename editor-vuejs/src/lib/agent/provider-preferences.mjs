const KEY = 'savanna.agent.provider.v1';
const PROVIDERS = new Set(['chatgpt', 'gemini', 'local']);

export function readAgentProvider(storage) {
  try {
    const value = (storage || globalThis.localStorage).getItem(KEY);
    return PROVIDERS.has(value) ? value : 'chatgpt';
  } catch { return 'chatgpt'; }
}

export function saveAgentProvider(provider, storage) {
  if (!PROVIDERS.has(provider)) return;
  try { (storage || globalThis.localStorage).setItem(KEY, provider); }
  catch { /* Provider choice remains available for this session. */ }
}
