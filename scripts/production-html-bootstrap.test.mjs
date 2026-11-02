import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

test('minified production exporter produces standalone player bootstrap scripts', async () => {
  const bundle = await build({
    entryPoints: [createRequire(import.meta.url).resolve('shared-vuejs/api/presentation-document')],
    bundle: true, minify: true, format: 'iife', globalName: 'exporter', write: false,
  });
  const context = { btoa: value => Buffer.from(value, 'binary').toString('base64') };
  vm.runInNewContext(bundle.outputFiles[0].text, context);
  const resources = {
    player: 'window.player=true;',
    playerStyles: '@font-face{src:url(/fonts/test.woff2)}',
    playerAssets: [{ name: 'assets/fonts/test.woff2', mime: 'font/woff2', data: new Uint8Array([1, 2, 3]) }],
  };
  for (const method of ['presentationHTML', 'editableHTML']) {
    const html = context.exporter[method]({ file: { name: 'Deck' }, assets: {} }, 'window.runtime=true;', resources);
    const script = html.match(/<script>(window\.DesqEmbeddedPlayer=[\s\S]*?)<\/script>/)?.[1];
    assert.ok(script, `${method} contains its bootstrap`);
    const style = {};
    vm.runInNewContext(script, { window: {}, document: { querySelector: () => style } });
    assert.equal(style.textContent, '@font-face{src:url(data:font/woff2;base64,AQID)}');
  }
});
