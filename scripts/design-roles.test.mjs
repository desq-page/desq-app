import test from 'node:test';
import assert from 'node:assert/strict';
import { templateRole, contentRole, needsClosingSlide } from '../editor-vuejs/src/lib/design/design-roles.mjs';
import { sourceLayouts, sourcePointsLayouts, sourceSummaryLayouts, sourceClosingLayouts, withSourceLayouts } from '../editor-vuejs/src/lib/design/source-layouts.mjs';
import { generatedLayouts } from '../editor-vuejs/src/lib/design/generated-layouts.mjs';
import { fitLayouts, readSlide, splitBulletContent, layouts } from '../editor-vuejs/src/lib/design/reformat-layouts.mjs';
import sourceCatalog from '../editor-vuejs/src/lib/design/template-catalog.json' with { type: 'json' };
import generatedCatalog from '../editor-vuejs/src/lib/design/generated-template-catalog.json' with { type: 'json' };

test('closing and summary have separate roles and explicit template roles take priority', () => {
  assert.equal(templateRole({ index: 8, sourceClass: 'summary', label: '08 Summary' }), 'summary');
  assert.equal(templateRole({ index: 10, sourceClass: 's-close', label: '10 Close' }), 'closing');
  assert.equal(templateRole({ index: 1, layoutRole: 'closing' }), 'closing');
  assert.ok(sourceLayouts.find(layout => layout.id === 'source/editorial-forest/8').templateRole === 'summary');
  assert.ok(!sourceLayouts.find(layout => layout.id === 'source/editorial-forest/8').isClosing);
});

test('every family has point and closing layouts and repeated application does not append another closing', () => {
  const definitions = [...sourceLayouts, ...sourcePointsLayouts, ...sourceSummaryLayouts, ...sourceClosingLayouts, ...generatedLayouts];
  const sourceFamilies = new Set(sourceLayouts.map(layout => layout.family));
  for (const family of sourceFamilies) {
    assert.ok(definitions.some(layout => layout.family === family && layout.templateRole === 'points'));
    assert.ok(definitions.some(layout => layout.family === family && layout.isClosing));
    assert.ok(definitions.some(layout => layout.family === family && layout.templateRole === 'summary'));
  }
  const item = { title: 'Review', texts: [{ role: 'title', text: 'Review' }, { role: 'body', text: 'Key takeaways' }] };
  assert.equal(contentRole(item), 'summary');
  assert.ok(needsClosingSlide([{ id: 'last' }], [{ item }], { id: 'closing' }));
  assert.ok(!needsClosingSlide([{ agentMetadata: { designIdeas: { automaticClosing: true } } }], [{ item }], { id: 'closing' }));
  assert.ok(!needsClosingSlide([{ id: 'last' }], [{ item: { title: 'Thank you', texts: [{ role: 'title', text: 'Thank you' }] } }], { id: 'closing' }));
});

test('every selectable family can fit its closing and a five-point slide', () => {
  let sequence = 0;
  for (const theme of [...withSourceLayouts(sourceCatalog), ...generatedCatalog]) {
    const ids = new Set(theme.variants.map(variant => variant.role));
    const closing = layouts.find(layout => ids.has(layout.id) && layout.isClosing && !layout.image && !layout.unavailableReason);
    assert.ok(closing, theme.slug);
    const dimensions = { width: 1280, height: 720 };
    const title = { id: 'title', ph: { $_type: 'title' }, txBody: { p: [{ r: [{ t: closing.defaultTitle || 'Thank you' }] }] } };
    const options = { ...dimensions, theme, profile: 'standard', headingFont: theme.headingFont,
      bodyFont: theme.bodyFont, measureText: (text, size) => text.length * size * .5, genId: () => String(++sequence) };
    assert.equal(fitLayouts(readSlide({ shapes: [title] }, () => false, dimensions), {
      ...options, layoutIds: new Set([closing.id]),
    }).length, 1, theme.slug);
    const points = Array.from({ length: 5 }, (_, index) => ({
      id: 'point-' + index, txBody: { p: [{ r: [{ t: 'Point ' + (index + 1) }] }] },
    }));
    const content = readSlide({ shapes: [title, ...points] }, () => false, dimensions);
    const pointIds = new Set(layouts.filter(layout => ids.has(layout.id) && layout.templateRole === 'points').map(layout => layout.id));
    assert.ok(fitLayouts(content, { ...options, layoutIds: pointIds }).length > 0, theme.slug);
  }
});

test('People’s Platform comparison adapts from two through five talking-point columns', () => {
  let sequence = 0;
  for (const count of [2, 3, 4, 5]) {
    const title = { id: 'title', ph: { $_type: 'title' }, txBody: { p: [{ r: [{ t: 'Our priorities' }] }] } };
    const body = { id: 'points', txBody: { p: Array.from({ length: count }, (_, index) => ({
      pPr: { buChar: { $_char: '•' } }, r: [{ t: 'Priority ' + (index + 1) + ' with a supporting explanation.' }],
    })) } };
    const dimensions = { width: 1280, height: 720 };
    const content = splitBulletContent(readSlide({ shapes: [title, body] }, () => false, dimensions), () => String(++sequence));
    const layout = sourceLayouts.find(layout => layout.id === 'source/peoples-platform/9');
    assert.equal(layout.templateRole, 'points');
    const [candidate] = fitLayouts(content, { ...dimensions, theme: layout.theme, profile: 'standard',
      headingFont: 'Arial', bodyFont: 'Arial', genId: () => String(++sequence),
      measureText: (text, size) => text.length * size * .5, layoutIds: new Set([layout.id]) });
    assert.ok(candidate, String(count));
    const recovered = readSlide({ shapes: candidate.shapes }, () => false, dimensions);
    assert.equal(recovered.texts.length, count + 1);
    assert.equal(recovered.title, 'Our priorities');
    for (let i = 1; i <= count; i++) assert.ok(recovered.body.includes('Priority ' + i));
  }
});
