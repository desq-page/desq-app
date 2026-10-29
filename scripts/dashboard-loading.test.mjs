import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const main = fs.readFileSync(new URL('../editor-vuejs/src/main.js', import.meta.url), 'utf8');
test('startup keeps the bootstrap DOM until the initial asynchronous route is ready', async () => {
  let ready, mounted = false;
  const routeReady = new Promise(resolve => { ready = resolve; });
  const app = { use() {}, mount(target) { assert.equal(target, 'body'); mounted = true; } };
  const c = { createApp: () => app, createPinia: () => ({}), App: {},
    router: { isReady: () => routeReady }, vue3GoogleLogin: {}, setupDB() {} };
  vm.createContext(c);
  vm.runInContext(main.replace(/^import\s+[\s\S]*?;\r?\n/gm, '').replace('export const appReady', 'globalThis.appReady'), c);
  assert.equal(mounted, false);
  ready();
  await c.appReady;
  assert.equal(mounted, true);
});

test('documents spinner remains while the file-list component loads', async () => {
  const page = fs.readFileSync(new URL('../editor-vuejs/src/pages/DashboardPage.vue', import.meta.url), 'utf8');
  const script = page.split('<script setup lang="ts">')[1].split('</script>')[0];
  const ast = ts.createSourceFile('DashboardPage.ts', script, ts.ScriptTarget.Latest, true);
  const loadFiles = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'loadFiles');
  let finish;
  const componentReady = new Promise(resolve => { finish = resolve; });
  const c = { loadingFiles: { value: false }, localFiles: { value: ['file'] },
    loadLocalFiles: async () => {}, loadDashboardFiles: () => componentReady };
  vm.createContext(c);
  vm.runInContext(ts.transpile(loadFiles.getText(ast)), c);
  const loading = c.loadFiles();
  await Promise.resolve();
  assert.equal(c.loadingFiles.value, true);
  finish();
  await loading;
  assert.equal(c.loadingFiles.value, false);
});
