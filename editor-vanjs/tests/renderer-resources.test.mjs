import test from 'node:test';
import assert from 'node:assert/strict';
import { setRendererURLs, playerResources } from '../src/renderer-loader.mjs';
import { editableZip } from '../src/package.mjs';
import { readZip } from '../src/zip.mjs';
import { blankDocument } from '../src/model.mjs';

test('ZIP save collects player fonts from hosted and extracted editor locations', async t => {
  const requests = [];
  t.mock.method(globalThis, 'fetch', async url => {
    requests.push(String(url));
    return new Response(String(url).endsWith('.js') ? 'window.SavannaPlayer={};'
      : String(url).endsWith('.css') ? '@font-face{src:url(/fonts/Carlito.woff2)}'
      : new Uint8Array([1, 2, 3]));
  });
  for (const [runtime, fonts] of [
    ['https://example.test/editor-vanjs.js', 'https://example.test/fonts/'],
    ['https://example.test/extracted/editor.js', 'https://example.test/extracted/assets/fonts/'],
  ]) {
    requests.length = 0;
    setRendererURLs(runtime);
    const resources = await playerResources();
    const archive = await editableZip(blankDocument(), 'window.SavannaVanEditor={};', '.ve-editor{}', {
      ...resources, renderer: 'window.SavannaRenderer={};', rendererStyles: '.slide{}',
    });
    const entries = await readZip(archive);
    for (const name of ['Carlito.woff2']) {
      assert.ok(requests.includes(fonts + name));
      assert.deepEqual([...entries.get('assets/fonts/' + name)], [1, 2, 3]);
    }
    assert.equal(requests.filter(url => url.startsWith(fonts)).length, 1);
  }
});
