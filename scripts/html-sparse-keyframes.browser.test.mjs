import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import snapshot from '../../desq-core/shared-vuejs/src/edlib/html-import/snapshot-slides-source.mjs';
import {compileMotion} from '../editor-vuejs/src/lib/agent/ppt-master-motion.mjs';
import {runBrowserFixture} from './browser-fixture.mjs';

const chrome = process.env.CHROME_BIN || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/chromium', '/usr/bin/google-chrome',
].find(existsSync);

test('sparse CSS opacity keyframes compile as valid entrance timing', {skip: !chrome, timeout: 60000}, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'desq-sparse-keyframes-'));
  try {
    const file = join(directory, 'fixture.html');
    writeFileSync(file, `<!doctype html><style>
      .slide {width:1280px;height:720px}
      @keyframes panSwing {
        0% {transform:rotate(-80deg);opacity:0}
        40% {transform:rotate(15deg);opacity:1}
        60% {transform:rotate(-5deg)}
        100% {transform:rotate(0deg)}
      }
      .pan {animation:panSwing .6s linear forwards}
    </style><div class="slide"><div class="pan">Pan</div></div><script>
      addEventListener('message', event => {
        const result=document.createElement('pre');result.id='result';
        result.textContent=JSON.stringify(event.data);document.body.append(result);
      });
      (${snapshot})('test',1280,1);
    </script>`);
    const output = await runBrowserFixture(chrome, pathToFileURL(file).href, join(directory, 'profile'));
    const encoded = output.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1];
    assert.ok(encoded, output);
    const result = JSON.parse(encoded.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&'));
    assert.equal(result.error, undefined);
    const metadata = result.slides[0].match(/data-desq-entrance="([^"]+)"/)?.[1];
    assert.ok(metadata, result.slides[0]);
    const effects = JSON.parse(metadata.replaceAll('&quot;', '"').replaceAll('&amp;', '&'));
    const opacity = effects[0].property_frames.opacity;
    assert.ok(opacity.every(frame => Number.isFinite(frame.v)));
    assert.ok(opacity.some(frame => frame.t === .4 && frame.v === 1));
    assert.ok(compileMotion({groups:{pan:{effects}}}, [{id:'pan',name:'pan'}], {width:1280,height:720}).timing.m.length);
  } finally {
    rmSync(directory, {recursive:true, force:true});
  }
});
