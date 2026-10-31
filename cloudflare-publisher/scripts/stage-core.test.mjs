import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stageCore } from './stage-core.mjs';

test('stages the freshly built core into both independent consumers', async t => {
  const root = await mkdtemp(join(tmpdir(), 'desq-stage-core-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const core = join(root, 'core');
  for (const [directory, name] of [['shared-vuejs', 'shared-vuejs'], ['player', '@desq/player']]) {
    const dir = join(core, directory);
    await mkdir(join(dir, 'dist'), { recursive: true });
    await writeFile(join(dir, 'package.json'), JSON.stringify({ name, version: '1.0.0', exports: { './package.json': './package.json' } }));
    await writeFile(join(dir, 'dist', 'bundle.js'), `fresh ${name}`);
  }
  const consumers = [join(root, 'app'), join(root, 'addin')];
  for (const consumer of consumers) {
    await mkdir(consumer, { recursive: true });
    await writeFile(join(consumer, 'package.json'), '{}');
    for (const name of ['shared-vuejs', '@desq/player']) {
      const dir = join(consumer, 'node_modules', name);
      await mkdir(join(dir, 'dist'), { recursive: true });
      await writeFile(join(dir, 'package.json'), JSON.stringify({ name, version: '0.0.1', exports: { './package.json': './package.json' } }));
      await writeFile(join(dir, 'dist', 'bundle.js'), 'old');
      await writeFile(join(dir, 'dist', 'stale.js'), 'old');
    }
  }
  await stageCore(core, consumers);
  for (const consumer of consumers) for (const name of ['shared-vuejs', '@desq/player']) {
    const dir = join(consumer, 'node_modules', name);
    assert.equal(await readFile(join(dir, 'dist', 'bundle.js'), 'utf8'), `fresh ${name}`);
    assert.equal(JSON.parse(await readFile(join(dir, 'package.json'))).version, '1.0.0');
    await assert.rejects(readFile(join(dir, 'dist', 'stale.js')), { code: 'ENOENT' });
  }
});
