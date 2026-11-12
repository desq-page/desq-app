import * as renderer from './shared-renderer-entry.jsx';
import { renderPlayerSlide, createPlayerAssetDocument } from './render.jsx';
import { unpackDocumentAssets } from './document.mjs';
import * as player from '@desq/player/native';

globalThis.DesqRenderer = renderer;

export async function startPresentation() {
  const payload = document.getElementById('desq-document');
  if (!payload) throw Error('The presentation document is missing.');
  const assets = createPlayerAssetDocument(unpackDocumentAssets(JSON.parse(payload.textContent)));
  const doc = assets.document;
  const style = document.createElement('style');
  style.textContent = renderer.getStyles();
  document.head.append(style);
  player.setEmbeddedSlides(async (index, prepare) => {
    const slideDoc = await assets.forSlide(index, prepare);
    return renderPlayerSlide(slideDoc, index);
  }, { assets: assets.assets });
  await player.initSlides({ ...doc.file,
    scripting: doc.playbackScripting,
    slides: doc.slides.map(({ id, title, name, transition, timing, show, layoutid, showMaster }) => ({ id, title: title || name, transition, timing, show, layoutid, showMaster })),
    layouts: [...(doc.layouts || []), ...(doc.masters || [])].map(({ id, parentid, timing }) => ({ id, parentid, timing })),
    grid: doc.file.grids, publish: doc.file.publish });
}

function boot() {
  startPresentation().catch(error => {
    const message = document.createElement('p');
    message.textContent = `Unable to open presentation: ${error.message}`;
    document.body.append(message);
  });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
