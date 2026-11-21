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
    router: { isReady: () => routeReady }, vue3GoogleLogin: {}, serviceWorkerReady: Promise.resolve() };
  vm.createContext(c);
  vm.runInContext(main.replace(/^import\s+[\s\S]*?;\r?\n/gm, '').replace('export const appReady', 'globalThis.appReady'), c);
  assert.equal(mounted, false);
  ready();
  await c.appReady;
  assert.equal(mounted, true);
});

const page = fs.readFileSync(new URL('../editor-vuejs/src/pages/DashboardPage.vue', import.meta.url), 'utf8');
const script = page.split('<script setup lang="ts">')[1].split('</script>')[0];
const ast = ts.createSourceFile('DashboardPage.ts', script, ts.ScriptTarget.Latest, true);
const dashboardFunction = name => ts.transpile(ast.statements
  .find(node => ts.isFunctionDeclaration(node) && node.name?.text === name).getText(ast));

test('initial database work waits until the dashboard has a frame to paint', async () => {
  const frames = [];
  let loading = false;
  const c = vm.createContext({
    requestAnimationFrame: callback => frames.push(callback),
    loadFiles: async () => { loading = true; },
    nextTick: async () => {},
    emit: () => {},
  });
  vm.runInContext(dashboardFunction('loadInitialFiles'), c);
  const started = c.loadInitialFiles();
  assert.equal(loading, false);
  frames.shift()();
  await Promise.resolve();
  assert.equal(loading, false);
  frames.shift()();
  await started;
  assert.equal(loading, true);
});

test('documents spinner remains while the file-list component loads', async () => {
  let finish;
  const componentReady = new Promise(resolve => { finish = resolve; });
  const c = { loadingFiles: { value: false }, localFiles: { value: ['file'] },
    DashboardFiles: { value: undefined }, loadLocalFiles: async () => {}, loadDashboardFiles: () => componentReady };
  vm.createContext(c);
  vm.runInContext(dashboardFunction('loadFiles'), c);
  const loading = c.loadFiles();
  await Promise.resolve();
  assert.equal(c.loadingFiles.value, true);
  const component = {};
  finish({ default: component });
  await loading;
  assert.equal(c.DashboardFiles.value, component);
  assert.equal(c.loadingFiles.value, false);
});
