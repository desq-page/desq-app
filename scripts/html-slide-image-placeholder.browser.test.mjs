import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { runBrowserFixture } from './browser-fixture.mjs';

const chrome = process.env.CHROME_BIN || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/chromium',
].find(existsSync);

test('HTML slide context menus edit revealed text and button labels and replace embedded images', { skip: !chrome }, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'desq-html-editor-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await build({
    entryPoints: [fileURLToPath(new URL('../../desq-core/shared-vuejs/src/vanjs/HtmlSlideFrame.ts', import.meta.url))],
    bundle: true, format: 'iife', globalName: 'fixture', outfile: join(directory, 'frame.js'),
  });
  const original = `<!doctype html><style>
    body { margin: 0; }
    button, #photo { height: 40px; }
    #photo { width: 200px; position: relative; }
    td { padding: 8px; }
  </style><button id="reveal">Reveal</button>
  <div id="photo" data-desq-image-placeholder="Wetland at sunrise"><span>Photo</span></div>
  <table id="panel" hidden><tbody><tr><td>Original table text</td></tr></tbody></table>
  <svg id="vector" width="70" height="40" viewBox="5 7 40 30"><rect x="5" y="7" width="40" height="30"/></svg>
  <script>
    const status = data => parent.postMessage(data, '*');
    const photo = document.querySelector('#photo');
    const panel = document.querySelector('#panel');
    const vector = document.querySelector('#vector');
    document.querySelector('#reveal').onclick = () => {
      panel.hidden = false;
      const range = document.createRange();
      range.selectNodeContents(panel.querySelector('td'));
      const { x, y, width, height } = range.getBoundingClientRect();
      const imageRect = photo.getBoundingClientRect();
      const vectorRect = vector.getBoundingClientRect();
      status({ buttonLabel: document.querySelector('#reveal').textContent, cell: [x + width / 2, y + height / 2],
        photo: [imageRect.x + imageRect.width / 2, imageRect.y + imageRect.height / 2],
        vector: [vectorRect.x + vectorRect.width / 2, vectorRect.y + vectorRect.height / 2] });
    };
    new MutationObserver(() => {
      if (photo.querySelector('img')) status({ image: true });
    }).observe(photo, { childList: true });
    new MutationObserver(() => {
      const menu = document.querySelector('[data-desq-editor-menu]');
      if (!menu) return;
      const { x, y, width, height } = menu.getBoundingClientRect();
      status({ menu: [x + width / 2, y + height / 2] });
    }).observe(document.body, { childList: true });
    document.addEventListener('pointerdown', event => status({ down: [event.target.id, event.target.tagName, event.clientX, event.clientY, !!document.querySelector('[data-desq-editor-menu]')] }), true);
    document.addEventListener('focusin', event => status({ focus: event.target.tagName }), true);
    for (const type of ['pointerdown', 'mouseup', 'click', 'dblclick']) {
      document.addEventListener(type, event => {
        if (event.target.closest('[contenteditable]')) status({ leakedEditEvent: type });
      }, true);
    }
    new MutationObserver(() => {
      if (vector.querySelector('image')) status({ vectorChanged: true });
    }).observe(vector, { childList: true });
    let pickerCount = 0;
    HTMLInputElement.prototype.click = function () {
      if (++pickerCount === 2) {
        const files = new DataTransfer();
        const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="red"/></svg>';
        files.items.add(new File([svg], 'replacement.svg', { type: 'image/svg+xml' }));
        this.files = files.files;
        this.dispatchEvent(new Event('change'));
        return;
      }
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      canvas.toBlob(blob => {
        const files = new DataTransfer();
        files.items.add(new File([blob], 'wetland.png', { type: 'image/png' }));
        this.files = files.files;
        this.dispatchEvent(new Event('change'));
      });
    };
    status({ ready: true });
    parent.postMessage({ type: 'desq:html-slide-edit', action: 'text', index: 0, value: 'FORGED' }, '*');
  </script>`;
  await writeFile(join(directory, 'fixture.html'), `<!doctype html><style>
    body { margin: 0; }
    iframe { width: 400px !important; height: 240px !important; }
  </style><script src="frame.js"></script><body><script>
    const messages = [], saves = [], errors = [];
    window.addEventListener('message', event => messages.push(event.data));
    const frame = fixture.htmlSlideFrame(${JSON.stringify(original).replace(/<\//g, '<\\/')},
      html => saves.push(html), error => errors.push(error));
    document.body.append(frame);
  </script>`);

  const result = await runBrowserFixture(chrome, pathToFileURL(join(directory, 'fixture.html')).href,
    join(directory, 'profile'), async send => {
      const evaluate = async expression => {
        const value = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
        if (value.exceptionDetails) throw new Error(value.exceptionDetails.exception?.description || value.exceptionDetails.text);
        return value.result.value;
      };
      const until = (expression) => evaluate(`new Promise((resolve, reject) => {
        const deadline = Date.now() + 3000;
        const check = () => {
          const value = (${expression});
          if (value) resolve(value);
          else if (Date.now() > deadline) reject(Error('Timed out waiting for the HTML slide'));
          else setTimeout(check, 20);
        };
        check();
      })`);
      // Allow Chrome to synchronize the sandboxed frame's hit-test surface.
      const settle = () => evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))');
      const click = async (x, y, button = 'left', clickCount = 1) => {
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button, clickCount });
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button, clickCount });
        await settle();
      };
      const key = async (key, code) => {
        await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key, windowsVirtualKeyCode: code });
        await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key, windowsVirtualKeyCode: code });
      };

      await until('messages.some(message => message.ready)');
      await settle();
      await click(30, 20);
      const { cell, photo, vector } = await until('messages.find(message => message.cell)');
      await click(...cell, 'right');
      const textMenu = await until('messages.find(message => message.menu)?.menu');
      await click(...textMenu);
      await send('Input.insertText', { text: 'Edited <cell> & text' });
      await key('Enter', 13);
      await until('saves.length === 1').catch(async error => {
        throw new Error(await evaluate('JSON.stringify(messages.map(({token,...msg})=>msg))'), { cause: error });
      });
      await click(...photo, 'right');
      const imageMenu = await until('messages.filter(message => message.menu)[1]?.menu');
      await click(...imageMenu);
      await until('saves.length === 2 && messages.some(message => message.image)').catch(async error => {
        const details = await evaluate('JSON.stringify({ actions: messages.map(message => message.action).filter(Boolean), errors, saves: saves.length })');
        throw new Error(details, { cause: error });
      });
      await click(...vector, 'right');
      const vectorMenu = await until('messages.filter(message => message.menu)[2]?.menu');
      await click(...vectorMenu);
      await until('saves.length === 3 && messages.some(message => message.vectorChanged)');
      await click(30, 20, 'right');
      const buttonMenu = await until('messages.filter(message => message.menu)[3]?.menu');
      await click(...buttonMenu);
      await click(30, 20);
      await click(30, 20, 'left', 2);
      await send('Input.insertText', { text: 'Show details' });
      await key('Enter', 13);
      await until('saves.length === 4');
      assert.equal(await evaluate('messages.filter(message => message.buttonLabel).length'), 1);
      assert.deepEqual(await evaluate('messages.filter(message => message.leakedEditEvent)'), []);
      await click(30, 20);
      await until('messages.some(message => message.buttonLabel === "Show details")');
      await evaluate(`(() => {
        const latest = saves.at(-1);
        const doc = new DOMParser().parseFromString(latest, 'text/html');
        const image = doc.querySelector('#photo > img');
        const vector = doc.querySelector('#vector');
        const replacement = vector.querySelector('image');
        if (!replacement?.getAttribute('href').startsWith('data:image/svg+xml;base64,') ||
            replacement.getAttribute('x') !== '5' || replacement.getAttribute('y') !== '7' ||
            vector.getAttribute('width') !== '70' || vector.getAttribute('viewBox') !== '5 7 40 30') {
          throw Error('SVG replacement did not preserve the original layout');
        }
        if (frame.contentDocument || frame.sandbox.value !== 'allow-scripts') throw Error('Frame escaped isolation');
        if (doc.querySelector('td').textContent !== 'Edited <cell> & text') throw Error('Cell text did not persist');
        if (!image?.src.startsWith('data:image/png;base64,') || image.alt !== 'Wetland at sunrise') throw Error('Image did not persist');
        if (errors.length || doc.querySelector('#reveal').textContent !== 'Show details' || !doc.querySelector('#panel').hidden ||
            !doc.querySelector('script') || doc.querySelector('[data-desq-editor-text], [data-desq-editor-visual], [data-desq-editor-menu], [tabindex]')) throw Error('Author markup changed');
        if (fixture.getHtmlSlideEditorSource(frame) !== latest) throw Error('Thumbnail source was not updated');
        document.body.insertAdjacentHTML('beforeend', '<pre id="result">PASS</pre>');
      })()`);
    });
  assert.match(result, /<pre id="result">PASS<\/pre>/);
});
