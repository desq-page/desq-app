import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runBrowserFixture } from '../../scripts/browser-fixture.mjs';
const chrome = process.env.CHROME_BIN || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/chromium', '/usr/bin/google-chrome'].find(existsSync);

test('save HTML creates an editable, self-contained file that can save again', { skip: !chrome, timeout: 60000 }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'van-html-save-'));
  try {
    await cp(new URL('../dist/', import.meta.url), dir, { recursive: true });
    const source = await readFile(join(dir, 'index.html'), 'utf8');
    const script = `<script>window.addEventListener('DOMContentLoaded',async()=>{try{await DesqVanEditor.ready();let api;for(let i=0;i<100&&!api;i++){api=DesqVanEditor.getEditor(document.querySelector('[data-desq-editor]'));if(!api)await new Promise(r=>setTimeout(r,20))}await api.ready;let blob;const old=URL.createObjectURL;URL.createObjectURL=x=>(blob=x,old(x));HTMLAnchorElement.prototype.click=()=>{};await api.saveHTML();if(!blob||blob.type!=='text/html;charset=utf-8')throw Error('HTML download missing: '+blob?.type);const bytes=new Uint8Array(await blob.arrayBuffer());let text='';for(let i=0;i<bytes.length;i+=32768)text+=String.fromCharCode(...bytes.subarray(i,i+32768));const el=document.createElement('pre');el.id='result';el.textContent='PASS:'+btoa(text);document.body.append(el)}catch(e){const el=document.createElement('pre');el.id='result';el.textContent='FAIL:'+e.stack;document.body.append(el)}});</script>`;
    await writeFile(join(dir, 'save.html'), source.replace('</body>', script + '</body>'));
    const result = await runBrowserFixture(chrome, pathToFileURL(join(dir, 'save.html')).href, join(dir, 'profile'));
    const output = result.match(/<pre id="result">([^<]+)<\/pre>/)?.[1];
    assert.ok(output?.startsWith('PASS:'), output || result.slice(-1000));
    const html = Buffer.from(output.slice(5), 'base64').toString();
    const check = `<script>window.addEventListener('DOMContentLoaded',async()=>{try{let api;for(let i=0;i<100&&!api;i++){api=DesqVanEditor.getEditor(document.querySelector('[data-desq-editor]'));if(!api)await new Promise(r=>setTimeout(r,20))}await api.ready;let blob;const old=URL.createObjectURL;URL.createObjectURL=x=>(blob=x,old(x));HTMLAnchorElement.prototype.click=()=>{};await api.saveHTML();if(!blob)throw Error('second save failed');document.body.insertAdjacentHTML('beforeend','<pre id="result">PASS</pre>')}catch(e){const p=document.createElement('pre');p.id='result';p.textContent='FAIL:'+e.stack;document.body.append(p)}});</script>`;
    const close = html.lastIndexOf('</body>');
    await writeFile(join(dir, 'standalone.html'), html.slice(0, close) + check + html.slice(close));
    const reopened = await runBrowserFixture(chrome, pathToFileURL(join(dir, 'standalone.html')).href, join(dir, 'reopened'));
    assert.match(reopened, /<pre id="result">PASS<\/pre>/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
