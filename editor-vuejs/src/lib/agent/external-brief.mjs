import { parseFrontendSlides } from './frontend-slides-import.mjs';
import schema from './external-brief/schema-v1.json' with { type: 'json' };
import { jsonrepair } from 'jsonrepair';
import { validateArguments } from './editor-tools.mjs';
import { compactImageQuery } from './image-keywords.mjs';

const limits = { comparison: [2, 2], 'three-column': [3, 3], metrics: [2, 4], timeline: [2, 5], process: [2, 5], agenda: [2, 6] };
export function parseExternalBriefResult(input) {
  if (typeof input !== 'string' || input.length > 1700000) throw Error('The brief must be JSON under 1,700,000 characters.');
  if (/^(?:```(?:html)?\s*)?(?:<!doctype\s+html|<html\b)/i.test(input.trim())) return { deck: parseFrontendSlides(input), repaired: false, repairedJson: undefined };
  const clean = input.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let data, repaired = false, repairedJson;
  try { data = JSON.parse(clean); }
  catch {
    // Some chat UIs copy rendered Markdown with escaped physical line breaks,
    // encoded indentation and an extra level of escaping around SVG markup.
    // Only attempt this transform when that distinctive combination is present.
    if (/\\\r?\n&#x20;/.test(clean)) {
      const normalized = clean.replace(/\\\r?\n/g, '\n')
        .replace(/^&#x20;/gm, ' ')
        .replace(/\\\\"/g, '\\"')
        .replace(/\\([<:.])/g, '$1');
      try { data = JSON.parse(normalized); repairedJson = normalized; repaired = true; }
      catch { /* Fall through to the general-purpose repair. */ }
    }
    if (!repaired) {
      try {
        repairedJson = jsonrepair(clean);
        data = JSON.parse(repairedJson);
        repaired = true;
      } catch { throw Error('Invalid JSON. Automatic repair failed; ask the model for the complete JSON again.'); }
    }
  }
  try { validateArguments(schema, data); }
  catch (error) {
    if (repaired) throw Error(`JSON repair produced an invalid brief: ${error.message} Ask the model to regenerate the complete JSON.`);
    throw error;
  }
  for (const [i, slide] of data.slides.entries()) {
    const fail = message => { throw Error(`Slide ${i + 1}: ${message}`); };
    const fields = Object.keys(slide);
    if (slide.layout === 'svg' || slide.layout === 'html') {
      const format = slide.layout;
      if (!slide[format]?.trim()) fail(`${format.toUpperCase()} layout requires a complete ${format}.`);
      if (fields.some(k => ['subtitle', 'body', 'bullets', 'items', 'images', 'illustration', format === 'svg' ? 'html' : 'svg'].includes(k))) fail(`${format.toUpperCase()} layout must put all visible content and images inside ${format}, not in separate fields.`);
    } else if (slide.svg !== undefined || slide.html !== undefined) fail('The svg and html fields require their matching layouts.');
    else if (limits[slide.layout]) {
      if (fields.some(k => ['body', 'bullets', 'images', 'illustration'].includes(k))) fail(`${slide.layout} uses items, not body, bullets or illustrations.`);
      const [min, max] = limits[slide.layout];
      if (!slide.items || slide.items.length < min || slide.items.length > max) fail(`${slide.layout} requires ${min === max ? min : `${min}–${max}`} items.`);
      if (slide.items.some(item => slide.layout === 'metrics' ? !item.value?.trim() : item.value !== undefined)) fail(slide.layout === 'metrics' ? 'Each metric needs a value.' : 'Only metrics may use item values.');
    } else {
      if (slide.items) fail(`${slide.layout} cannot use items.`);
      if (slide.layout === 'content') {
        if (!slide.body?.trim() && !slide.bullets?.length) fail('Content needs body or bullets.');
      } else if (slide.body || slide.bullets) fail(`${slide.layout} uses subtitle, not body or bullets.`);
    }
    if (slide.illustration !== undefined) {
      if (slide.images) fail('Use either illustration or images, not both.');
      const query = compactImageQuery(slide.illustration);
      if (!query) fail('The illustration needs a searchable subject.');
      slide.images = [{ query, alt: slide.illustration }];
      delete slide.illustration;
    }
    const strings = [slide.title, slide.purpose, slide.subtitle, slide.body, ...(slide.bullets || []), ...(slide.items || []).flatMap(item => Object.values(item)), ...(slide.images || []).flatMap(image => Object.values(image))];
    if (strings.some(value => typeof value === 'string' && !value.trim())) fail('Text fields cannot be blank.');
  }
  const { version, ...deck } = data;
  return { deck, repaired, repairedJson };
}

export function parseExternalBrief(input) {
  return parseExternalBriefResult(input).deck;
}
