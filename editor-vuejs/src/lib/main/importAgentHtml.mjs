import { parseFrontendSlides } from 'shared-vuejs/api/html-import-frontend-slides-import';
import { renderScriptedFrontendSlides } from 'shared-vuejs/api/html-import-scripted-html-render';
import { blankDocument } from 'shared-vuejs/api/document-model';
import { genId } from 'shared-vuejs/api/utility';
import { compileDeck } from '../agent/deck-compiler.mjs';
import { loadGeneratedGoogleFonts, renderedHtmlFontFamilies } from '../agent/generated-fonts.mjs';
import { prepareEmbeddedHtmlImages, embeddedHtmlAssets } from '../agent/html-embedded-images.mjs';
import { canvasTextMeasurer } from '../agent/deck-text.mjs';
import { resolveHtmlSlideLinks } from '../agent/html-slide-links.mjs';

export async function agentHtmlDocument(source, name) {
  const embedded = await prepareEmbeddedHtmlImages(source);
  source = embedded.source;
  const deck = await renderScriptedFrontendSlides(source, parseFrontendSlides(source));
  const { googleFonts } = await import('shared-vuejs/api/googleFonts');
  const catalog = new Map(googleFonts.map(font => [font[0].toLowerCase(), font[0]]));
  const families = renderedHtmlFontFamilies(deck).map(family => catalog.get(family.toLowerCase())).filter(Boolean);
  await loadGeneratedGoogleFonts([...new Set(families)]);
  await document.fonts?.ready;
  const context = document.createElement('canvas').getContext('2d');
  const compiled = compileDeck(deck, { width: 1280, height: 720, genId, allowTextOverflow: true,
    geometry: (preset, w, h) => ({ d: `R0,0,${w},${h}` }), assets: embeddedHtmlAssets(deck, embedded.images),
    ...(context ? { measureText: canvasTextMeasurer(context) } : {}) });
  const doc = blankDocument();
  doc.assets = Object.fromEntries([...embedded.images].map(([name,asset]) => [name,{data:asset.data,w:asset.w,h:asset.h}]));
  doc.file.fonts = [...new Set(families)].map(family => ({ family, type: 'google' }));
  doc.file.name = (name || deck.title).replace(/\.html?$/i, '');
  doc.slides = compiled.pages.map(page => ({ ...page, id: genId(), fileId: doc.file.id }));
  resolveHtmlSlideLinks(doc.slides, doc.slides.map(slide => slide.id));
  if (deck.sharedLayouts?.length) {
    const shared = compileDeck({ ...deck, slides: deck.sharedLayouts }, { width:1280,height:720,genId,allowTextOverflow:true,
      geometry:(preset,w,h)=>({d:`R0,0,${w},${h}`}), assets:embeddedHtmlAssets({slides:deck.sharedLayouts},embedded.images), ...(context ? {measureText:canvasTextMeasurer(context)} : {}) });
    doc.layouts = shared.pages.map(page => ({ ...page, id:genId(), fileId:doc.file.id, name:'Shared HTML layout', sharedHtmlLayout:true }));
    for (const slide of doc.slides) { slide.layoutid = doc.layouts[0].id; slide.showMaster = 1; }
  }
  doc.file.slides = doc.slides.map(({ id, name, transition, layoutid, showMaster }) => ({ id, name, transition, layoutid, showMaster }));
  return doc;
}
