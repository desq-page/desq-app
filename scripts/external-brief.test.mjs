import test from 'node:test';
import assert from 'node:assert/strict';
import { parseExternalBrief, parseExternalBriefResult } from '../editor-vuejs/src/lib/agent/external-brief.mjs';
import { preflightDeckPlan } from '../editor-vuejs/src/lib/agent/deck-preflight.mjs';

const brief = () => ({ version: '1.0', title: 'Solar for business', audience: 'Leaders', objective: 'Assess solar', design: {palette:'forest'}, slides: [
  {title:'Solar potential',purpose:'Introduce the topic',layout:'content',body:'Daytime demand matters.',bullets:['Check the roof','Assess demand']},
  {title:'Compare options',purpose:'Compare alternatives',layout:'comparison',items:[{title:'Own',body:'Finance installation.'},{title:'Lease',body:'Consider contract terms.'}]},
] });
test('external brief preserves content and passes the real native layout preflight', () => {
  const data = brief();
  const deck = parseExternalBrief('```json\n' + JSON.stringify(data) + '\n```');
  assert.deepEqual(deck.slides, data.slides);
  const proof = preflightDeckPlan({calls:[{name:'desq_create_deck',arguments:{...deck,fileId:'file',pageId:'page'}}]}, {document:{width:1280,height:720}});
  assert.equal(proof.compiled.pages.length, 2);
});
test('external brief rejects unsupported versions and layout content that would be lost', () => {
  const data = brief();
  data.version='2.0'; assert.throws(() => parseExternalBrief(JSON.stringify(data)), /Invalid version/);
  data.version='1.0'; data.slides[1].body='Lost'; assert.throws(() => parseExternalBrief(JSON.stringify(data)), /Slide 2/);
  delete data.slides[1].body; data.slides[1].items[0].value='10'; assert.throws(() => parseExternalBrief(JSON.stringify(data)), /Only metrics/);
  assert.throws(() => parseExternalBrief('{'), /JSON repair produced an invalid brief/);
});
test('illustration suggestions become keyword searches with the original description retained', () => {
  const data = brief();
  data.slides[0].illustration = 'Rooftop solar panels on a commercial building';
  const deck = parseExternalBrief(JSON.stringify(data));
  assert.deepEqual(deck.slides[0].images, [{query:'Rooftop solar panels commercial building', alt:data.slides[0].illustration}]);
  assert.equal(deck.slides[0].illustration, undefined);
  preflightDeckPlan({calls:[{name:'desq_create_deck',arguments:{...deck,fileId:'file',pageId:'page'}}]}, {document:{width:1280,height:720}});
  data.slides[1].illustration = 'Solar panels';
  assert.throws(() => parseExternalBrief(JSON.stringify(data)), /Slide 2/);
  delete data.slides[1].illustration;
  data.slides[0].images = [{query:'solar panels',alt:'Solar panels'}];
  assert.throws(() => parseExternalBrief(JSON.stringify(data)), /either illustration or images/);
});
test('freeform SVG slides retain editable content and pass native preflight', () => {
  const data = brief();
  data.slides[0] = {title:'Solar potential',purpose:'Introduce solar',layout:'svg',svg:'<svg viewBox="0 0 1280 720"><rect x="0" y="0" width="1280" height="720" fill="#FFFFFF"/><text x="60" y="100" font-size="42" fill="#000000">Solar potential</text><image x="60" y="180" width="400" height="300" data-query="rooftop solar panels" aria-label="Rooftop solar panels"/></svg>'};
  const deck = parseExternalBrief(JSON.stringify(data));
  assert.equal(deck.slides[0].svg, data.slides[0].svg);
  const proof = preflightDeckPlan({calls:[{name:'desq_create_deck',arguments:{...deck,fileId:'file',pageId:'page'}}]}, {document:{width:1280,height:720}});
  assert.equal(proof.compiled.pages.length, 2);
  assert.ok(proof.compiled.pages[0].shapes.some(shape => shape.txBody));
  data.slides[0].body = 'This would be ignored';
  assert.throws(() => parseExternalBrief(JSON.stringify(data)), /all visible content/);
  delete data.slides[0].body;
  data.slides[0].svg = '<svg viewBox="0 0 10 10"></svg>';
  const invalid = parseExternalBrief(JSON.stringify(data));
  assert.throws(() => preflightDeckPlan({calls:[{name:'desq_create_deck',arguments:{...invalid,fileId:'file',pageId:'page'}}]}, {document:{width:1280,height:720}}), /viewBox/);
});

test('minor JSON errors are repaired transparently without bypassing schema and SVG preflight', () => {
  const original = JSON.stringify(brief());
  const withTrailingComma = original.replace(/}$/, ',}');
  const repaired = parseExternalBriefResult(withTrailingComma);
  assert.equal(repaired.repaired, true);
  assert.deepEqual(repaired.deck.slides, brief().slides);
  assert.deepEqual(JSON.parse(repaired.repairedJson).slides, brief().slides);
  assert.equal(parseExternalBriefResult(original).repaired, false);
  const bad = brief();
  bad.slides[0] = { title:'Broken', purpose:'Test', layout:'svg', svg:'<svg viewBox="0 0 1280 720"><text>Unclosed</svg>' };
  const brokenSvg = JSON.stringify(bad).replace(/}$/, ',}');
  const deck = parseExternalBriefResult(brokenSvg).deck;
  assert.throws(() => preflightDeckPlan({calls:[{name:'desq_create_deck',arguments:{...deck,fileId:'file',pageId:'page'}}]}, {document:{width:1280,height:720}}), /Malformed page SVG/);
  assert.throws(() => parseExternalBriefResult('{"version":"1.0","slides":[],}'), /invalid brief/);
});

test('repairs copied Markdown escaping without altering valid JSON or SVG content', () => {
  const data = brief();
  data.slides[0] = {title:'History',purpose:'Introduce writing',layout:'svg',svg:'<svg viewBox="0 0 1280 720"><text x="60" y="90">Writing &amp; culture</text></svg>'};
  const valid = JSON.stringify(data, null, 2);
  const copied = valid.replace(/\\"/g, '\\\\"').replace(/</g, '\\<').replace(/\n/g, '\\\n&#x20;');
  const result = parseExternalBriefResult(copied);
  assert.equal(result.repaired, true);
  assert.deepEqual(JSON.parse(result.repairedJson), data);
  assert.deepEqual(result.deck.slides, data.slides);
  assert.equal(parseExternalBriefResult(valid).repaired, false);
  const proof = preflightDeckPlan({calls:[{name:'desq_create_deck',arguments:{...result.deck,fileId:'file',pageId:'page'}}]}, {document:{width:1280,height:720}});
  assert.equal(proof.compiled.pages.length, 2);
});

test('structured HTML briefs retain markup and reject fields the converter would ignore', () => {
  const data = brief();
  data.slides[0] = {title:'Solar',purpose:'Explain solar',layout:'html',html:'<section style="position:relative;width:1280px;height:720px"><div>Solar energy</div></section>'};
  const deck = parseExternalBrief(JSON.stringify(data));
  assert.equal(deck.slides[0].html, data.slides[0].html);
  data.slides[0].body = 'Ignored';
  assert.throws(() => parseExternalBrief(JSON.stringify(data)), /all visible content/);
  delete data.slides[0].body; delete data.slides[0].html;
  assert.throws(() => parseExternalBrief(JSON.stringify(data)), /requires a complete html/);
});
