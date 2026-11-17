import test from 'node:test';
import assert from 'node:assert/strict';
import geometry from '../editor-vuejs/src/lib/design/source-layout-geometry.json' with { type: 'json' };
import catalog from '../editor-vuejs/src/lib/design/template-catalog.json' with { type: 'json' };
import generated from '../editor-vuejs/src/lib/design/generated-template-catalog.json' with { type: 'json' };
import { sourceLayouts, sourcePointsLayouts, sourceSummaryLayouts, sourceClosingLayouts, withSourceLayouts } from '../editor-vuejs/src/lib/design/source-layouts.mjs';
import { distinctLayoutSuggestions } from '../editor-vuejs/src/lib/design/distinct-layouts.mjs';
import { fitLayouts, readSlide, splitBulletContent } from '../editor-vuejs/src/lib/design/reformat-layouts.mjs';
const dims = {width:1280,height:720};
const title = {id:'title',ph:{$_type:'title'},txBody:{p:[{r:[{t:'Our priorities'}]}]}};
const body = {id:'body',txBody:{p:['1. Listen to customers','2. Build a clear plan','3. Deliver better outcomes'].map(t=>({r:[{t}]}))}};
let id=0;
const options = {...dims,theme:generated[0],headingFont:'Arial',bodyFont:'Arial',profile:'standard',
  genId:()=>`shape-${++id}`,measureText:(s,n)=>s.length*n*.6};

test('source layouts accept missing secondary fields while retaining their title slot', () => {
  for (const layout of sourceLayouts) {
    if (layout.unavailableReason) continue;
    for (const count of [1, 2]) {
      const full = layout.slots(geometry.find(family => family.slug === layout.family)
        .layouts.find(record => record.index === layout.sourceIndex).slots.length);
      if (full.length < count) continue;
      const slots = layout.slots(count);
      assert.equal(slots.length, count, layout.id);
      assert.equal(slots[0].x, full[0].x, layout.id);
      assert.equal(slots[0].size, full[0].size, layout.id);
    }
  }
});

test('Editorial Forest preserves the cover title’s medium weight with a DrawingML fallback', () => {
  const theme = catalog.find(family => family.slug === 'editorial-forest');
  const content = readSlide({ shapes: [title] }, () => false, dims);
  const candidate = fitLayouts(content, { ...options, theme,
    layoutIds: new Set(['source/editorial-forest/1']) })[0];
  assert.ok(candidate);
  const run = candidate.shapes.find(shape => shape.id === title.id).txBody.p[0].r[0].rPr;
  assert.equal(run.desqFontWeight, 500);
  assert.equal(run.$_b, 0);
  assert.equal(run.solidFill.uniClr.$_val, 'E89CB1');
});

test('every detected point-column layout adapts to three, four and five points', () => {
  const dynamic = sourceLayouts.filter(layout => layout.columns);
  assert.ok(dynamic.some(layout => layout.id === 'source/editorial-forest/6'));
  assert.ok(dynamic.some(layout => layout.id === 'source/capsule/3'));
  for (const layout of dynamic) {
    for (const points of [3, 4, 5]) {
      const row = layout.columns(points + 1, true, { listCards: true });
      assert.ok(row, layout.id);
      assert.equal(row.slots.length, points + 1, layout.id);
      const slots = row.slots.slice(1);
      assert.ok(slots.every(slot => slot.w > 0 && slot.x >= 0 && slot.x + slot.w <= 1281), layout.id);
      assert.ok(slots.every((slot, index) => index === 0 ||
        slot.x >= slots[index - 1].x + slots[index - 1].w - 2), layout.id);
      assert.equal(row.markers.length, points + 1, layout.id);
    }
  }
});

test('every source family includes its measured layouts, bullet points and a closing', () => {
  assert.equal(geometry.length,34);
  assert.equal(sourceLayouts.length,351);
  assert.equal(new Set(sourceLayouts.map(l=>l.id)).size,351);
  const families=withSourceLayouts(catalog);
  for(const family of geometry){
    const variants=families.find(f=>f.slug===family.slug).variants;
    assert.equal(variants.length,family.layouts.length + 1 +
      sourceClosingLayouts.filter(layout => layout.family === family.slug).length +
      sourceSummaryLayouts.filter(layout => layout.family === family.slug).length,family.slug);
    assert.ok(variants.every(v=>v.role.startsWith(`source/${family.slug}/`)));
  }
  assert.equal(generated.flatMap(f=>f.variants).length,100);
  assert.equal(sourcePointsLayouts.length,34);
  assert.equal([...families,...generated].flatMap(f=>f.variants).length,493 + sourceClosingLayouts.length + sourceSummaryLayouts.length);
});

test('source layouts use measured source geometry instead of generic role boxes', () => {
  for(const family of geometry)for(const source of family.layouts){
    const layout=sourceLayouts.find(l=>l.family===family.slug&&l.sourceIndex===source.index);
    if(source.unavailableReason){assert.deepEqual(layout.slots(3),[]);continue;}
    const fitted = layout.slots(source.slots.length);
    assert.deepEqual(fitted.map(({x, w}) => ({x, w})), source.slots.map(({x, w}) => ({x, w})));
    if (layout.id !== 'source/capsule/3') assert.deepEqual(fitted.map(slot => slot.y), source.slots.map(slot => slot.y));
    for(const slot of source.slots){
      assert.ok([slot.x,slot.y,slot.w,slot.h,slot.size].every(Number.isFinite));
      assert.ok(slot.x>=-1&&slot.y>=-1&&slot.x+slot.w<=1281&&slot.y+slot.h<=721,layout.id);
    }
  }
});

test('three bullet points produce distinct suggestions from multiple original families', () => {
  const content=splitBulletContent(readSlide({shapes:[title,body]},()=>false,dims),options.genId);
  const candidates=fitLayouts(content,options).filter(c=>c.id.startsWith('source/'));
  assert.ok(candidates.length>=8,`only ${candidates.length} source layouts fit`);
  assert.ok(new Set(candidates.map(c=>c.id.split('/')[1])).size>=6);
  const entries=candidates.map(candidate=>({candidate,score:1}));
  const unique=distinctLayoutSuggestions(entries,dims);
  assert.ok(unique.length>=6);
  for(const {candidate} of unique){
    const recovered=readSlide({shapes:candidate.shapes},()=>false,dims);
    assert.ok(!recovered.reason,candidate.id);
    assert.equal(recovered.texts.length,4);
    assert.ok(recovered.body.includes('Listen to customers'));
  }
});

test('Editorial Forest agenda, framework and summary fit three substantive bullet points', () => {
  const theme = catalog.find(family => family.slug === 'editorial-forest');
  const questions = ['What terms should you know that are associated with an EKG?',
    'What are the purposes and routine uses of an EKG?',
    'What conditions can an EKG help diagnose, and why is it important to administer the test accurately?'];
  const body = { id: 'questions', txBody: { p: questions.map(t => ({
    pPr: { buChar: { $_char: '•' } }, r: [{ t }],
  })) } };
  const content = splitBulletContent(readSlide({ shapes: [title, body] }, () => false, dims), options.genId);
  const layoutIds = new Set([2, 6, 8].map(index => `source/editorial-forest/${index}`));
  const candidates = fitLayouts(content, { ...options, theme, layoutIds });
  assert.deepEqual(new Set(candidates.map(candidate => candidate.id)), layoutIds);
  for (const candidate of candidates) {
    const recovered = readSlide({ shapes: candidate.shapes }, () => false, dims);
    for (const question of questions) assert.ok(recovered.body.includes(question), candidate.id);
  }
});

test('Editorial Forest summary retains word numbering as the column count changes', () => {
  const theme = catalog.find(family => family.slug === 'editorial-forest');
  for (const count of [3, 4, 5]) {
    const body = { id: 'review-points', txBody: { p: Array.from({ length: count }, (_, i) => ({
      pPr: { buChar: { $_char: '•' } }, r: [{ t: 'Review point ' + (i + 1) }],
    })) } };
    const content = splitBulletContent(readSlide({ shapes: [title, body] }, () => false, dims), options.genId);
    const candidate = fitLayouts(content, { ...options, theme,
      layoutIds: new Set(['source/editorial-forest/8']) })[0];
    assert.ok(candidate);
    const labels = candidate.shapes.filter(shape => shape.name === 'Template list marker')
      .map(shape => shape.txBody.p[0].r[0].t);
    assert.deepEqual(labels.map(label => label.toLowerCase()), ['one', 'two', 'three', 'four', 'five'].slice(0, count));
    const rule = candidate.shapes.find(shape => shape.name === 'Design Ideas artwork: Template rule');
    assert.ok(rule, 'Summary top rule must be retained');
    assert.ok(rule.w > 1000 && rule.h < 2);
    assert.equal(rule.solidFill.uniClr.$_val, 'E89CB1');
    assert.ok(!candidate.shapes.some(shape =>
      shape.name === 'Design Ideas artwork: Source panel' && shape.noFill && !shape.ln?.noFill));
    const contentBoxes = candidate.shapes.filter(shape => shape.txBody &&
      !shape.name?.startsWith('Design Ideas artwork:') && shape.name !== 'Template list marker');
    assert.equal(contentBoxes.length, count + 1);
    assert.ok(contentBoxes.every(shape => shape.ln?.noFill));
  }
});

test('People’s Platform Roadmap retains its title shadow and keeps points below the track', () => {
  const theme = catalog.find(family => family.slug === 'peoples-platform');
  for (const count of [3, 4, 5]) {
    const body = { id: 'questions', txBody: { p: Array.from({ length: count }, (_, index) => ({
      pPr: { buChar: { $_char: '•' } },
      r: [{ t: ['What terms should you know that are associated with an EKG?',
        'What conditions can an EKG help diagnose, and why is it important to administer the test accurately?',
        'What are the purposes and routine uses of an EKG?'][index % 3] }],
    })) } };
    const content = splitBulletContent(readSlide({ shapes: [title, body] }, () => false, dims), options.genId);
    const candidate = fitLayouts(content, { ...options, theme,
      layoutIds: new Set(['source/peoples-platform/8']) })[0];
    assert.ok(candidate, String(count));
    const heading = candidate.shapes.find(shape => shape.id === title.id);
    const shadow = heading.txBody.p[0].r[0].rPr.effectLst?.outerShdw;
    assert.ok(shadow && shadow.$_dist > 0);
    assert.equal(shadow.uniClr.$_val, 'E83A2A');
    const dots = candidate.shapes.filter(shape => shape.name === 'Design Ideas artwork: Source panel' && shape.w < 80 && shape.h < 80);
    assert.equal(dots.length, count);
    const points = candidate.shapes.filter(shape => shape.txBody &&
      shape.id !== title.id && !shape.name?.startsWith('Design Ideas artwork:') && shape.name !== 'Template list marker');
    assert.equal(points.length, count);
    for (const point of points) assert.ok(point.y >= Math.max(...dots.map(dot => dot.y + dot.h)));
    assert.equal(candidate.shapes.filter(shape => shape.name === 'Design Ideas artwork: Source panel' &&
      shape.y >= 500 && shape.ln?.solidFill).length, 3, 'Retain the decorative KPI boxes for user editing');
  }
});

test('all adaptable source layouts retain layout elements while replacing and recovering content', () => {
  for (const layout of sourceLayouts.filter(layout => !layout.unavailableReason)) {
    let candidate;
    for (const count of [1, 4, 3, 2, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]) {
      const shapes = Array.from({ length: count }, (_, i) => ({
        id: 'replacement-' + i, ...(i ? {} : { ph: { $_type: 'title' } }),
        txBody: { p: [{ r: [{ t: i ? 'Replacement point ' + i : 'Replacement title' }] }] },
      }));
      if (layout.image) shapes.push({
        id: 'photo', type: 'image', w: 200, h: 100,
        blipFill: { blip: { $_target: 'replacement.png' } },
        ...(layout.visualKind === 'chart' ? { graphic: { graphicData: {} } } : {}),
      });
      const content = readSlide({ shapes }, () => false, dims);
      if (content.reason) continue;
      candidate = fitLayouts(content, { ...options, theme: layout.theme,
        layoutIds: new Set([layout.id]), slideNumber: 3, slideCount: 20 })[0];
      if (candidate) break;
    }
    assert.ok(candidate, layout.id);
    const labels = candidate.shapes.filter(shape => shape.name === 'Design Ideas artwork: Template label');
    for (const label of labels) assert.ok(label.txBody.p[0].r[0].t, layout.id);
    for (const shape of candidate.shapes) {
      assert.ok([shape.x, shape.y, shape.w, shape.h].every(Number.isFinite), layout.id);
    }
    const recovered = readSlide({ shapes: candidate.shapes }, () => false, dims);
    assert.equal(recovered.title, 'Replacement title', layout.id);
    assert.ok(recovered.texts.every(entry => entry.text.startsWith('Replacement')), layout.id);
    const counter = layout.artwork.find(art => art.pageCounter);
    if (counter) assert.ok(labels.some(shape => shape.txBody.p[0].r[0].t === '03 / 20'), layout.id);
  }
});

test('near-duplicate geometry collapses across family names, colors and IDs without truncating distinct results', () => {
  const entry=(id,x,fill='FFFFFF',topology='plain')=>({candidate:{id,topology,shapes:[
    {id:Math.random(),x,y:50,w:300,h:200,solidFill:{fill},txBody:{p:[]}},
  ]}});
  const original=entry('source/a/1',50);
  const shifted=entry('other-family',62,'000000');
  const opposite=entry('opposite-side',820);
  const diagram=entry('connected-nodes',50,'FFFFFF','connected');
  assert.deepEqual(distinctLayoutSuggestions([original,shifted,opposite,diagram],dims),[original,opposite,diagram]);
});

test('custom families have materially different arrangements within each original content type', () => {
  for(const role of ['cover','text','cards','photo','chart','flow']) {
    const picture={id:'visual',type:'image',w:800,h:600,blipFill:{blip:{$_target:'photo.png'}}};
    const chart={id:'visual',type:'chart',w:800,h:600,graphic:{graphicData:{'c:chart':{chartJson:{}}}}};
    const texts=role==='cards'||role==='flow'?[title,body]:[title,{...body,txBody:{p:[{r:[{t:'A clear explanation.'}]}]}}];
    let content=readSlide({shapes:[...texts,...(role==='photo'?[picture]:role==='chart'?[chart]:[])]},()=>false,dims);
    if(role==='cards'||role==='flow')content=splitBulletContent(content,options.genId);
    const entries=fitLayouts(content,options).filter(c=>generated.some(f=>c.id===`${f.slug}-${role}`)).map(candidate=>({candidate}));
    assert.equal(entries.length,10,role);
    assert.ok(distinctLayoutSuggestions(entries,dims).length>=9,role);
  }
});

test('four separate bullet textboxes without a title receive source layouts without promoting or losing a bullet', () => {
  for (const literal of [true, false]) {
    const labels=['Understand the customer needs','Agree on the project scope','Build and validate the solution','Measure results and improve'];
    const shapes=labels.map((label,index)=>({id:`bullet-${index}`,type:'text',x:80,y:100+index*120,w:1100,h:100,
      txBody:{p:[{...(literal?{}:{pPr:{buChar:{$_char:'•'}}}),r:[{t:literal?`• ${label}`:label}]}]}}));
    const original=readSlide({shapes},()=>false,dims);
    assert.equal(original.title,'');
    const content=splitBulletContent(original,options.genId);
    const entries=fitLayouts(content,options).filter(c=>c.id.startsWith('source/'));
    assert.ok(entries.length>=3,`Only ${entries.length} layouts for four bullets`);
    assert.ok(new Set(entries.map(c=>c.id.split('/')[1])).size>=3);
    for(const entry of entries){
      const restored=readSlide({shapes:entry.shapes},()=>false,dims);
      assert.ok(!restored.reason,entry.id);
      assert.equal(restored.title,'',entry.id);
      assert.deepEqual(restored.texts.map(t=>t.text).sort(),[...labels].sort(),entry.id);
      assert.ok(!sourceLayouts.find(l=>l.id===entry.id)?.isCover);
    }
  }
});

test('Pin & Paper transfers its safety pins as native paths and uses readable body text', () => {
  const texts = ['First idea', 'Second idea', 'Third idea', 'Fourth idea'].map((value, index) => ({
    id: `idea-${index}`, y: 100 * index, txBody: { p: [{ r: [{ t: value }] }] },
  }));
  const result = fitLayouts(readSlide({ shapes: [{ ...title, txBody: { p: [{ r: [{ t: 'Agenda' }] }] } }, ...texts] }, () => false, dims), {
      ...options,
      fontsForLayout: id => id.startsWith('source/pin-and-paper/')
        ? { headingFont: 'Caveat', bodyFont: 'Space Grotesk' }
        : undefined,
    })
    .find(candidate => candidate.id === 'source/pin-and-paper/2');
  assert.ok(result);
  assert.equal(result.shapes.find(shape => shape.id === 'title').txBody.p[0].r[0].rPr.latin.$_typeface, 'Caveat');
  assert.equal(result.shapes.find(shape => shape.id === 'idea-0').txBody.p[0].r[0].rPr.latin.$_typeface, 'Space Grotesk');
  const pins = result.shapes.filter(shape => shape.name === 'Design Ideas artwork: Safety pin');
  assert.equal(pins.length, 4);
  assert.ok(pins.every(pin => pin.d.startsWith('M') && !pin.prstGeom && pin.ln.solidFill));
  assert.ok(result.shapes.filter(shape => shape.id.startsWith('idea-')).every(shape =>
    shape.txBody.p[0].r[0].rPr.$_sz >= 1800));
  assert.equal(readSlide({ shapes: result.shapes }, () => false, dims).texts.length, 5);
});

test('Principles carries its paper palette, type hierarchy and left-to-right order across themes', () => {
  const makeText = (id, text, y) => ({ id, y, txBody: { p: [{ r: [{ t: text }] }] } });
  const subtitle = makeText('subtitle', 'What students should know before practice.', 130);
  const items = ['EKG terms', 'Routine uses', 'Accurate administration'].map((text, index) =>
    makeText('item-' + index, text, 300 + index * 100));
  const input = readSlide({ shapes: [title, subtitle, ...items] }, () => false, dims);
  const candidate = fitLayouts(input, options).find(candidate => candidate.id === 'source/pin-and-paper/3');
  assert.ok(candidate);
  assert.equal(candidate.theme.background.toUpperCase(), '#EFE56A');
  const panels = candidate.shapes.filter(shape => shape.name === 'Design Ideas artwork: Source panel');
  assert.deepEqual(panels.map(shape => shape.solidFill.uniClr.$_val), ['F8F1D6', 'F5ECA0', 'FBE6A4']);
  const [headline, lede, ...cards] = [title, subtitle, ...items].map(original =>
    candidate.shapes.find(shape => shape.id === original.id));
  const style = shape => shape.txBody.p[0].r[0].rPr;
  assert.deepEqual([headline, lede, ...cards].map(shape => style(shape).$_sz), [4200, 1500, 1800, 1800, 1800]);
  assert.equal(style(headline).latin.$_typeface, 'Space Grotesk');
  assert.equal(style(headline).solidFill.uniClr.$_val, '1F3A8A');
  assert.ok(lede.h >= 2 * 15 * 1.65);
  const standard = fitLayouts(input, { ...options, width: 960 }).find(candidate => candidate.id === 'source/pin-and-paper/3');
  assert.equal(style(standard.shapes.find(shape => shape.id === 'title')).$_sz, 3150);
  assert.equal(style(standard.shapes.find(shape => shape.id === 'item-0')).$_sz, 1350);
  assert.ok(cards.every((card, index) => card.txBody.bodyPr.$_anchor === 't' &&
    (index === 0 || card.x > cards[index - 1].x)));
});

test('a previously formatted EKG slide recovers its heading above numbered cards', () => {
  const heading = { id: 'ekg-heading', name: 'Rectangle 2', y: 155,
    txBody: { p: [{ r: [{ t: 'Anticipated Problems', rPr: { $_sz: 1400 } }] }] } };
  const cards = [
    'What terms should you know that are associated with an EKG?',
    'What are the purposes and routine uses of an EKG?',
    'What conditions can an EKG help diagnose, and why is it important to administer the test accurately?',
  ].map((t, index) => ({ id: 'ekg-card-' + index, y: 420, x: 80 + index * 400,
    reformatListNumber: index + 1, txBody: { p: [{ r: [{ t, rPr: { $_sz: 1500 } }] }] } }));
  const content = readSlide({ shapes: [heading, ...cards] }, () => false, dims);
  const candidates = fitLayouts(splitBulletContent(content, options.genId), options);
  const principles = candidates.find(candidate => candidate.id === 'source/pin-and-paper/3');
  assert.ok(principles);
  const formatted = principles.shapes.find(shape => shape.id === heading.id);
  assert.equal(formatted.txBody.p[0].r[0].rPr.$_sz, 4200);
  assert.equal(formatted.name, 'Rectangle 2');
  for (const candidate of candidates.filter(candidate => candidate.id.startsWith('source/'))) {
    assert.ok(candidate.shapes.find(shape => shape.id === heading.id).txBody.p[0].r[0].rPr.$_sz >= 3600);
  }
});

test('classified headings and numbered bullets survive reopening without placeholders or display formatting', () => {
  const shape = (id, text, y) => ({ id, name: 'Rectangle', y, txBody: { p: [{ r: [{ t: text }] }] } });
  const slide = { shapes: [
    shape('heading', 'Anticipated Problems', 120),
    { ...shape('questions', '7. What does an EKG measure?', 280),
      txBody: { p: ['7. What does an EKG measure?', '8. When is it used?', '9. How do you administer it?']
        .map(t => ({ r: [{ t }] })) } },
  ] };
  const content = splitBulletContent(readSlide(slide, () => false, dims), options.genId);
  const applied = fitLayouts(content, options).find(candidate => candidate.id === 'source/pin-and-paper/3');
  assert.ok(applied);
  const reopened = applied.shapes.map(({ reformatListNumber, ...shape }) => {
    if (!shape.cNvPrExtLst) return shape;
    // Simulate edited text and geometry with only the slide's durable semantic metadata.
    const p = shape.txBody.p.map(({ r }) => ({ r: r.map(({ t }) => ({ t })) }));
    return { ...shape, name: 'Rectangle', y: 420, txBody: { p } };
  });
  const restored = readSlide({ shapes: reopened }, () => false, dims);
  assert.equal(restored.title, 'Anticipated Problems');
  assert.deepEqual(restored.texts.slice(1).map(entry => entry.marker), [7, 8, 9]);
  assert.equal(restored.texts[0].shape.ph, undefined);
  const next = fitLayouts(splitBulletContent(restored, options.genId), options)
    .find(candidate => candidate.id === 'source/pin-and-paper/3');
  assert.ok(next);
  assert.equal(next.shapes.find(shape => shape.id === 'heading').txBody.p[0].r[0].rPr.$_sz, 4200);
});

test('Capsule search uses the family’s layouts and places Three Pillars numerals inside round badges', () => {
  const input = splitBulletContent(readSlide({ shapes: [title, body] }, () => false, dims), options.genId);
  const capsule = withSourceLayouts(catalog).find(family => family.slug === 'capsule');
  const layoutIds = new Set(capsule.variants.map(variant => variant.role));
  const candidates = fitLayouts(input, { ...options, width: 960, layoutIds });
  assert.ok(candidates.every(candidate => layoutIds.has(candidate.id)));
  const pillars = candidates.find(candidate => candidate.id === 'source/capsule/3');
  assert.ok(pillars);
  const badges = pillars.shapes.filter(shape => shape.prstGeom?.$_prst === 'ellipse');
  const numerals = pillars.shapes.filter(shape => shape.name === 'Template list marker');
  assert.equal(badges.length, 3);
  assert.deepEqual(numerals.map(shape => shape.txBody.p[0].r[0].t), ['I', 'II', 'III']);
  for (const [index, badge] of badges.entries()) {
    assert.equal(badge.w, badge.h);
    assert.deepEqual(['x', 'y', 'w', 'h'].map(key => numerals[index][key]), ['x', 'y', 'w', 'h'].map(key => badge[key]));
    const cardText = pillars.shapes.find(shape => shape.reformatListNumber === index + 1);
    assert.ok(cardText.y > badge.y + badge.h);
    assert.equal(cardText.txBody.bodyPr.$_anchor, 't');
  }
  assert.equal(pillars.shapes.filter(shape => shape.effectLst?.outerShdw).length, 3);
  const withSubtitle = { ...input, texts: [input.texts[0], {
    shape: { id: 'subtitle' }, paragraphs: [{ r: [{ t: 'Vocabulary' }] }], text: 'Vocabulary', role: 'body',
  }, ...input.texts.slice(1)] };
  const subtitleLayout = fitLayouts(withSubtitle, { ...options, layoutIds })
    .find(candidate => candidate.id === pillars.id);
  assert.ok(subtitleLayout);
  assert.equal(subtitleLayout.shapes.filter(shape => shape.name === 'Design Ideas artwork: Source panel').length, 7);
});

test('BlockFrame flexible layouts use separate outlined color panels and transparent text', () => {
  const theme = catalog.find(family => family.slug === 'block-frame');
  const input = splitBulletContent(readSlide({ shapes: [title, body] }, () => false, dims), options.genId);
  const candidate = fitLayouts(input, { ...options, theme, flexible: true, layoutIds: new Set(['cards']) })[0];
  assert.ok(candidate);
  const panels = candidate.shapes.filter(shape => shape.name === 'Design Ideas artwork: Flexible panel');
  assert.deepEqual(panels.map(shape => shape.solidFill.uniClr.$_val), ['FE90E8', 'C0F7FE', '99E885']);
  assert.ok(panels.every(shape => shape.ln.solidFill.uniClr.$_val === '000000' && shape.effectLst.outerShdw));
  assert.ok(candidate.shapes.filter(shape => shape.txBody).every(shape => shape.noFill && !shape.solidFill));
});

test('Editorial Tri-Tone defaults to cover pink and retains each source layout’s background', () => {
  const theme = catalog.find(family => family.slug === 'editorial-tri-tone');
  assert.equal(theme.background, '#F2B6C6');
  const family = geometry.find(entry => entry.slug === theme.slug);
  for (const [index, color] of [[3, '#F2B6C6'], [4, '#7A1F35'], [7, '#F2D86A']]) {
    const source = family.layouts.find(layout => layout.index === index);
    const shapes = source.slots.map((slot, position) => ({
      id: 'text-' + position, x: slot.x, y: slot.y,
      ...(position === 0 ? { ph: { $_type: 'title' } } : {}),
      txBody: { p: [{ r: [{ t: 'A' }] }] },
    }));
    const model = readSlide({ shapes }, () => false, dims);
    const [candidate] = fitLayouts(model, {
      ...options, theme, layoutIds: new Set([`source/editorial-tri-tone/${index}`]),
    });
    assert.ok(candidate, source.label);
    assert.equal(candidate.theme.background.toUpperCase(), color);
  }
});

test('plain cards keep list order without adding visible markers', () => {
  const theme = catalog.find(family => family.slug === 'editorial-tri-tone');
  const items = ['4. Prepare the room', '5. Record the tracing', '6. Review the result'];
  const listBox = { ...body, txBody: { p: items.map(t => ({ r: [{ t }] })) } };
  const content = splitBulletContent(readSlide({ shapes: [title, listBox] }, () => false, dims), options.genId);
  const [candidate] = fitLayouts(content, { ...options, theme, layoutIds: new Set(['cards']) });
  assert.ok(candidate);
  assert.ok(!candidate.shapes.some(shape => shape.name === 'Template list marker'));
  const cards = candidate.shapes.filter(shape => shape.reformatListNumber != null);
  assert.deepEqual(cards.map(shape => shape.reformatListNumber), [4, 5, 6]);
  assert.deepEqual(cards.map(shape => shape.txBody.p[0].r[0].t),
    ['Prepare the room', 'Record the tracing', 'Review the result']);
});

test('a numbered list that stays in one textbox retains inherited numbering', () => {
  const numbered = { $_type: 'arabicPeriod', $_startAt: 7 };
  const listBox = { ...body, txBody: { p: [
    { r: [{ t: 'Check the result' }] },
    { pPr: { $_lvl: 1 }, r: [{ t: 'Compare the first reading' }] },
    { pPr: { $_lvl: 1 }, r: [{ t: 'Compare the second reading' }] },
  ] } };
  const content = readSlide({ shapes: [title, listBox] }, () => false, dims);
  content.texts[1].inheritedListStyle = {
    lvl1pPr: { buAutoNum: numbered },
    lvl2pPr: { buAutoNum: { $_type: 'alphaLcParenR' } },
  };

  assert.equal(splitBulletContent(content, options.genId), null);
  const [candidate] = fitLayouts(content, { ...options, layoutIds: new Set(['editorial']) });
  const paragraphs = candidate.shapes.find(shape => shape.id === listBox.id).txBody.p;
  assert.deepEqual(paragraphs.map(paragraph => paragraph.pPr.buAutoNum), [
    numbered, { $_type: 'alphaLcParenR' }, { $_type: 'alphaLcParenR' },
  ]);
});

test('Stencil & Tablet Principles fits three to five numbered columns across the original row', () => {
  const layoutId = 'source/stencil-tablet/3';
  const colors = ['A06A3C', 'C73B7A', 'EE7A2E', '2D7E73', '3F73B7'];
  const points = ['Define the problem', 'Review the evidence', 'Explain the choices', 'Plan the work', 'Share the result'];
  for (const count of [3, 4, 5]) {
    const listBox = { ...body, txBody: { p: points.slice(0, count).map(t => ({ r: [{ t: '• ' + t }] })) } };
    const content = splitBulletContent(readSlide({ shapes: [title, listBox] }, () => false, dims), options.genId);
    const [candidate] = fitLayouts(content, { ...options, layoutIds: new Set([layoutId]) });
    assert.ok(candidate?.styledList, `No preferred match for ${count} points`);
    const panels = candidate.shapes.filter(shape => shape.name === 'Design Ideas artwork: Source panel');
    const markers = candidate.shapes.filter(shape => shape.name === 'Template list marker');
    const cards = candidate.shapes.filter(shape => shape.reformatListNumber != null);

    assert.deepEqual(panels.map(shape => shape.solidFill.uniClr.$_val), colors.slice(0, count));
    assert.deepEqual(cards.map(shape => shape.txBody.p[0].r[0].t), points.slice(0, count));
    assert.deepEqual(markers.map(shape => shape.txBody.p[0].r[0].t), points.slice(0, count).map((_, index) => String(index + 1)));
    assert.ok(markers.every(shape => shape.txBody.p[0].r[0].rPr.latin.$_typeface === 'Stardos Stencil'));
    assert.ok(panels.every((panel, index) => index === 0 || panels[index - 1].x + panels[index - 1].w < panel.x));
    assert.ok(Math.abs(panels[0].x - 42.7) < .1);
    assert.ok(Math.abs(panels.at(-1).x + panels.at(-1).w - 1237.4) < .1);
  }
});

test('Stencil & Tablet cover fits with just a title or a title and lesson label', () => {
  const coverTitle = { ...title, txBody: { p: [{ r: [{ t: 'Importance of an EKG' }] }] } };
  const label = { id: 'lesson-label', txBody: { p: [{ r: [{ t: 'Lesson Plan: MA C3-2' }] }] } };
  for (const shapes of [[coverTitle], [coverTitle, label]]) {
    const content = readSlide({ shapes }, () => false, dims);
    const [cover] = fitLayouts(content, { ...options, layoutIds: new Set(['source/stencil-tablet/1']) });
    assert.ok(cover);
    assert.equal(cover.shapes.find(shape => shape.id === title.id).txBody.p[0].r[0].rPr.latin.$_typeface,
      'Stardos Stencil');
    assert.equal(cover.shapes.filter(shape => shape.txBody).length, shapes.length);
  }
});
