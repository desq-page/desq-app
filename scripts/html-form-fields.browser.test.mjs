import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {existsSync, mkdtempSync, readFileSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {runBrowserFixture} from './browser-fixture.mjs';

const chrome = process.env.CHROME_BIN || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/chromium',
].find(existsSync);

test('exported HTML fields are interactive and their values reach local scripts', {skip: !chrome, timeout: 60000}, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'desq-form-fields-'));
  try {
    const assets = '../desq-core/shared-vuejs/dist/edlib/common/export/single-html-assets';
    const runtime = readFileSync(join(assets, 'presentation.txt'), 'utf8');
    const styles = readFileSync(join(assets, 'player.css'), 'utf8');
    const source = `<style>.slide{width:1280px;height:720px}</style>
      <section class="slide"><h1>Answer</h1><form>
        <label for="numerator">Numerator</label><input id="numerator" type="number" placeholder="?" min="0">
        <select id="comparison"><option value="">&ndash;</option><option value="&lt;">Less than</option></select>
        <textarea id="notes">Initial notes</textarea>
        <button type="button" onclick="gotoSlide(document.getElementById('numerator').value === '9' &amp;&amp; document.getElementById('comparison').value === '&lt;' ? 'correct' : 'wrong')">Check</button>
      </form></section><section class="slide" id="correct"><h1>Correct</h1></section>
      <section class="slide" id="wrong"><h1>Try again</h1></section>`;
    await build({stdin: {resolveDir: resolve('.'), contents: `
      import {agentHtmlDocument} from './editor-vuejs/src/lib/main/importAgentHtml.mjs';
      import {presentationHTML} from '../desq-core/shared-vuejs/src/edlib/common/export/presentation-document.mjs';
      (async () => {
        const result = document.createElement('pre');
        result.id = 'result';
        try {
          const doc = await agentHtmlDocument(${JSON.stringify(source)}, 'Fields.html');
          const iframe = document.createElement('iframe');
          iframe.style.cssText = 'width:1280px;height:720px';
          iframe.srcdoc = presentationHTML(doc, ${JSON.stringify(runtime)}, {playerStyles:${JSON.stringify(styles)},playerAssets:[]});
          document.body.append(iframe);
          const current = () => iframe.contentDocument?.querySelector('.slide.current');
          const until = async predicate => {
            const start = Date.now();
            while (!predicate()) {
              if (Date.now() - start > 8000) throw Error('Player did not reach the expected state');
              await new Promise(resolve => setTimeout(resolve, 30));
            }
          };
          let scriptError;
          await until(() => current()?.querySelectorAll('.desq-form-control').length === 3);
          iframe.contentWindow.addEventListener('desq-script-error', event => scriptError = event.detail.message);
          const [number, comparison, notes] = current().querySelectorAll('.desq-form-control');
          if (number.getAttribute('aria-label') !== 'Numerator' || number.min !== '0' || number.placeholder !== '?' || notes.value !== 'Initial notes') throw Error('Field defaults changed');
          number.value = '9';
          comparison.value = '<';
          current().querySelector('[data-link^="@run:"]').click();
          await until(() => scriptError || current()?.textContent.includes('Correct'));
          if (scriptError) throw Error(scriptError);
          result.textContent = 'PASS';
        } catch (error) { result.textContent = error.stack; }
        document.body.append(result);
      })();
    `}, bundle: true, format: 'iife', outfile: join(directory, 'fixture.js')});
    const fixture = join(directory, 'fixture.html');
    writeFileSync(fixture, '<!doctype html><body><script src="fixture.js"></script>');
    const output = await runBrowserFixture(chrome, pathToFileURL(fixture).href, join(directory, 'profile'));
    assert.equal(output.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1], 'PASS');
  } finally {
    rmSync(directory, {recursive: true, force: true});
  }
});
