import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runBrowserFixture } from '../../scripts/browser-fixture.mjs';
import { blankDocument, createShape, setText } from '../src/model.mjs';
import { presentationHTML } from '../src/document.mjs';

const chrome = process.env.CHROME_BIN || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/chromium', '/usr/bin/google-chrome'].find(existsSync);
test('single-page HTML renders document JSON without the editor or pre-rendered slides', { skip: !chrome, timeout: 60000 }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'van-presentation-'));
  try {
    const doc = blankDocument();
    const shape = createShape('text', doc.file); setText(shape, 'Presentation from JSON'); doc.slides[0].shapes.push(shape);
    const [runtime, playerStyles, font] = await Promise.all(['presentation.js', 'player.css', 'assets/fonts/Carlito.woff2']
      .map(name => readFile(new URL(`../dist/${name}`, import.meta.url))));
    const html = presentationHTML(doc, runtime.toString(), { playerStyles: playerStyles.toString(),
      playerAssets: [{ name: 'assets/fonts/Carlito.woff2', mime: 'font/woff2', data: font }] });
    const check = `<script>window.addEventListener('load',async()=>{for(let i=0;i<100;i++){if(document.querySelector('#viewport .slide')?.textContent.includes('Presentation from JSON')){document.body.insertAdjacentHTML('beforeend','<pre id="result">PASS</pre>');return}await new Promise(r=>setTimeout(r,50))}document.body.insertAdjacentHTML('beforeend','<pre id="result">FAIL</pre>')});</script>`;
    const path = join(dir, 'presentation.html');
    await writeFile(path, html.replace('</body>', check + '</body>'));
    const output = await runBrowserFixture(chrome, pathToFileURL(path).href, join(dir, 'profile'));
    assert.match(output, /<pre id="result">PASS<\/pre>/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
