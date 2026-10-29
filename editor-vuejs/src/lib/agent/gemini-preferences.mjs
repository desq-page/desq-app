const KEY = 'savanna.gemini.connection.v1';

export function readGeminiPreferences(storage) {
  try {
    storage ||= globalThis.localStorage;
    const value = JSON.parse(storage.getItem(KEY) || '{}');
    return {
      apiKey: typeof value.apiKey === 'string' && value.apiKey.length <= 512 && !/[\r\n]/.test(value.apiKey) ? value.apiKey : '',
      model: typeof value.model === 'string' && /^models\/gemini-[a-zA-Z0-9._-]+$/.test(value.model) ? value.model : '',
    };
  } catch { return { apiKey: '', model: '' }; }
}

export function saveGeminiPreferences(apiKey, model, storage) {
  try { (storage || globalThis.localStorage).setItem(KEY, JSON.stringify({ apiKey, model })); }
  catch { throw new Error('Gemini is ready, but this browser could not save the key. Allow site storage to remember it.'); }
}

export function forgetGeminiPreferences(storage) {
  try { (storage || globalThis.localStorage).removeItem(KEY); }
  catch { throw new Error('The saved Gemini key could not be removed. Clear this site’s browser storage to forget it.'); }
}
