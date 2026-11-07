import { normalizeHtmlFractionContainers } from '../agent/html-fractions.mjs';
import { inheritSharedSlideBackground, sharedSlideBackground } from '../agent/slide-background.mjs';
import { parseFrontendSlides } from 'shared-vuejs/api/html-import-frontend-slides-import';
import { renderScriptedFrontendSlides } from 'shared-vuejs/api/html-import-scripted-html-render';
import { blankDocument } from 'shared-vuejs/api/document-model';
import { genId } from 'shared-vuejs/api/utility';
import { prepareHtmlFormFields } from '../agent/html-form-fields.mjs';
import { compileDeck } from '../agent/deck-compiler.mjs';
import { loadGeneratedGoogleFonts, renderedHtmlFontFamilies } from '../agent/generated-fonts.mjs';
import { prepareEmbeddedHtmlImages, embeddedHtmlAssets } from '../agent/html-embedded-images.mjs';
import { canvasTextMeasurer } from '../agent/deck-text.mjs';
import { resolveHtmlSlideLinks } from '../agent/html-slide-links.mjs';
import {resolveImportedScriptProject} from '../agent/html-script-project.mjs';

export async function agentHtmlDocument(source, name) {
  const {source: prepared, fields} = prepareHtmlFormFields(normalizeHtmlFractionContainers(source).trim()
    .replace(/^```(?:html)?\s*/i, '').replace(/\s*```$/, ''));
  const embedded = await prepareEmbeddedHtmlImages(prepared);
  source = embedded.source;
  const parsed = parseFrontendSlides(source);
  // Chrome can round each slide's settling timer up to one second in the hidden iframe.
  const timeout = 15000 + (parsed.slides.length - 1) * 1000;
  const deck = await renderScriptedFrontendSlides(source, parsed, { timeout });
  const { googleFonts } = await import('shared-vuejs/api/googleFonts');
  const catalog = new Map(googleFonts.map(font => [font[0].toLowerCase(), font[0]]));
  const families = renderedHtmlFontFamilies(deck).map(family => catalog.get(family.toLowerCase())).filter(Boolean);
  await loadGeneratedGoogleFonts([...new Set(families)]);
  await document.fonts?.ready;
  const context = document.createElement('canvas').getContext('2d');
  const width = deck.width || parsed.width || 1280, height = deck.height || parsed.height || 720;
  const compiled = compileDeck(deck, { width, height, genId, allowTextOverflow: true, htmlFormFields: fields,
    geometry: (preset, w, h) => ({ d: `R0,0,${w},${h}` }), assets: embeddedHtmlAssets(deck, embedded.images),
    ...(context ? { measureText: canvasTextMeasurer(context) } : {}) });
  const doc = blankDocument();
  doc.assets = Object.fromEntries([...embedded.images].map(([name,asset]) => [name,{data:asset.data,w:asset.w,h:asset.h}]));
  doc.file.name = (name || deck.title).replace(/\.html?$/i, '');
  doc.file.width = width;
  doc.file.height = height;
  doc.slides = compiled.pages.map(page => ({ ...page, id: genId(), fileId: doc.file.id }));
  resolveHtmlSlideLinks(doc.slides, doc.slides.map(slide => slide.id));
  if(deck.scripting)doc.file.scripting=resolveImportedScriptProject(deck.scripting,doc.slides,doc.slides.map(slide=>slide.id));
  const background = sharedSlideBackground(doc.slides, deck.slides);
  if (deck.sharedLayouts?.length || background) {
    const shared = deck.sharedLayouts?.length
      ? compileDeck({ ...deck, slides: deck.sharedLayouts }, { width,height,genId,allowTextOverflow:true,
        geometry:(preset,w,h)=>({d:`R0,0,${w},${h}`}), assets:embeddedHtmlAssets({slides:deck.sharedLayouts},embedded.images), ...(context ? {measureText:canvasTextMeasurer(context)} : {}) }).pages[0]
      : { shapes: [] };
    const layout = { ...shared, bg: shared.bg ?? background, id:genId(), fileId:doc.file.id, name:'Shared HTML layout', sharedHtmlLayout:true };
    doc.layouts = [layout];
    inheritSharedSlideBackground(doc.slides, deck.slides, layout, { width, height, genId }, deck.sharedLayouts?.[0]);
    for (const slide of doc.slides) { slide.layoutid = layout.id; slide.showMaster = 1; }
  }
  const weights = new Map(families.map(family => [family.toLowerCase(), new Set()]));
  const collect = shapes => {
    for (const shape of shapes) {
      for (const paragraph of shape.txBody?.p || []) for (const {rPr} of paragraph.r || []) {
        const weight = rPr?.desqFontWeight;
        if (weight) weights.get(rPr.latin?.$_typeface?.toLowerCase())?.add(weight);
      }
      if (shape.children) collect(shape.children);
    }
  };
  for (const page of [...doc.slides, ...(doc.layouts || [])]) collect(page.shapes);
  doc.file.fonts = [...new Set(families)].map(family => {
    const variants = [...weights.get(family.toLowerCase())].sort((a, b) => a - b);
    return {family, type: 'google', ...(variants.length ? {weights: variants} : {})};
  });
  doc.file.slides = doc.slides.map(({ id, name, transition, layoutid, showMaster }) => ({ id, name, transition, layoutid, showMaster }));
  return doc;
}
