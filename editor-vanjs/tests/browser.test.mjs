import { build } from 'esbuild';
import { runBrowserFixture } from '../../scripts/browser-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import { readZip } from '../src/zip.mjs';
const chrome = process.env.CHROME_BIN || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/chromium', '/usr/bin/google-chrome'].find(existsSync);

test('offline built editor inserts, edits, moves, undoes, reorders effects and saves/reopens an extracted editable ZIP', { skip: !chrome, timeout: 60000 }, async () => {
  const temp = await mkdtemp(join(tmpdir(), 'savanna-vanjs-'));
  try {
    const source = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
    const helper = await build({ entryPoints: [new URL('./zip-browser-helper.mjs', import.meta.url).pathname], bundle: true, format: 'iife', write: false });
    const fixture = String.raw`
<script>
window.addEventListener('DOMContentLoaded', async () => {
  const check = (ok, message) => { if (!ok) throw Error(message); };
  const tick = () => new Promise(resolve => setTimeout(resolve, 35));
  const click = label => { const button = [...document.querySelectorAll('.ve-editor button')].find(e => e.getAttribute('aria-label') === label); check(button, 'Missing button: ' + label); button.click(); };
  const field = (label, value, event = 'change') => {
    const wrapper = [...document.querySelectorAll('.ve-inspector label')].find(e => e.querySelector('span')?.textContent === label);
    check(wrapper, 'Missing field: ' + label); const input = wrapper.querySelector('input,select'); input.value = value; input.dispatchEvent(new Event(event, { bubbles: true }));
  };
  try {
    check(!!window.SavannaVanEditor, 'IIFE API available');
    check(!document.querySelector('[aria-label=Open]'), 'Open control is absent');
    await SavannaVanEditor.ready();
    const localFetch = window.fetch.bind(window);
    window.fetch = (url, ...args) => {
      check(new URL(url, document.baseURI).protocol === 'file:', 'No network request from standalone editor');
      return localFetch(url, ...args);
    };
    const host = document.querySelector('[data-savanna-editor]');
    const api = SavannaVanEditor.mount(host, { document: await SavannaVanEditor.getEditor(host).getDocument() });
    await api.ready; await tick();
    check(!window.SavannaPlayer, 'Player is not loaded at editor startup');
    check(host.querySelectorAll('.ve-editor').length === 1, 'Mount replaces prior instance');
    check(!host.querySelector('.ve-canvas #sld').textContent.includes('false'), 'Conditional JSX does not render boolean text');
    // Native XML conversion permits singleton paragraph and run objects.
    const originalDoc = (await api.getDocument()), singletonDoc = structuredClone(originalDoc);
    const singletonShape = singletonDoc.slides[0].shapes[0];
    const singletonPara = singletonShape.txBody.p[0], singletonRun = singletonPara.r[0];
    singletonRun.t = { text: 'Imported singleton' }; singletonPara.r = singletonRun; singletonShape.txBody.p = singletonPara;
    const layoutShape = structuredClone(singletonShape); layoutShape.id = 'layout-singleton'; layoutShape.txBody.p.r.t = 'Layout singleton';
    const groupShape = { id: 'group-singleton', name: 'Group', type: 'group', x: 0, y: 0, w: 200, h: 100,
      children: [{ ...structuredClone(singletonShape), id: 'nested-singleton' }] };
    singletonDoc.slides[0].shapes.push(groupShape);
    singletonDoc.slides[0].layoutid = 'test-layout';
    singletonDoc.layouts = [{ id: 'test-layout', parentid: 'test-master', shapes: [layoutShape] }];
    singletonDoc.masters = [{ id: 'test-master', shapes: [{ ...structuredClone(layoutShape), id: 'master-singleton' }] }];
    await api.load(singletonDoc); await tick();
    check(host.querySelector('.ve-canvas').textContent.includes('Imported singleton'), 'Singleton paragraph and run render');
    check(host.querySelector('.ve-canvas').textContent.includes('Layout singleton'), 'Layout/master singleton text renders');
    host.querySelector('.ve-layers li:last-child button').click(); await tick();
    click('Bold'); await tick(); field('Alignment', 'ctr'); await tick();
    check((await api.getDocument()).slides[0].shapes[0].txBody.p.r.rPr.$_b === 1, 'Singleton text formats');
    check((await api.getDocument()).slides[0].shapes[0].txBody.p.pPr.$_algn === 'ctr', 'Singleton text aligns');
    host.querySelector('.ve-canvas .shp.selected')?.dispatchEvent(new MouseEvent('dblclick', {bubbles:true})); await tick();
    const singletonText = host.querySelector('.ve-canvas .shp.selected .textbox');
    check(singletonText?.contentEditable === 'true' && singletonText.textContent.includes('Imported singleton'), 'Shared textbox is editable immediately');
    singletonText.blur();
    await api.load(originalDoc); await tick();
    click('Rectangle'); await tick();
    let doc = (await api.getDocument()); check(doc.slides[0].shapes.length === 2, 'Insert rectangle');
    let shape = doc.slides[0].shapes[1]; const shapeId = shape.id;
    field('X', '240'); await tick(); check((await api.getDocument()).slides[0].shapes[1].x === 240, 'Position field');
    field('Fill', '#ff0000'); await tick(); check((await api.getDocument()).slides[0].shapes[1].solidFill.uniClr.$_val === 'ff0000', 'Native color input');
    click('Undo'); await tick(); check((await api.getDocument()).slides[0].shapes[1].solidFill.uniClr.$_val === '4472c4', 'Undo fill');
    click('Redo'); await tick(); check((await api.getDocument()).slides[0].shapes[1].solidFill.uniClr.$_val === 'ff0000', 'Redo fill');
    // Exercise actual pointer handlers. Synthetic events cannot own native pointer capture.
    const canvas = document; Element.prototype.releasePointerCapture = () => {}; canvas.setPointerCapture = () => {}; canvas.hasPointerCapture = () => false;
    let el = document.getElementById(shapeId);
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, button: 0, clientX: 300, clientY: 200 })); await tick();
    canvas.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, clientX: 320, clientY: 210 }));
    canvas.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, clientX: 340, clientY: 225 }));
    canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, clientX: 340, clientY: 225 })); await tick();
    check((await api.getDocument()).slides[0].shapes[1].x > 240, 'Pointer move commits');
    click('Undo'); await tick(); check((await api.getDocument()).slides[0].shapes[1].x === 240, 'Drag is a single undo step');
    click('Add fade'); await tick(); click('Add fade'); await tick();
    check((await api.getDocument()).slides[0].timing.m.length === 2, 'Animation insertion');
    const data = (await api.getDocument()); data.assets['test-image'] = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j8ioAAAAASUVORK5CYII='; data.slides[0].timing.m[1].dl = 2; await api.load(data); await tick();
    const effects = host.querySelectorAll('.ve-effects li');
    const transfer = new DataTransfer();
    effects[1].dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: transfer }));
    const over = new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer }); effects[0].dispatchEvent(over);
    check(over.defaultPrevented, 'Dragover accepts animation drop');
    effects[0].dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer })); await tick();
    check((await api.getDocument()).slides[0].timing.m[0].dl === 2, 'Animation drop reorders model');
    click('Text'); await tick();
    host.querySelector('.ve-canvas .shp.selected')?.dispatchEvent(new MouseEvent('dblclick', {bubbles:true})); await tick();
    const text = host.querySelector('.ve-canvas .shp.selected .textbox'); check(text?.contentEditable === 'true', 'Shared textbox is directly editable');
    text.focus(); await tick();
    text.querySelector('p').innerHTML = '<span>Editable offline &lt;safe&gt;</span><span style="font-weight:700">Bold run</span>';
    text.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: 'edited' })); text.blur(); await tick(); check((await api.getDocument()).slides[0].shapes[2].txBody.p[0].r[0].t === 'Editable offline <safe>', 'Text commit');
    check((await api.getDocument()).slides[0].shapes[2].txBody.p[0].r[1].rPr.$_b === 1, 'Shared serializer retains rich text runs');
    click('Undo'); await tick();
    check((await api.getDocument()).slides[0].shapes[2].txBody.p[0].r[0].t !== 'Editable offline <safe>', 'Inline text edit undoes');
    click('Redo'); await tick();
    host.querySelector('.ve-canvas .shp.selected')?.dispatchEvent(new MouseEvent('dblclick', {bubbles:true})); await tick();
    const textNode = host.querySelector('.ve-canvas .shp.selected .textbox');
    textNode.focus();
    const cancelledText = textNode;
    cancelledText.querySelector('p').innerHTML = '<span>Cancelled edit</span>';
    cancelledText.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: 'edited' }));
    cancelledText.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    (await api.getDocument()); await tick(); click('Undo'); await tick();
    check((await api.getDocument()).slides[0].shapes[2].txBody.p[0].r[0].t === 'Editable offline <safe>', 'Inline edit can be undone after leaving text');
    click('Duplicate slide'); await tick(); check((await api.getDocument()).slides.length === 2, 'Slide duplicate');
    check((await api.getDocument()).slides[1].shapes[0].id !== (await api.getDocument()).slides[0].shapes[0].id, 'Slide shape IDs remapped');
    const downloads = [], createURL = URL.createObjectURL.bind(URL); URL.createObjectURL = blob => { downloads.push(blob); return createURL(blob); };
    HTMLAnchorElement.prototype.click = () => {};
    await api.saveZIP(); await tick();
    check(downloads.length === 1, 'Save produces one ZIP download: ' + host.querySelector('[role=status]').textContent);
    const archive = downloads[0];
    check(archive.type === 'application/zip', 'ZIP MIME type');
    const entries = await zipTestHelpers.readZip(archive);
    const decode = name => new TextDecoder().decode(entries.get(name));
    const savedDoc = zipTestHelpers.parseDocumentScript(decode('document.js'));
    check(savedDoc.slides.length === 2, 'Saved JSON includes edited slides');
    check(savedDoc.assets['test-image'] === 'assets/test-image.png', 'Media points to a separate file');
    check(entries.has('assets/test-image.png'), 'Raw media file is present');
    check(!decode('index.html').includes('data:image'), 'HTML has no embedded media');
    check(decode('index.html').includes('src="editor.js"'), 'Runtime is a separate file');
    check(entries.has('editor.css') && entries.has('manifest.json'), 'Stylesheet and manifest are present');
    const restored = await zipTestHelpers.readEditableZip(archive);
    check(restored.assets['test-image'].startsWith('data:image/png'), 'ZIP import restores offline media');
    await api.load(restored); await tick(); await api.saveZIP();
    check(downloads.length === 2, 'Opened ZIP can be saved again');
    const bytes = new Uint8Array(await archive.arrayBuffer()); let binary = '';
    for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
    window.savedArchive = btoa(binary);
    const presentationDoc = await api.getDocument();
    presentationDoc.file.width = 320; presentationDoc.file.height = 180;
    await api.load(presentationDoc); await tick();
    const editorFont = document.documentElement.style.fontSize;
    const originalWidth = document.querySelector('#sld .shp').getBoundingClientRect().width;
    click('Present');
    for (let i = 0; i < 100 && !window.SavannaPlayer; i++) await tick();
    check(!!window.SavannaPlayer, 'Player loads on demand');
    for (let i = 0; i < 100 && document.documentElement.style.fontSize === editorFont; i++) await tick();
    check(document.documentElement.style.fontSize !== editorFont, 'Player applies a different scale');
    check(!!host.querySelector('.ve-presentation'), 'Presentation opens');
    check([...host.querySelectorAll('.ve-presentation .textbox')].every(box => box.contentEditable === 'false'), 'Presentation text is read-only');
    click('Exit presentation'); await tick();
    check(document.documentElement.style.fontSize === editorFont, 'Exit restores editor root scale');
    check(Math.abs(document.querySelector('#sld .shp').getBoundingClientRect().width - originalWidth) < 1, 'Exit preserves editor shape size');
    window.dispatchEvent(new Event('resize')); await tick();
    check(document.documentElement.style.fontSize === editorFont, 'Resize after exit does not reactivate player scaling');
    click('Present');
    for (let i = 0; i < 100 && document.documentElement.style.fontSize === editorFont; i++) await tick();
    check(document.documentElement.style.fontSize !== editorFont, 'Present reapplies its scale after reopening');
    click('Exit presentation'); await tick();
    check(document.documentElement.style.fontSize === editorFont, 'Second exit restores editor root scale');
    api.destroy(); check(!host.querySelector('.ve-editor'), 'Destroy removes editor');
    const report = document.createElement('pre'); report.id = 'result'; report.textContent = 'PASS:' + window.savedArchive; document.body.append(report);
  } catch (error) { const report = document.createElement('pre'); report.id = 'result'; report.textContent = 'FAIL: ' + error.stack; document.body.append(report); }
}, { once: true });
</script>`;
    for (const name of ['editor.js', 'editor.css', 'renderer.css', 'player.js', 'player.css', 'document.js']) await writeFile(join(temp, name), await readFile(new URL('../dist/' + name, import.meta.url)));
    await mkdir(join(temp, 'assets/fonts'), { recursive: true });
    for (const name of ['Carlito.woff2']) await writeFile(join(temp, 'assets/fonts', name), await readFile(new URL('../dist/assets/fonts/' + name, import.meta.url)));
    const path = join(temp, 'fixture.html');
    await writeFile(path, source.slice(0, source.lastIndexOf('</body>')) + '<script>' + helper.outputFiles[0].text + '</script>' + fixture + source.slice(source.lastIndexOf('</body>')));
    const html = await runBrowserFixture(chrome, pathToFileURL(path).href, join(temp, 'profile'));
    const result = html.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1];
    assert.ok(result?.startsWith('PASS:'), result || html.slice(-5000));
    const archive = new Blob([Buffer.from(result.slice(5), 'base64')]);
    const entries = await readZip(archive), extracted = join(temp, 'extracted');
    for (const [name, data] of entries) { const target = join(extracted, name); await mkdir(join(target, '..'), { recursive: true }); await writeFile(target, data); }
    const extractedHTML = await readFile(join(extracted, 'index.html'), 'utf8');
    const reopenTest = `<script>window.addEventListener('DOMContentLoaded',async()=>{try{
      await SavannaVanEditor.ready();await new Promise(r=>setTimeout(r,40));
      if(!document.querySelector('.ve-editor'))throw Error('Extracted editor did not boot');
      const api=SavannaVanEditor.getEditor(document.querySelector('[data-savanna-editor]'));await api.ready;
      if((await api.getDocument()).slides[0].shapes[2].txBody.p[0].r[0].t!=='Editable offline <safe>')throw Error('Edited text lost');
      const img=new Image();img.src='assets/test-image.png';await img.decode();
      const p=document.createElement('pre');p.id='result';p.textContent='PASS';document.body.append(p);
    }catch(e){const p=document.createElement('pre');p.id='result';p.textContent=e.stack;document.body.append(p);}});</script>`;
    await writeFile(join(extracted, 'index.html'), extractedHTML.replace('</body>', reopenTest + '</body>'));
    const reopened = await runBrowserFixture(chrome, pathToFileURL(join(extracted, 'index.html')).href, join(temp, 'reopen-profile'));
    assert.equal(reopened.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1], 'PASS', reopened.slice(-1000));
    // A served package uses the same document.js as a locally opened package.
    const hostedDoc = JSON.parse((await readFile(join(extracted, 'document.js'), 'utf8')).replace(/^window\.SavannaDocument\s*=\s*/, '').replace(/;\s*$/, ''));
    hostedDoc.file.name = 'Changed in document.js';
    await writeFile(join(extracted, 'document.js'), 'window.SavannaDocument = ' + JSON.stringify(hostedDoc) + ';\n');
    const hostedFixture = extractedHTML.replace('</body>', `<script>window.addEventListener('DOMContentLoaded',async()=>{
      for(let i=0;i<200&&!document.querySelector('.ve-editor');i++)await new Promise(r=>setTimeout(r,10));
      await SavannaVanEditor.getEditor(document.querySelector('[data-savanna-editor]')).ready;
      await new Promise(r=>setTimeout(r,35));
      const title=document.querySelector('.ve-inspector input');const p=document.createElement('pre');p.id='result';
      p.textContent=title?.value==='Changed in document.js'?'PASS':'Document script was not loaded: '+title?.value;document.body.append(p);
    });</script></body>`);
    await writeFile(join(extracted, 'hosted.html'), hostedFixture);
    const server = createServer(async (request, response) => {
      try {
        const pathname = new URL(request.url, 'http://localhost').pathname;
        const mime = pathname.endsWith('.js') ? 'text/javascript' : pathname.endsWith('.css') ? 'text/css' : pathname.endsWith('.json') ? 'application/json' : 'text/html';
        response.setHeader('Content-Type', mime); response.end(await readFile(join(extracted, pathname)));
      } catch { response.statusCode = 404; response.end(); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const hosted = await runBrowserFixture(chrome, `http://127.0.0.1:${server.address().port}/hosted.html`, join(temp, 'hosted-profile'));
      assert.equal(hosted.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1], 'PASS', hosted.slice(-1000));
    } finally { await new Promise(resolve => server.close(resolve)); }

  } finally { await rm(temp, { recursive: true, force: true }); }
});
