import * as renderer from './shared-renderer-entry.jsx';
import { renderPlayerSlide } from './render.jsx';
import { unpackDocumentAssets } from './document.mjs';
import * as player from '@savanna/player';

globalThis.SavannaRenderer = renderer;

export async function startPresentation() {
  const payload = document.getElementById('savanna-document');
  if (!payload) throw Error('The presentation document is missing.');
  const doc = unpackDocumentAssets(JSON.parse(payload.textContent));
  const style = document.createElement('style');
  style.textContent = renderer.getStyles();
  document.head.append(style);
  player.setEmbeddedSlides(index => renderPlayerSlide(doc, index));
  await player.initSlides({ ...doc.file,
    slides: doc.slides.map(({ id, title, name, transition, timing, show }) => ({ id, title: title || name, transition, timing, show })),
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
