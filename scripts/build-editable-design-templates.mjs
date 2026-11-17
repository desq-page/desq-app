import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { scriptJSON, escapeHTML, DATA_ID } from 'shared-vuejs/api/presentation-document';
import { compileNativeChart } from '../editor-vuejs/src/lib/agent/ppt-master-charts.mjs';
import { fitLayouts, readSlide, sharedDesignLayout } from '../editor-vuejs/src/lib/design/reformat-layouts.mjs';
import sourceFamilies from '../editor-vuejs/src/lib/design/template-catalog.json' with { type: 'json' };
import generatedFamilies from '../editor-vuejs/src/lib/design/generated-template-catalog.json' with { type: 'json' };

const source = process.argv[2];
if (!source) throw new Error('Pass the path to a beautiful-html-templates checkout.');
const output = new URL('../editor-vuejs/public/templates/design-families/', import.meta.url);
for (const family of sourceFamilies.filter(family => family.slug !== 'builtin-ocean')) {
  const directory = join(source, 'templates', family.slug);
  const html = readFileSync(join(directory, 'template.html'), 'utf8');
  // The original runtime adds slide classes in the browser. DESQ discovers slides before executing it.
  const marked = html.replace(/<section\b(?=[^>]*\sdata-(?:screen-label|label)=)(?![^>]*\sdata-desq-slide\b)/gi,
    '<section data-desq-slide');
  const standalone = marked.replace(/<script\s+src=["']deck-stage\.js["']\s*><\/script>/i, () => {
    const runtime = readFileSync(join(directory, 'deck-stage.js'), 'utf8');
    return '<script>\n' + runtime.replace(/<\/script/gi, '<\\/script') + '\n</script>';
  });
  writeFileSync(new URL(family.slug + '.html', output), standalone);
}

const dimensions = { width: 1280, height: 720 };
for (const theme of generatedFamilies) {
  let sequence = 0;
  const genId = () => 'shape-' + ++sequence;
  const text = (label, y, ph) => ({
    id: genId(), y, ...(ph ? { ph: { $_type: ph } } : {}),
    txBody: { p: [{ r: [{ t: label }] }] },
  });
  const getVisual = role => {
    if (role === 'chart') return [{ id: genId(), w: 640, h: 360,
      ...compileNativeChart({ type: 'bar', categories: ['A', 'B', 'C'], series: [{ name: 'Series', values: [3, 5, 4] }] }) }];
    return role === 'photo' || role === 'photo-points' ? [{ id: 'photo-placeholder', type: 'image', w: 640, h: 360,
      blipFill: { blip: { $_target: 'placeholder' } } }] : [];
  };
  const copyByRole = {
    cover: ['Presentation title', 'Subtitle'],
    text: ['Main idea', 'Supporting text', 'Takeaway'],
    cards: ['Key ideas', 'First idea', 'Second idea', 'Third idea'],
    points: ['Talking points', 'First point', 'Second point', 'Third point'],
    summary: ['Summary', 'First takeaway', 'Second takeaway', 'Third takeaway'],
    closing: ['Thank you'],
    photo: ['Photo and caption', 'Caption'],
    'photo-points': ['Photo and talking points', 'First talking point', 'Second talking point', 'Third talking point', 'Fourth talking point'],
    chart: ['Chart and summary', 'Summary'],
    flow: ['Process', 'First step', 'Second step', 'Third step'],
  };
  const slides = theme.variants.map((variant, index) => {
    const role = variant.role.slice(theme.slug.length + 1);
    const shapes = copyByRole[role].map((label, i) => text(label, i * 100, i === 0 ? 'title' : undefined));
    const content = readSlide({ shapes: [...shapes, ...getVisual(role)] }, () => false, dimensions);
    const [candidate] = fitLayouts(content, { ...dimensions, theme, genId, profile: 'standard',
      headingFont: theme.headingFont, bodyFont: theme.bodyFont, layoutIds: new Set([variant.role]),
      measureText: (value, points) => value.length * points * .75 });
    if (!candidate) throw new Error('Cannot fit sample content for ' + variant.role);
    const editableShapes = candidate.shapes.map(shape => {
      if (shape.id !== 'photo-placeholder') return shape;
      const { blipFill, ...geometry } = shape;
      return { ...geometry, type: 'text', $_otag: 'sp', noFill: true, name: 'Photo area',
        txBody: { bodyPr: { $_anchor: 'ctr' }, p: [{ pPr: { $_algn: 'ctr' }, r: [{ t: 'Photo' }] }] } };
    });
    return { id: 'slide' + (index + 1), name: variant.label, layoutid: 'template-layout', shapes: editableShapes };
  });
  const doc = {
    version: 1,
    file: { ...dimensions, id: theme.slug, name: theme.name, fonts: [...new Set([theme.headingFont, theme.bodyFont])]
      .map(family => ({ family, type: 'google' })) },
    slides,
    layouts: [{ ...sharedDesignLayout(dimensions.width, dimensions.height, genId, theme),
      id: 'template-layout', parentid: 'template-master', name: theme.name }],
    masters: [{ id: 'template-master', name: theme.name, shapes: [] }],
    assets: {},
  };
  writeFileSync(new URL(theme.slug + '.html', output),
    `<!doctype html><html lang="en"><meta charset="utf-8"><title>${escapeHTML(theme.name)}</title><p>Open this template in DESQ to edit its slides.</p><script id="${DATA_ID}" type="application/json">${scriptJSON(doc)}</script></html>\n`);
}
