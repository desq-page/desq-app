const pending = new Map();
let playerURL, playerStylesURL, playerFontsURL;
export function setRendererURLs(runtimeURL) {
  const base = runtimeURL || document.baseURI;
  const published = runtimeURL && /editor-vanjs\.js(?:[?#]|$)/.test(runtimeURL);
  playerURL = new URL(published ? 'editor-vanjs-player.js' : 'player.js', base).href;
  playerStylesURL = new URL(published ? 'editor-vanjs-player.css' : 'player.css', base).href;
  const version = new URL(base).searchParams.get('v');
  if (version) for (const url of [playerURL, playerStylesURL]) {
    const resource = new URL(url); resource.searchParams.set('v', version);
    if (url === playerURL) playerURL = resource.href;
    else playerStylesURL = resource.href;
  }
  playerFontsURL = new URL(published ? 'fonts/' : 'assets/fonts/', base).href;
}
function load(globalName, url) {
  if (globalThis[globalName]) return Promise.resolve(globalThis[globalName]);
  if (!pending.has(globalName)) pending.set(globalName, new Promise((resolve, reject) => {
    const script = document.createElement('script'); script.src = url;
    script.onload = () => globalThis[globalName] ? resolve(globalThis[globalName]) : reject(Error(`Invalid shared renderer: ${url}`));
    script.onerror = () => { pending.delete(globalName); script.remove(); reject(Error(`Unable to load ${url}. Keep the extracted ZIP files together.`)); };
    document.head.append(script);
  }));
  return pending.get(globalName);
}
export const ensureRenderer = () => globalThis.SavannaRenderer
  ? Promise.resolve(globalThis.SavannaRenderer)
  : Promise.reject(Error('The editor renderer is unavailable.'));
export const ensurePlayer = () => load('SavannaPlayer', playerURL);
export async function playerResources() {
  if (globalThis.SavannaEmbeddedPlayer) {
    const embedded = globalThis.SavannaEmbeddedPlayer;
    return { ...embedded, playerAssets: embedded.playerAssets.map(asset => ({ ...asset, data: Uint8Array.from(atob(asset.data), c => c.charCodeAt(0)) })) };
  }
  const [js, css] = await Promise.all([fetch(playerURL), fetch(playerStylesURL)]);
  if (!js.ok || !css.ok) throw Error('Unable to read the presentation player assets for ZIP export.');
  const playerAssets = await Promise.all([
    ['Carlito.woff2', 'font/woff2'],
  ].map(async ([name, mime]) => {
    const response = await fetch(new URL(name, playerFontsURL).href);
    if (!response.ok) throw Error(`Unable to read player font ${name}: ${response.status}`);
    return { name: `assets/fonts/${name}`, mime, data: new Uint8Array(await response.arrayBuffer()) };
  }));
  return { player: await js.text(), playerStyles: await css.text(), playerAssets };
}
export function ensurePlayerStyles() {
  if (document.querySelector('[data-savanna-player-styles]')) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = playerStylesURL;
    link.dataset.savannaPlayerStyles = '';
    link.onload = resolve; link.onerror = () => { link.remove(); reject(Error(`Unable to load ${playerStylesURL}. Keep the extracted ZIP files together.`)); };
    document.head.append(link);
  });
}
export async function rendererResources(doc) {
  const renderer = await ensureRenderer();
  const resources = { rendererStyles: renderer.getStyles(),
    ...await playerResources() };
  return resources;
}
