import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
import test from 'node:test';
import assert from 'node:assert/strict';
import { compileDeck } from '../editor-vuejs/src/lib/agent/deck-compiler.mjs';
import { deckLayoutPreviews } from '../editor-vuejs/src/lib/agent/deck-preview.mjs';
import { pageImageCount } from '../editor-vuejs/src/lib/agent/slide-background.mjs';
let sequence = 0;
const options = { width: 1280, height: 720, genId: () => `bg-${++sequence}`, geometry: () => ({ d: 'R0,0,100,100' }) };
const title = '<text x="80" y="100" font-size="40">Title</text>';
function compile(body, extra = {}, settings = {}) {
  return compileDeck({ title: 'Test', audience: 'Readers', objective: 'Explain', slides: [{ title: 'Test', purpose: 'Explain', layout: 'svg', svg: `<svg viewBox="0 0 1280 720">${body}</svg>`, ...extra }] }, { ...options, ...settings });
}

test('bottom full-slide solid and gradient rectangles become native backgrounds and preview correctly', () => {
  const solid = compile('<rect width="1280" height="720" fill="#123456"/>' + title);
  assert.equal(solid.pages[0].bg.bgPr.solidFill.uniClr.$_val, '123456');
  assert.equal(solid.pages[0].shapes.length, 1);
  const preview = decodeURIComponent(deckLayoutPreviews(solid)[0].url);
  assert.ok(preview.includes('width="1280" height="720" fill="#123456"'));
  const gradient = compile('<defs><linearGradient id="g"><stop offset="0" stop-color="#123456"/><stop offset="1" stop-color="#abcdef"/></linearGradient></defs><rect width="1280" height="720" fill="url(#g)"/>' + title);
  assert.ok(gradient.pages[0].bg.bgPr.gradFill);
  assert.equal(gradient.pages[0].shapes.length, 1);
  assert.ok(decodeURIComponent(deckLayoutPreviews(gradient)[0].url).includes('<linearGradient'));
});

test('full-slide image becomes a native picture background with crop, source and licensed credit retained', () => {
  const assets = new Map([['0:svg:0', { media: { name: 'background.jpg', w: 1600, h: 900 }, title: 'Landscape', author: 'Photographer', license: 'CC BY 4.0', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Landscape.jpg' }]]);
  const compiled = compile('<rect width="1280" height="720" fill="#FFFFFF"/><image x="0" y="0" width="1280" height="720" preserveAspectRatio="xMidYMid slice" data-query="landscape" aria-label="Landscape"/>' + title, {}, { assets });
  const page = compiled.pages[0];
  assert.equal(page.bg.bgPr.blipFill.blip.$_target, 'background.jpg');
  assert.deepEqual(page.bg.bgPr.blipFill.stretch, { fillRect: {} });
  assert.equal(page.shapes.filter(shape => shape.type === 'image').length, 0);
  assert.equal(pageImageCount(page), 1);
  assert.equal(page.agentMetadata.backgroundImageSource.author, 'Photographer');
  assert.ok(page.shapes.some(shape => shape.name === 'Image credits' && shape.txBody.p[0].r[0].t.includes('CC BY 4.0')));
});

test('oversized cover images retain the visible crop when moved into background fill', () => {
  const assets = new Map([['0:svg:0', { media: { name: 'wide.jpg', w: 1400, h: 800 }, title: 'Backdrop', author: 'AI', license: 'AI-generated' }]]);
  const page = compile('<image x="-60" y="-40" width="1400" height="800" preserveAspectRatio="none" data-query="backdrop" aria-label="Backdrop"/>' + title, {}, { assets }).pages[0];
  assert.deepEqual(page.bg.bgPr.blipFill.srcRect, { $_l: 4286, $_r: 4286, $_t: 5000, $_b: 5000 });
});

test('foreground overlays, partial panels, rounded shapes, links, borders and animation targets stay selectable', () => {
  const cases = [
    '<rect x="50" y="150" width="1100" height="400" fill="#123456"/>',
    '<rect width="1280" height="720" rx="30" fill="#123456"/>',
    '<rect width="1280" height="720" fill="#123456" stroke="#ffffff" stroke-width="4"/>',
    '<rect width="1280" height="720" fill="#123456" opacity="0.5"/>',
    '<a href="https://example.com"><rect width="1280" height="720" fill="#123456"/></a>',
    '<path d="M0 0L1280 0L640 720Z" fill="#123456"/>',
  ];
  for (const body of cases) {
    const page = compile(body + title).pages[0];
    assert.equal(page.bg, undefined, body);
    assert.equal(page.shapes.length, 2, body);
  }
  const overlay = compile(title + '<rect width="1280" height="720" fill="#123456"/>').pages[0];
  assert.equal(overlay.bg, undefined);
  const animated = compile('<rect id="background" width="1280" height="720" fill="#123456"/>' + title,
    { motion: { groups: { background: { effect: 'entrance_fade', duration: .5 } } } }).pages[0];
  assert.equal(animated.bg, undefined);
  assert.equal(animated.shapes.length, 2);
  assert.ok(animated.timing.m.length);
});


test('media cleanup retains true background image files from page records and legacy metadata', async () => {
  const deleted = [];
  const dependencies = {
    '../common/db/dbutils': {
      loadFileFromDexie: async () => ({ slides: [{ id: 'one' }, { id: 'two', bg: { blipFill: { blip: { $_target: 'legacy.png' } } } }], layouts: [] }),
      getSldType: () => ({ sldType: 'slides', sldTag: 'sld' }),
      loadSlideFromDexie: async (file, id) => ({ shapes: [], ...(id === 'one' ? { bg: { bgPr: { blipFill: { blip: { $_target: 'background.png' } } } } } : {}) }),
    },
    '../common/db/opfs': {
      getMediaRecordsFromOPFS: async () => [{ name: 'background.png' }, { name: 'legacy.png' }, { name: 'unused.png' }],
      deleteMediaRecordFromOPFS: async (file, name) => deleted.push(name),
    },
  };
  const module = { exports: {} };
  const code = transformSync(readFileSync('shared-vuejs/src/edlib/pptx/unzipPPTX.ts', 'utf8'), { loader: 'ts', format: 'cjs' }).code;
  vm.runInNewContext(code, { module, exports: module.exports, require: name => dependencies[name] || {} });
  await module.exports.deleteUnusedMedia('file');
  assert.deepEqual(deleted, ['unused.png']);
});
