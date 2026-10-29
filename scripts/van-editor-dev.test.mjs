import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vanEditorDevPlugin } from './van-editor-dev.mjs';

test('Vue development starts without building VanJS, then builds assets once on demand', async () => {
  const old = process.env.SHARED_VUEJS_DEV;
  process.env.SHARED_VUEJS_DEV = '1';
  try {
    let count = 0, finish, middleware;
    const build = () => { count++; return new Promise(resolve => { finish = resolve; }); };
    const plugin = vanEditorDevPlugin(build, async () => 'asset');
    plugin.configureServer({ middlewares: { use(fn) { middleware = fn; } }, config: { logger: { error() {} } } });
    const invoke = url => new Promise(resolve => middleware({ url }, { setHeader() {}, end: text => resolve(text) }, () => resolve('next')));
    assert.equal(await invoke('/src/main.ts'), 'next');
    assert.equal(count, 0);
    const first = invoke('/editor-vanjs.js?v=1');
    const second = invoke('/editor-vanjs-renderer.js');
    await Promise.resolve();
    assert.equal(count, 1);
    finish();
    assert.deepEqual(await Promise.all([first, second]), ['asset', 'asset']);
    assert.equal(await invoke('/editor-vanjs-player.css'), 'asset');
    assert.equal(count, 1);
  } finally {
    if (old === undefined) delete process.env.SHARED_VUEJS_DEV;
    else process.env.SHARED_VUEJS_DEV = old;
  }
});

test('a failed VanJS build returns an error and can be retried', async () => {
  const old = process.env.SHARED_VUEJS_DEV;
  process.env.SHARED_VUEJS_DEV = '1';
  try {
    let count = 0, middleware;
    const plugin = vanEditorDevPlugin(async () => { if (++count === 1) throw Error('build failed'); }, async () => 'asset');
    plugin.configureServer({ middlewares: { use(fn) { middleware = fn; } }, config: { logger: { error() {} } } });
    const invoke = () => new Promise(resolve => {
      const response = { setHeader() {}, end: text => resolve(response.statusCode ? [response.statusCode, text] : text) };
      middleware({ url: '/editor-vanjs.js' }, response, () => resolve('next'));
    });
    assert.equal((await invoke())[0], 500);
    assert.equal(await invoke(), 'asset');
    assert.equal(count, 2);
  } finally {
    if (old === undefined) delete process.env.SHARED_VUEJS_DEV;
    else process.env.SHARED_VUEJS_DEV = old;
  }
});
