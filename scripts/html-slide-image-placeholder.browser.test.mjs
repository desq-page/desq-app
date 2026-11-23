import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {transform} from 'esbuild';
import {runBrowserFixture} from './browser-fixture.mjs';

const chrome = process.env.CHROME_BIN || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/chromium',
].find(existsSync);

test('HTML slide image slots save embedded replacements without changing other slide content', {skip: !chrome}, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'desq-html-image-'));
  t.after(() => rm(directory, {recursive: true, force: true}));
  const source = await readFile(new URL('../../desq-core/shared-vuejs/src/vanjs/HtmlSlideFrame.ts', import.meta.url), 'utf8');
  const {code} = await transform(source, {loader: 'ts'});
  await writeFile(join(directory, 'fixture.html'), `<!doctype html><body><script type="module">
${code}
try {
  const original = '<h1>Wetlands</h1><div id="photo" data-desq-image-placeholder="Wetland at sunrise"><span>Photo</span></div><div id="map" data-desq-image-placeholder="Map">Map here</div><script>throw Error("author script ran")<\\x2fscript>';
  const errors = [];
  let saved;
  const frame = htmlSlideFrame(original, html => { saved = html; }, message => errors.push(message));
  const loaded = new Promise(resolve => frame.addEventListener('load', resolve, {once: true}));
  document.body.append(frame);
  await loaded;

  const nativeClick = HTMLInputElement.prototype.click;
  HTMLInputElement.prototype.click = function () {
    if (this.type !== 'file') return nativeClick.call(this);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    canvas.toBlob(blob => {
      const files = new DataTransfer();
      files.items.add(new File([blob], 'wetland.png', {type:'image/png'}));
      this.files = files.files;
      this.dispatchEvent(new Event('change'));
    });
  };

  const slot = frame.contentDocument.getElementById('photo');
  slot.click();
  if (frame.contentDocument.activeElement !== slot) throw Error('Placeholder did not receive focus');
  slot.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true}));
  const deadline = Date.now() + 3000;
  while (!saved && !errors.length && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
  if (!saved) throw Error(errors[0] || 'Image change did not save');
  const doc = new DOMParser().parseFromString(saved, 'text/html');
  const img = doc.querySelector('#photo > img');
  if (!img?.src.startsWith('data:image/png;base64,') || img.alt !== 'Wetland at sunrise') throw Error('Replacement image was not embedded');
  if (!slot.querySelector('img') || !doc.querySelector('#photo[data-desq-image-placeholder]')) throw Error('Replacement cannot be edited again');
  if (doc.querySelector('#map').textContent !== 'Map here' || doc.querySelector('h1').textContent !== 'Wetlands') throw Error('Other content changed');
  if (doc.querySelector('#photo').hasAttribute('tabindex') || !doc.querySelector('script')) throw Error('Editor-only markup was saved or author markup was lost');
  document.body.insertAdjacentHTML('beforeend', '<pre id="result">PASS</pre>');
} catch (error) {
  const result = document.createElement('pre');
  result.id = 'result';
  result.textContent = error.stack;
  document.body.append(result);
}
</script>`);
  const result = await runBrowserFixture(chrome, pathToFileURL(join(directory, 'fixture.html')).href, join(directory, 'profile'));
  assert.match(result, /<pre id="result">PASS<\/pre>/, result.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1]);
});
