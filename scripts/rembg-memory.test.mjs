import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const fixtureModule = `
const f = () => globalThis.__rembgMemoryFixture;
export const getBlobForRmbg = async () => new Blob(['input']);
export const insertBlobImage = () => { f().inserted++; };
export const pipeline = async () => {
  const segmenter = async () => {
    if (f().fail) throw new Error('Inference failed');
    return [{ toBlob: async () => new Blob(['output']) }];
  };
  segmenter.dispose = async () => { f().disposed++; };
  return segmenter;
};`;
const built = await build({ entryPoints: ['shared-vuejs/src/edlib/rembg/xenova.ts'], bundle: true, format: 'esm', write: false,
  plugins: [{ name: 'mock-rembg', setup(build) {
    build.onResolve({ filter: /^(?:@huggingface\/transformers|#shared\/)/ }, args => ({ path: args.path, namespace: 'mock' }));
    build.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: fixtureModule, loader: 'js' }));
  } }],
});
const { xenovaRmbg } = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'));
test('background removal releases GPU resources on success and inference failure', async () => {
  for (const fail of [false, true]) {
    const fixture = globalThis.__rembgMemoryFixture = { fail, disposed: 0, inserted: 0 };
    if (fail) await assert.rejects(xenovaRmbg(), /Inference failed/);
    else await xenovaRmbg();
    assert.equal(fixture.disposed, 1);
    assert.equal(fixture.inserted, fail ? 0 : 1);
  }
  delete globalThis.__rembgMemoryFixture;
});
