import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fitLayouts, readSlide, sharedDesignLayout, splitBulletContent } from '../editor-vuejs/src/lib/design/reformat-layouts.mjs';

const catalog = JSON.parse(readFileSync(new URL('../editor-vuejs/src/lib/design/template-catalog.json', import.meta.url)));
const theme = catalog.find(entry => entry.slug === 'cobalt-grid');
const paragraph = (t, pPr, tag) => ({ pPr, r: [{ t, ...(tag ? { $_otag: tag } : {}) }] });

test('Cobalt Grid puts a numbered list in separate index entries and retains the slide-number field', () => {
  const listStyle = { $_marL: '514350', $_indent: '-514350', buAutoNum: { $_type: 'arabicPeriod' } };
  const slide = { shapes: [
    { id: 'title', name: 'Rectangle 2', type: 'shape', y: 155, txBody: { p: [paragraph('Review Questions')] } },
    { id: 'body', type: 'shape', y: 56, txBody: { p: [
      'Which terms should the reader know?',
      'What are the routine uses?',
      'Which findings can it help explain, and why does accuracy matter?',
    ].map(text => paragraph(text, listStyle)) } },
    { id: 'number', name: 'Slide Number Placeholder 5', type: 'shape', y: 520,
      txBody: { p: [paragraph('2', {}, 'fld')] } },
  ] };
  const dims = { width: 1280, height: 720 };
  const content = readSlide(slide, () => false, dims);
  assert.equal(content.title, 'Review Questions');
  assert.equal(content.pageNumbers.length, 1);
  let id = 0;
  const genId = () => 'new-' + ++id;
  const candidates = fitLayouts(splitBulletContent(content, genId), {
    ...dims, theme, genId, headingFont: 'Newsreader', bodyFont: 'Hanken Grotesk',
    measureText: (text, pt) => text.length * pt * .69,
  });
  const [heading, ...objects] = candidates.find(candidate => candidate.id === 'steps').shapes;
  assert.equal(heading.w, 1176);
  assert.equal(heading.txBody.p[0].r[0].rPr.$_sz, 5200);
  const entries = objects.filter(shape => shape.reformatListNumber != null);
  assert.deepEqual(entries.map(shape => shape.txBody.p[0].r[0].rPr.$_sz), [2200, 2200, 2200]);
  assert.ok(entries.every(shape => shape.txBody.p[0].pPr.buNone && !shape.txBody.p[0].pPr.buAutoNum));
  assert.deepEqual(objects.filter(shape => shape.name === 'Template list marker')
    .map(shape => shape.txBody.p[0].r[0].t), ['01', '02', '03']);
  assert.equal(objects.find(shape => shape.id === 'number').txBody.p[0].r[0].$_otag, 'fld');
  assert.equal(readSlide({ shapes: [heading, ...objects] }, () => false, dims).title, 'Review Questions');
  const layout = sharedDesignLayout(dims.width, dims.height, genId, theme);
  assert.equal(layout.bg.bgPr.solidFill.uniClr.$_val, theme.background.slice(1));
  assert.ok(layout.shapes.some(shape => shape.name === 'Cobalt top hairline'));
  assert.ok(layout.shapes.every(shape => shape.w !== dims.width || shape.h !== dims.height));
});

test('Cobalt Grid picture layouts preserve image objects and give dense lists a fitting option', () => {
  const dims = { width: 1280, height: 720 };
  const text = (id, count) => ({ id, type: 'shape',
    txBody: { p: Array.from({ length: count }, (_, index) => paragraph('A short item ' + index)) } });
  const title = { ...text('title', 1), ph: { $_type: 'title' } };
  const pictures = ['one', 'two', 'three'].map(id => ({
    id, type: 'image', w: 240, h: 180, blipFill: { blip: { $_target: id + '.png' } },
  }));
  const options = { ...dims, theme, headingFont: 'Newsreader', bodyFont: 'Hanken Grotesk',
    measureText: (value, pt) => value.length * pt * .7 };
  for (const [role, counts] of [['picture-rail', [8, 7]], ['picture-strip', [2, 2]]]) {
    assert.ok(theme.variants.some(variant => variant.role === role));
    const page = { shapes: [title, ...counts.map((n, i) => text('list' + i, n)), ...pictures] };
    const content = readSlide(page, () => false, dims);
    const result = fitLayouts(content, options).find(candidate => candidate.id === role);
    assert.ok(result, role);
    const images = result.shapes.filter(shape => shape.type === 'image');
    assert.deepEqual(images.map(shape => shape.id), pictures.map(shape => shape.id));
    assert.deepEqual(images.map(shape => shape.blipFill), pictures.map(shape => shape.blipFill));
    assert.ok(images.every(shape => shape.x > 0 && shape.y > 0 && Math.abs(shape.w / shape.h - 4 / 3) < 1e-9));
  }
});

test('Single-pixel PowerPoint pictures do not trigger picture layouts, even after enlargement', () => {
  const dims = { width: 1280, height: 720 };
  const title = { id: 'title', ph: { $_type: 'title' }, txBody: { p: [paragraph('Summary')] } };
  const body = { id: 'body', txBody: { p: [paragraph('Next steps for the team')] } };
  const blankPicture = { type: 'image', blipFill: { blip: { $_target: 'blank.png', $_w: 1, $_h: 1 } } };
  const content = readSlide({ shapes: [title, body,
    { ...blankPicture, id: 'original', w: 1, h: 1 },
    { ...blankPicture, id: 'enlarged', w: 320, h: 320 },
  ] }, () => false, dims);
  assert.deepEqual(content.images, []);
  const candidates = fitLayouts(content, { ...dims, theme, measureText: (text, pt) => text.length * pt * .7 });
  assert.ok(candidates.some(candidate => candidate.id === 'editorial'));
  assert.ok(candidates.every(candidate => candidate.shapes.every(shape => shape.type !== 'image')));
});

test('People’s Platform uses separate large numbers or a timeline for list content', () => {
  const dims = { width: 1280, height: 720 };
  const platform = catalog.find(entry => entry.slug === 'peoples-platform');
  let id = 0;
  const genId = () => 'marker-' + ++id;
  const options = { ...dims, theme: platform, profile: 'standard', genId,
    measureText: (text, pt) => text.length * pt * .7 };
  const fit = (title, items) => {
    const page = { shapes: [
      { id: 'title', ph: { $_type: 'title' }, txBody: { p: [paragraph(title)] } },
      { id: 'body', txBody: { p: items } },
    ] };
    return fitLayouts(splitBulletContent(readSlide(page, () => false, dims), genId), options);
  };
  const pillars = fit('Priorities', [
    { r: [{ t: '•' }, { t: ' Focus', rPr: { $_i: 1 } }] }, paragraph('7. Learn'),
  ]).find(candidate => candidate.id === 'numbered-pillars');
  const itemRuns = pillars.shapes.filter(shape => shape.reformatListNumber != null)
    .map(shape => shape.txBody.p[0].r[0]);
  assert.deepEqual(itemRuns.map(run => run.t), ['Focus', 'Learn']);
  assert.equal(itemRuns[0].rPr.$_i, 1);
  assert.deepEqual(pillars.shapes.filter(shape => shape.name === 'Template list marker')
    .map(shape => [shape.txBody.p[0].r[0].t, shape.txBody.p[0].r[0].rPr.$_sz]), [['01', 5800], ['07', 5800]]);
  const timeline = fit('Project Roadmap', [paragraph('- Kickoff'), paragraph('- Release')])
    .find(candidate => candidate.id === 'timeline');
  assert.equal(timeline.shapes.filter(shape => shape.name === 'Template list marker' && !shape.txBody).length, 3);
});

test('Catalog list layouts replace typed bullets with their own editable markers', () => {
  const dims = { width: 1280, height: 720 };
  const blue = catalog.find(entry => entry.slug === 'blue-professional');
  let id = 0;
  const genId = () => 'new-' + ++id;
  const page = { shapes: [
    { id: 'title', ph: { $_type: 'title' }, txBody: { p: [paragraph('Findings')] } },
    { id: 'list', txBody: { p: [paragraph('• First finding'), paragraph('• Second finding')] } },
  ] };
  const content = splitBulletContent(readSlide(page, () => false, dims), genId);
  const candidates = fitLayouts(content, { ...dims, theme, profile: 'standard', genId,
    measureText: (text, pt) => text.length * pt * .7 });
  for (const [role, type] of [['blue-agenda', 'text'], ['blue-detail', 'ellipse']]) {
    assert.ok(blue.variants.some(variant => variant.role === role));
    const { shapes } = candidates.find(candidate => candidate.id === role);
    assert.deepEqual(shapes.filter(shape => shape.name === 'Template list marker').map(shape => shape.type), [type, type]);
    assert.deepEqual(shapes.filter(shape => shape.reformatListNumber != null)
      .map(shape => shape.txBody.p[0].r[0].t), ['First finding', 'Second finding']);
  }
  for (const [slug, role, expected] of [
    ['bold-poster', 'poster-services', ['rectangle', 'ellipse', 'rectangle', 'ellipse']],
    ['broadside', 'broadside-list', ['/', '/']],
    ['vellum', 'vellum-list', ['1', '2']],
  ]) {
    assert.ok(catalog.find(entry => entry.slug === slug).variants.some(variant => variant.role === role));
    const candidate = candidates.find(entry => entry.id === role);
    assert.ok(candidate.styledList);
    assert.deepEqual(candidate.shapes.filter(shape => shape.name === 'Template list marker')
      .map(shape => shape.txBody?.p[0].r[0].t ?? shape.type), expected);
  }
});
