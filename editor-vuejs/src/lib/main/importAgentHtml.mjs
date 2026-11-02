import { parseFrontendSlides } from 'shared-vuejs/api/html-import-frontend-slides-import';
import { renderScriptedFrontendSlides } from 'shared-vuejs/api/html-import-scripted-html-render';
import { blankDocument } from 'shared-vuejs/api/document-model';
import { genId } from 'shared-vuejs/api/utility';
import { compileDeck } from '../agent/deck-compiler.mjs';
import { loadGeneratedGoogleFonts, renderedHtmlFontFamilies } from '../agent/generated-fonts.mjs';
import { canvasTextMeasurer } from '../agent/deck-text.mjs';

export async function agentHtmlDocument(source, name) {
  const deck = await renderScriptedFrontendSlides(source, parseFrontendSlides(source));
  const { googleFonts } = await import('shared-vuejs/api/googleFonts');
  const catalog = new Map(googleFonts.map(font => [font[0].toLowerCase(), font[0]]));
  const families = renderedHtmlFontFamilies(deck).map(family => catalog.get(family.toLowerCase())).filter(Boolean);
  await loadGeneratedGoogleFonts([...new Set(families)]);
  await document.fonts?.ready;
  const context = document.createElement('canvas').getContext('2d');
  const compiled = compileDeck(deck, { width: 1280, height: 720, genId, allowTextOverflow: true,
    geometry: (preset, w, h) => ({ d: `R0,0,${w},${h}` }),
    ...(context ? { measureText: canvasTextMeasurer(context) } : {}) });
  const doc = blankDocument();
  doc.file.fonts = [...new Set(families)].map(family => ({ family, type: 'google' }));
  doc.file.name = (name || deck.title).replace(/\.html?$/i, '');
  doc.slides = compiled.pages.map(page => ({ ...page, id: genId(), fileId: doc.file.id }));
  doc.file.slides = doc.slides.map(({ id, name, transition }) => ({ id, name, transition }));
  return doc;
}
