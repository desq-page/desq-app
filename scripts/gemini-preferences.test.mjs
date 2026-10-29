import test from 'node:test';
import assert from 'node:assert/strict';
import { readGeminiPreferences, saveGeminiPreferences, forgetGeminiPreferences } from '../editor-vuejs/src/lib/agent/gemini-preferences.mjs';

function storage() {
  const records = new Map();
  return { getItem: key => records.get(key) || null, setItem: (key, value) => records.set(key, value), removeItem: key => records.delete(key) };
}

test('saved Gemini key and model survive a fresh read and are removed by Forget', () => {
  const disk = storage();
  assert.deepEqual(readGeminiPreferences(disk), { apiKey: '', model: '' });
  saveGeminiPreferences('test-key', 'models/gemini-flash', disk);
  assert.deepEqual(readGeminiPreferences(disk), { apiKey: 'test-key', model: 'models/gemini-flash' });
  saveGeminiPreferences(readGeminiPreferences(disk).apiKey, 'models/gemini-pro', disk);
  assert.equal(readGeminiPreferences(disk).model, 'models/gemini-pro');
  forgetGeminiPreferences(disk);
  assert.deepEqual(readGeminiPreferences(disk), { apiKey: '', model: '' });
});

test('broken or unavailable browser storage does not prevent opening Agent Box', () => {
  assert.deepEqual(readGeminiPreferences({ getItem: () => '{broken' }), { apiKey: '', model: '' });
  const blocked = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); }, removeItem() { throw Error('blocked'); } };
  assert.deepEqual(readGeminiPreferences(blocked), { apiKey: '', model: '' });
  assert.throws(() => saveGeminiPreferences('key', 'models/gemini-flash', blocked), /could not save/);
  assert.throws(() => forgetGeminiPreferences(blocked), /could not be removed/);
});
