import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../cloudflare-publisher/src/worker.js';
import { isPublishedPath, reservedUsernames } from 'shared-vuejs/api/lib-published-path';

test('PowerPoint add-in paths are reserved and served as application assets', async () => {
  const seen = [];
  const env = { PUBLIC_ORIGIN: 'https://desq.page', API_ORIGIN: 'https://publish-api.desq.page',
    ASSETS: { fetch: async request => { seen.push(new URL(request.url).pathname); return new Response('addin asset'); } } };
  assert.equal(reservedUsernames.has('powerpoint-addin'), true);
  assert.equal(isPublishedPath('/powerpoint-addin/assets/app.js'), false);
  const redirect = await worker.fetch(new Request('https://desq.page/powerpoint-addin'), env, {});
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.get('location'), 'https://desq.page/powerpoint-addin/');
  for (const path of ['/powerpoint-addin/', '/powerpoint-addin/assets/app.js', '/powerpoint-addin/defaults/tableStyles.xml']) {
    const response = await worker.fetch(new Request('https://desq.page' + path), env, {});
    assert.equal(await response.text(), 'addin asset');
  }
  assert.deepEqual(seen, ['/powerpoint-addin/', '/powerpoint-addin/assets/app.js', '/powerpoint-addin/defaults/tableStyles.xml']);
  assert.equal((await worker.fetch(new Request('https://desq.page/powerpoint-addin/', { method: 'POST' }), env, {})).status, 405);
});
