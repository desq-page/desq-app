import test from 'node:test';
import assert from 'node:assert/strict';
import { readAgentProvider, saveAgentProvider } from '../editor-vuejs/src/lib/agent/provider-preferences.mjs';

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('agent provider preference survives a fresh read', () => {
  const disk = storage();
  assert.equal(readAgentProvider(disk), 'chatgpt');
  saveAgentProvider('gemini', disk);
  assert.equal(readAgentProvider(disk), 'gemini');
  saveAgentProvider('local', disk);
  assert.equal(readAgentProvider(disk), 'local');
});

test('invalid or unavailable provider preference falls back to ChatGPT', () => {
  assert.equal(readAgentProvider(storage({ 'desq.agent.provider.v1': 'other' })), 'chatgpt');
  assert.equal(readAgentProvider({ getItem() { throw Error('blocked'); } }), 'chatgpt');
  saveAgentProvider('invalid', storage());
});
