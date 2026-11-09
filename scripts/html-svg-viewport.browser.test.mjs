import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runBrowserFixture } from './browser-fixture.mjs';

const chrome = process.env.CHROME_BIN || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/chromium', '/usr/bin/google-chrome',
].find(existsSync);

test('HTML import centers a translated card and fits inline SVG circles inside it', { skip: !chrome, timeout: 60000 }, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'desq-svg-viewport-'));
  try {
    await build({
      stdin: { resolveDir: resolve('.'), contents: `
        import { parseFrontendSlides } from '../desq-core/shared-vuejs/src/edlib/html-import/frontend-slides-import.mjs';
        import { renderScriptedFrontendSlides } from '../desq-core/shared-vuejs/src/edlib/html-import/scripted-html-render.mjs';
        import { htmlToSVG } from '../desq-core/shared-vuejs/src/edlib/html-import/html-slides.mjs';
        import { compilePageSVG } from '../desq-core/shared-vuejs/src/edlib/document-import/compiler/ppt-master-svg.mjs';

        const result = document.createElement('pre');
        result.id = 'result';
        (async () => {
          try {
            const art = (id, left, aspect = '') =>
              '<div class="step-art" style="left:' + left + 'px">' +
              '<svg class="art-svg" width="240" height="240" viewBox="20 30 240 240"' + aspect + '>' +
              '<circle id="' + id + '" cx="140" cy="150" r="100"/></svg></div>';
            const source = '<style>.intro-card{position:absolute;left:50%;top:48%;transform:translate(-50%,-50%);width:980px;height:284px;background:white}' +
              '.step-art{position:absolute;top:80px;width:300px;height:124px;display:flex;align-items:center;justify-content:center;overflow:hidden}' +
              '.art-svg{width:100%;height:auto;max-width:100%;max-height:100%}</style><section class="slide">' +
              '<div class="intro-card" id="!!intro-card">' +
              art('default', 20) +
              art('aligned', 340, ' preserveAspectRatio="xMaxYMid meet"') +
              art('stretch', 660, ' preserveAspectRatio="none"') +
              '</div></section>';
            const deck = await renderScriptedFrontendSlides(source, parseFrontendSlides(source));
            let id = 0;
            const svg = htmlToSVG(deck.slides[0].html);
            const { shapes } = compilePageSVG(svg, { width: 1280, height: 720, genId: () => String(++id) });
            result.textContent = JSON.stringify(Object.fromEntries(shapes.map(({ name, x, y, w, h }) =>
              [name, [x + w / 2, y + h / 2, w, h]])));
          } catch (error) {
            result.textContent = error.stack;
          }
          document.body.append(result);
        })();
      ` },
      bundle: true, format: 'iife', outfile: join(directory, 'fixture.js'),
    });
    const fixture = join(directory, 'fixture.html');
    writeFileSync(fixture, '<!doctype html><body><script src="fixture.js"></script>');
    const output = await runBrowserFixture(chrome, pathToFileURL(fixture).href, join(directory, 'profile'));
    const match = /<pre id="result">([\s\S]*?)<\/pre>/.exec(output);
    assert.ok(match, output.slice(-1000));
    const frames = JSON.parse(match[1]);
    const diameter = 200 * 124 / 240;
    const centerY = 720 * 0.48;
    for (const [name, expected] of Object.entries({
      '!!intro-card:box': [640, centerY, 980, 284],
      default: [320, centerY, diameter, diameter],
      aligned: [728, centerY, diameter, diameter],
      stretch: [960, centerY, 250, diameter],
    })) {
      assert.ok(expected.every((value, index) => Math.abs(frames[name]?.[index] - value) < 0.15),
        `${name}: expected ${expected}, got ${frames[name]}`);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
