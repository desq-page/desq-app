import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generatedLayouts } from '../editor-vuejs/src/lib/design/generated-layouts.mjs';
import { fitLayouts, readSlide, splitBulletContent } from '../editor-vuejs/src/lib/design/reformat-layouts.mjs';
const catalog = JSON.parse(readFileSync(new URL('../editor-vuejs/src/lib/design/generated-template-catalog.json', import.meta.url)));
const dims = { width: 1280, height: 720 };
const text = (id, value, title = false) => ({ id, type: 'shape', x: 50, y: title ? 50 : 240,
  w: 900, h: 180, ...(title ? { ph: { $_type: 'title' } } : {}), txBody: { p: value.split('\n').map(t => ({ r: [{ t }] })) } });
const title = text('title', 'How the process works', true);
const body = text('body', 'A clear explanation of the evidence.');
const picture = { id: 'photo', type: 'image', w: 800, h: 600, blipFill: { blip: { $_target: 'photo.jpg' } } };
const chart = { id: 'chart', type: 'chart', w: 800, h: 500,
  graphic: { graphicData: { 'c:chart': { chartJson: { source: 'unchanged source data' } } } } };
let id = 0;
const options = { ...dims, profile: 'standard', theme: catalog[0], headingFont: 'Arial', bodyFont: 'Arial',
  genId: () => `new-${++id}`, measureText: (s, size) => s.length * size * .6 };
const candidates = shapes => fitLayouts(readSlide({ shapes }, () => false, dims), options);

test('ten families register one hundred unique, bounded native layouts', () => {
  assert.equal(catalog.length, 10);
  assert.equal(generatedLayouts.length, 100);
  assert.equal(new Set(generatedLayouts.map(l => l.id)).size, 100);
  for (const family of catalog) for (const variant of family.variants) {
    const layout = generatedLayouts.find(l => l.id === variant.role);
    assert.ok(layout, variant.role);
    const count = /cards|flow/.test(layout.id) ? 4 : 2;
    for (const slot of [...layout.slots(count, true), ...(layout.image ? [layout.image] : []), ...(layout.artwork || [])]) {
      assert.ok(slot.x >= 0 && slot.y >= 0 && slot.x + slot.w <= 1280 && slot.y + slot.h <= 720, layout.id);
    }
  }
});

test('each custom family fits one photo and three to five points from a list or separate textboxes', () => {
  for (const family of catalog) for (const count of [3, 4, 5]) for (const split of [false, true]) {
    const points = Array.from({ length: count }, (_, i) => 'Talking point ' + (i + 1) + ' with supporting detail.');
    const bodies = split ? [text('list', points.map((point, i) => (i + 1) + '. ' + point).join('\n'))]
      : points.map((point, i) => text('point-' + i, point));
    const original = readSlide({ shapes: [title, ...bodies, picture] }, () => false, dims);
    const content = split ? splitBulletContent(original, options.genId) : original;
    const [result] = fitLayouts(content, { ...options, theme: family,
      layoutIds: new Set([family.slug + '-photo-points']) });
    assert.ok(result, family.slug + ' ' + count);
    const image = result.shapes.find(shape => shape.id === picture.id);
    assert.deepEqual(image.blipFill, picture.blipFill);
    const recovered = readSlide({ shapes: result.shapes }, () => false, dims);
    assert.equal(recovered.title, 'How the process works');
    assert.equal(recovered.texts.length, count + 1);
    assert.equal(recovered.images.length, 1);
    for (const point of points) assert.ok(recovered.body.includes(point));
    const pointShapes = result.shapes.filter(shape => shape.txBody && shape.id !== title.id);
    assert.equal(pointShapes.length, count);
    assert.ok(pointShapes.every(shape => shape.x + shape.w <= image.x || shape.x >= image.x + image.w));
    assert.ok(pointShapes.every((shape, i) => i === 0 || shape.y >= pointShapes[i - 1].y + pointShapes[i - 1].h));
    for (const shape of result.shapes) assert.ok(shape.x >= 0 && shape.y >= 0 &&
      shape.x + shape.w <= dims.width && shape.y + shape.h <= dims.height);
    assert.equal(result.shapes.filter(shape => shape.name === 'Design Ideas artwork: Talking point accent').length, count);
  }
  for (const image of [undefined, chart]) {
    assert.ok(!candidates([title, body, body, body, ...(image ? [image] : [])])
      .some(layout => layout.id.endsWith('-photo-points')));
  }
});

test('photo and chart variants require matching real assets and preserve their content', () => {
  for (const family of catalog) {
    assert.ok(!candidates([title, body]).some(l => l.id === `${family.slug}-photo` || l.id === `${family.slug}-chart`));
    const photo = candidates([title, body, picture]).find(l => l.id === `${family.slug}-photo`);
    assert.ok(photo);
    assert.deepEqual(photo.shapes.find(s => s.id === picture.id).blipFill, picture.blipFill);
    assert.ok(!candidates([title, body, picture]).some(l => l.id === `${family.slug}-chart`));
    const result = candidates([title, body, chart]).find(l => l.id === `${family.slug}-chart`);
    assert.ok(result);
    assert.deepEqual(result.shapes.find(s => s.id === chart.id).graphic, chart.graphic);
    assert.equal(readSlide({ shapes: result.shapes }, () => false, dims).images.length, 1);
  }
  assert.equal(readSlide({ shapes: [{ ...chart, graphic: { graphicData: { tbl: {} } } }] }, () => false, dims).reason, 'complex objects');
});

test('process layouts split bullets into editable nodes and survive repeat formatting', () => {
  const content = splitBulletContent(readSlide({ shapes: [title, text('list', '1. Discover\n2. Develop\n3. Deliver')] }, () => false, dims), options.genId);
  for (const family of catalog) {
    const result = fitLayouts(content, options).find(l => l.id === `${family.slug}-flow`);
    assert.ok(result, family.slug);
    assert.equal(result.shapes.filter(s => s.name === 'Design Ideas artwork: Process connector').length, 4);
    const reread = readSlide({ shapes: result.shapes }, () => false, dims);
    assert.ok(!reread.reason);
    assert.equal(reread.texts.length, 4);
    assert.ok(!reread.body.includes('1.'));
  }
});

test('restored built-in family fits a title, detailed list and a real picture', () => {
  const existing = JSON.parse(readFileSync(new URL('../editor-vuejs/src/lib/design/template-catalog.json', import.meta.url)));
  assert.ok(existing.find(t => t.slug === 'builtin-ocean').variants.some(v => v.role === 'builtin-photo-list'));
  const content = splitBulletContent(readSlide({ shapes: [title, text('list', '1. First detailed explanation\n2. Second detailed explanation'), picture] }, () => false, dims), options.genId);
  const result = fitLayouts(content, options).find(l => l.id === 'builtin-photo-list');
  assert.ok(result);
  assert.ok(result.shapes.some(s => s.id === picture.id));
});
