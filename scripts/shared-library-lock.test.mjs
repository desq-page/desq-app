import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { refreshSharedLibraryLock } from './shared-library-lock.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('committed shared library tarball matches the lockfile integrity', () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  const entry = lock.packages['node_modules/shared-vuejs'];
  const archive = fs.readFileSync(path.join(root, entry.resolved.replace(/^file:/, '')));
  assert.equal(entry.integrity, `sha512-${createHash('sha512').update(archive).digest('base64')}`);
});

test('npm installs refreshed contents from a tarball repacked at the same version', { timeout: 60000 }, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shared-lock-test-'));
  const npmCli = process.env.npm_execpath || path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
  const npm = (...args) => execFileSync(process.execPath, [npmCli, ...args, '--offline', '--no-audit', '--no-fund', '--cache', path.join(root, 'cache')], {
    cwd: root, encoding: 'utf8', timeout: 20000, stdio: 'pipe',
  });
  const writeJson = (file, value) => fs.writeFileSync(path.join(root, file), JSON.stringify(value));
  try {
    for (const dir of ['shared-vuejs', 'editor-vuejs', 'packages']) fs.mkdirSync(path.join(root, dir));
    writeJson('package.json', { name: 'fixture', private: true, workspaces: ['editor-vuejs'] });
    writeJson('editor-vuejs/package.json', { name: 'editor-vuejs', version: '1.0.0', dependencies: { 'shared-vuejs': 'file:../packages/shared-vuejs-0.1.0.tgz' } });
    const manifest = { name: 'shared-vuejs', version: '0.1.0', main: 'index.js' };
    writeJson('shared-vuejs/package.json', manifest);
    const source = path.join(root, 'shared-vuejs/index.js');
    fs.writeFileSync(source, 'module.exports = "before";');
    npm('pack', './shared-vuejs', '--pack-destination', './packages', '--ignore-scripts');
    npm('install');
    fs.writeFileSync(source, 'module.exports = "after";');
    npm('pack', './shared-vuejs', '--pack-destination', './packages', '--ignore-scripts');
    const lockPath = path.join(root, 'package-lock.json');
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    refreshSharedLibraryLock(lock, manifest, fs.readFileSync(path.join(root, 'packages/shared-vuejs-0.1.0.tgz')));
    fs.writeFileSync(lockPath, JSON.stringify(lock));
    fs.rmSync(path.join(root, 'node_modules/shared-vuejs'), { recursive: true, force: true });
    npm('install');
    assert.equal(fs.readFileSync(path.join(root, 'node_modules/shared-vuejs/index.js'), 'utf8'), 'module.exports = "after";');
    assert.ok(JSON.parse(fs.readFileSync(lockPath, 'utf8')).packages['node_modules/shared-vuejs']);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('refreshes a repacked tarball without dropping the dependency or unrelated entries', () => {
  const unrelated = { version: '2.0.0' };
  const lock = { packages: {
    'editor-vuejs': { dependencies: { 'shared-vuejs': 'file:old.tgz', vue: '^3' } },
    'node_modules/shared-vuejs': { integrity: 'old', dependencies: { obsolete: '1' } },
    'node_modules/other': unrelated,
  } };
  const manifest = { version: '0.1.0', license: 'ISC', dependencies: { current: '2' }, peerDependencies: { vue: '^3' } };
  const tarball = Buffer.from('new package contents');
  refreshSharedLibraryLock(lock, manifest, tarball);
  const entry = lock.packages['node_modules/shared-vuejs'];
  assert.equal(entry.resolved, 'file:packages/shared-vuejs-0.1.0.tgz');
  assert.equal(entry.integrity, `sha512-${createHash('sha512').update(tarball).digest('base64')}`);
  assert.deepEqual(entry.dependencies, manifest.dependencies);
  assert.deepEqual(entry.peerDependencies, manifest.peerDependencies);
  assert.equal(lock.packages['editor-vuejs'].dependencies['shared-vuejs'], 'file:../packages/shared-vuejs-0.1.0.tgz');
  assert.equal(lock.packages['editor-vuejs'].dependencies.vue, '^3');
  assert.equal(lock.packages['node_modules/other'], unrelated);
});

test('recovers a lock left without a shared package entry by the old installer', () => {
  const lock = { packages: { 'editor-vuejs': { dependencies: {} } } };
  refreshSharedLibraryLock(lock, { version: '0.2.0' }, Buffer.from('package'));
  assert.equal(lock.packages['node_modules/shared-vuejs'].version, '0.2.0');
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(lock)));
});
