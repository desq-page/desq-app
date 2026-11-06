import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const fixtureModule = `
const f = () => globalThis.__rembgMemoryFixture;
export const getBlobForRmbg = async () => new Blob(['input']);
export const insertBlobImage = () => { f().inserted++; };
export const showProgress = (message) => { f().progress = message; };
export const showError = (message) => { f().error = message; };
export const removeBackground = async (_input, { onProgress }) => {
  onProgress({ message: 'Processing' });
  if (f().fail) throw new Error('Inference failed');
  return { blob: new Blob(['output']) };
};`;
const built = await build({ entryPoints: [new URL('../../desq-core/shared-vuejs/src/edlib/rembg/xenova.ts', import.meta.url).pathname], bundle: true, format: 'esm', write: false,
  plugins: [{ name: 'mock-rembg', setup(build) {
    build.onResolve({ filter: /^(?:@bg0\/browser|#shared\/|\.\.\/main\/utils$)/ }, args => ({ path: args.path, namespace: 'mock' }));
    build.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: fixtureModule, loader: 'js' }));
  } }],
});
const { xenovaRmbg } = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'));
test('background removal inserts successful results and clears progress even on failure', async () => {
  for (const fail of [false, true]) {
    const fixture = globalThis.__rembgMemoryFixture = { fail, inserted: 0 };
    await xenovaRmbg();
    assert.equal(fixture.progress, '');
    assert.equal(fixture.error, fail ? 'Inference failed' : undefined);
    assert.equal(fixture.inserted, fail ? 0 : 1);
  }
  delete globalThis.__rembgMemoryFixture;
});
