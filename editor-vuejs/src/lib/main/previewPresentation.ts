import { getFileInfo, updateFile } from "shared-vuejs/editor";
import { saveDexie } from "shared-vuejs/api/dbutils";
import { exportFile } from "shared-vuejs/api/html";
import { piniaInfo } from "@/lib/common/store";

export async function openPreviewModal() {
  piniaInfo().setCurPopup("");
  updateFile({ publish: { ...getFileInfo().publish, published: false } });
  saveDexie();
  piniaInfo().openPreviewModal = true;
  await exportFile();
}

/** Open the editor's generated playback HTML with the comparison runtime. */
export async function openAnimePreview() {
  const win = window.open('', '_blank');
  if (!win) throw new Error('Allow popups to open the Anime.js player.');
  win.document.body.textContent = 'Preparing Anime.js playback…';
  let url: string | undefined;
  try {
    const { flushPendingTextSave } = await import('shared-vuejs/api/updateText');
    await flushPendingTextSave();
    await saveDexie();
    await exportFile();
    const { getBaseHref } = await import('shared-vuejs/api/get-file');
    const base = getBaseHref(getFileInfo().id);
    const response = await fetch(base + 'index.html', { cache: 'no-store' });
    if (!response.ok) throw new Error('Generated presentation HTML is unavailable.');
    const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
    const script = doc.querySelector('script[src="player.js"]');
    if (!script) throw new Error('Generated HTML has no player script.');
    const runtime = new URL(`${import.meta.env.BASE_URL}player/anime-player.js`, location.origin).href;
    const check = await fetch(runtime, { cache: 'no-store' });
    if (!check.ok) throw new Error(`Anime.js player asset failed to load (${check.status}): ${runtime}`);
    const runtimeSource = await check.text();
    if (!/\bvar\s+player\s*=/.test(runtimeSource) || !runtimeSource.includes('initSlides')) {
      throw new Error(`Invalid Anime.js player response: ${runtime}. Rebuild player assets.`);
    }
    script.setAttribute('src', runtime);
    // Inline the generated config so preview works with an older active worker.
    const configScript = doc.querySelector('script[src="player-config.js"]');
    if (configScript) {
      const { getFileFromOPFS } = await import('shared-vuejs/api/opfs');
      const config = await getFileFromOPFS(`pptx/${encodeURIComponent(getFileInfo().id)}/_internal/player-config.js`);
      configScript.removeAttribute('src');
      configScript.textContent = (await config.text()).replace(/<\/script/gi, '<\\/script');
    }

    // Generated exports use relative player.css for ZIP playback. The editor's
    // /res/ route serves slide/media data, so load player CSS from static assets.
    const playerStyles = doc.querySelector('link[rel="stylesheet"][href="player.css"]');
    if (!playerStyles) throw new Error('Generated HTML has no player stylesheet.');
    playerStyles.setAttribute('href', new URL(`${import.meta.env.BASE_URL}player/player.css`, location.origin).href);

    const baseTag = doc.createElement('base');
    baseTag.href = base;
    doc.head.prepend(baseTag);
    doc.title += ' — Anime.js';
    url = URL.createObjectURL(new Blob(['<!doctype html>\n' + doc.documentElement.outerHTML], { type: 'text/html' }));
    win.location.replace(url);
    const cleanup = window.setInterval(() => {
      if (win.closed) { clearInterval(cleanup); URL.revokeObjectURL(url!); }
    }, 1000);
  } catch (error) {
    if (url) URL.revokeObjectURL(url);
    if (!win.closed) win.document.body.textContent = String(error);
    throw error;
  }
}
