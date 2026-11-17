import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { runBrowserFixture } from './browser-fixture.mjs';
import test from 'node:test';
test('hard-break markers do not enlarge the paragraph line boxes', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'desq-break-spacing-'));
  const css = readFileSync(
    new URL(
      '../../desq-core/shared-vuejs/src/assets/slide.css',
      import.meta.url,
    ),
    'utf8',
  );
  const title =
    '<span style="--sz:165;font-family:serif">Quarterly</span><span data-br>\n</span><span style="--sz:165;font-family:serif">Review</span><span data-br>\n</span><span style="--sz:165;font-family:serif">2026</span>';
  writeFileSync(
    join(dir, 'index.html'),
    `<style>${css}\nhtml{font-size:1px}body{width:1920px}.slide{--fnt-scl:1;--ln-spc-pct:1;--ln-spc-reduc:0}.slide p{white-space:pre-wrap;font-family:Arial;--sz:18;--ln-spc:151.8pt}.old p>span[data-br]{font-size:24px!important;line-height:202.4px}</style><div class="slide old"><p>${title}</p></div><div class="slide fixed"><p>${title}</p></div><script>const advance=selector=>{const spans=[...document.querySelectorAll(selector+' p>span:not([data-br])')];return spans[1].getBoundingClientRect().top-spans[0].getBoundingClientRect().top};const out=document.createElement('pre');out.id='result';out.textContent=JSON.stringify({old:advance('.old'),fixed:advance('.fixed')});document.body.append(out);</script>`,
  );
  try {
    const output = await runBrowserFixture(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      pathToFileURL(join(dir, 'index.html')).href,
      join(dir, 'profile'),
    );
    const result = JSON.parse(
      output.match(/<pre id="result">([^<]+)<\/pre>/)[1],
    );
    assert.ok(result.old > result.fixed + 10, JSON.stringify(result));
    assert.ok(Math.abs(result.fixed - 202.4) < 1, JSON.stringify(result));
  } finally {
    rmSync(dir, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    });
  }
});
