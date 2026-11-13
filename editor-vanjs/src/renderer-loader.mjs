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
export const ensureRenderer = () => globalThis.DesqRenderer
  ? Promise.resolve(globalThis.DesqRenderer)
  : Promise.reject(Error('The editor renderer is unavailable.'));
export async function playerResources() {
  if (globalThis.DesqEmbeddedPlayer) {
    const embedded = globalThis.DesqEmbeddedPlayer;
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
export async function rendererResources(doc) {
  const renderer = await ensureRenderer();
  const resources = { rendererStyles: renderer.getStyles(),
    ...await playerResources() };
  return resources;
}
