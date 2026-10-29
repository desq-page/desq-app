import van from 'vanjs-core';
import * as vanX from 'vanjs-ext';
import { setRendererURLs, ensureRenderer, rendererResources } from './renderer-loader.mjs';
import { mountEditor } from './editor.jsx';
import { DATA_ID, RUNTIME_ID, unpackDocumentAssets } from './document.mjs';
import { blankDocument } from './model.mjs';
import styles from './style.css';
import * as renderer from './shared-renderer-entry.jsx';

globalThis.SavannaRenderer = renderer;

const currentScript = document.currentScript;
const runtimeURL = currentScript?.src;
setRendererURLs(runtimeURL);
const inlineRuntime = currentScript && !runtimeURL ? currentScript.textContent : null;
let runtimePromise;
export async function getRuntime() {
  if (typeof globalThis.savannaVanRuntime === 'function') return globalThis.savannaVanRuntime.toString() + '\nwindow.SavannaVanEditor = savannaVanRuntime();\n';
  if (inlineRuntime) return inlineRuntime;
  const embedded = document.getElementById(RUNTIME_ID);
  if (embedded && !embedded.src && embedded.textContent.trim()) return embedded.textContent;
  if (!runtimeURL) throw Error('Pass getRuntime when embedding the editor through a module loader.');
  return runtimePromise ||= fetch(runtimeURL).then(response => {
    if (!response.ok) throw Error('Unable to load the editor runtime for HTML export.');
    return response.text();
  }).catch(error => { runtimePromise = undefined; throw error; });
}
function ensureStyles() {
  if (document.getElementById('savanna-van-editor-style') || document.querySelector('link[data-savanna-styles]')) return;
  const style = document.createElement('style'); style.id = 'savanna-van-editor-style'; style.textContent = styles; document.head.append(style);
}
const mounted = new WeakMap();
export function mount(host, options = {}) {
  if (!globalThis.SavannaRenderer) throw Error('Call await SavannaVanEditor.ready() before explicitly mounting the editor.');
  ensureStyles();
  if (!document.getElementById('savanna-shared-renderer-style') && !document.querySelector('link[data-savanna-renderer-styles]')) {
    const style = document.createElement('style'); style.id = 'savanna-shared-renderer-style'; style.textContent = globalThis.SavannaRenderer.getStyles(); document.head.append(style);
  }
  mounted.get(host)?.destroy();
  const editor = mountEditor(host, { getRuntime, getStyles: async () => styles, getRendererResources: rendererResources, ...options }); mounted.set(host, editor); return editor;
}
export async function boot() {
  const host = document.querySelector('[data-savanna-editor]');
  if (!host) return;
  let bootEditor;
  try {
    const payload = document.getElementById(DATA_ID);
    const documentSource = globalThis.SavannaDocumentSource;
    let data = documentSource ? undefined : payload ? unpackDocumentAssets(JSON.parse(payload.textContent)) : globalThis.SavannaDocument || blankDocument();
    const source = host.dataset.document;
    if (source && location.protocol !== 'file:') {
      const response = await fetch(source);
      if (!response.ok) throw Error(`Unable to load ${source}: ${response.status}`);
      data = await response.json();
    }
    await ensureRenderer();
    const editor = mount(host, { document: data, documentSource, workspace:globalThis.SavannaWorkspace, resume:!!documentSource });
    bootEditor = editor;
    await editor.ready;
    // Release the bootstrap JSON/media after the working copy reaches IndexedDB.
    if (globalThis.SavannaDocument === data) delete globalThis.SavannaDocument;
    payload?.remove();
    document.querySelector('script[src="document.js"]')?.remove();
    data = undefined;
    delete globalThis.SavannaDocumentSource;
    return editor;
  } catch (error) {
    if (bootEditor && mounted.get(host) !== bootEditor) return;
    bootEditor?.destroy(); mounted.delete(host);
    const message = document.createElement('p'); message.setAttribute('role', 'alert'); message.textContent = `Unable to open editor: ${error.message}`; host.replaceChildren(message);
  }
}
export { blankDocument, van, vanX };
export { createEditorStore } from './store.mjs';
export const getEditor = host => mounted.get(host);
export const ready = ensureRenderer;
// Also supports explicit, independent editor instances on a host page.
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
