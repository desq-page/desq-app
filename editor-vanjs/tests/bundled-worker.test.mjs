import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('standalone editor excludes the video optimizer and its worker', async () => {
  const metadata = JSON.parse(await readFile(new URL('../dist/stats/editor.meta.json', import.meta.url), 'utf8'));
  const inputs = Object.keys(metadata.inputs);
  assert.ok(!inputs.some(name => /video-optimization|optimize-video\.worker|mediabunny/.test(name)));
});
