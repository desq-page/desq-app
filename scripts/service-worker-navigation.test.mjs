import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../editor-vuejs/service-worker.js', import.meta.url), 'utf8')
  .replace(/^import[^\n]*\n/gm, '');
const origin = 'https://localhost:6173';
function loadWorker(readFile = async () => new Blob(['cached content'])) {
  let handleFetch;
  const worker = {location:{origin},addEventListener(type,handler) { if(type === 'fetch') handleFetch = handler; }};
  new Function('self','setupDB','db','optimizedVideo','getFileFromOPFS','fetch',source)(
    worker, () => {}, {get: async () => undefined}, async () => undefined, readFile,
    async () => { throw new Error('The worker must not fetch or synthesize a network fallback'); },
  );
  return handleFetch;
}

for (const path of ['/', '/?home=1', '/work', '/dashboard', '/edit/deck', '/index.html', '/src/main.js', '/images/loading.svg', '/api/agent/chatgpt/status', '/alice/presentation/', '/alice/res/page']) {
  test(`server unavailable: ${path} bypasses the worker without a binary fallback`, () => {
    const handleFetch = loadWorker();
    handleFetch({request:new Request(origin+path),respondWith() {assert.fail('Network requests must keep their native failure instead of becoming downloads');}});
  });
}

test('cross-origin URLs cannot read the local /res/ cache', () => {
  loadWorker()({request:new Request('https://other.example/res/deck/media/image.png'),respondWith() {assert.fail('Remote URLs must bypass the worker');}});
});

test('local cached editor resources still work without the server', async () => {
  const paths = [];
  const handleFetch = loadWorker(async path => {paths.push(path);return new Blob(['cached page']);});
  let response;
  handleFetch({request:new Request(origin+'/res/deck/index.html?version=1'),respondWith(value) {response=value;}});
  const result = await response;
  assert.equal(result.status,200);
  assert.match(result.headers.get('Content-Type'),/^text\/html/);
  assert.equal(await result.text(),'cached page');
  assert.deepEqual(paths,['pptx/deck/_internal/index.html']);
});

test('missing cached editor HTML returns 404 rather than a downloadable error', async () => {
  let response;
  loadWorker(async () => {throw new Error('Not found');})({request:new Request(origin+'/res/deck/index.html'),respondWith(value) {response=value;}});
  const result=await response;
  assert.equal(result.status,404);
  assert.match(result.headers.get('Content-Type'),/^text\/plain/);
});
