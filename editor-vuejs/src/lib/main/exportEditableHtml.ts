// The existing editor supplies native JSON/media; only the tiny VanJS runtime
// travels in the exported HTML. No Vue code is included in the saved file.
import { getFileInfo } from 'shared-vuejs/editor';
import { saveDexie } from 'shared-vuejs/api/dbutils';
import { flushPendingTextSave } from 'shared-vuejs/api/updateText';
import { exportFile } from 'shared-vuejs/api/html';
import { prepareEditableDocument, createSinglePresentationHtml } from 'shared-vuejs/api/presentation-export';
import { downloadFile } from 'shared-vuejs/api/downloadShape';
import { showProgress } from 'shared-vuejs/api/utils';
import { editableHTML } from '../../../../editor-vanjs/src/document.mjs';
import { editableZip } from '../../../../editor-vanjs/src/package.mjs';

export async function prepareHtmlExport(format: 'single' | 'zip', embedEditor: boolean): Promise<Blob> {
  await flushPendingTextSave();
  await saveDexie();
  const fileId = getFileInfo().id;
  if (format === 'zip' && !embedEditor) {
    await exportFile(fileId);
    const { packageFile } = await import('shared-vuejs/api/export-zip');
    return packageFile(fileId, true);
  }
  if (format === 'single' && !embedEditor) {
    return createSinglePresentationHtml(fileId, { baseUrl: import.meta.env.BASE_URL });
  }
  const doc = await prepareEditableDocument(fileId);
  const response = await fetch(`${import.meta.env.BASE_URL}editor-vanjs.js`, { cache: 'no-store' });
  if (!response.ok) throw Error('VanJS runtime is unavailable. Build editor-vanjs with --publish before exporting.');
  const runtime = await response.text();
  if (!runtime.includes('SavannaVanEditor')) throw Error('Invalid VanJS runtime response. Rebuild editor-vanjs with --publish.');
  if (format === 'single' && !runtime.includes('__savannaAssetPool')) throw Error('The VanJS runtime is outdated and cannot open embedded media. Rebuild editor-vanjs with --publish and retry.');
  const resource = async (name: string) => {
    const response = await fetch(`${import.meta.env.BASE_URL}editor-vanjs-${name}`, { cache: 'no-store' });
    if (!response.ok) throw Error(`Shared renderer resource is unavailable: ${name}. Rebuild editor-vanjs with --publish.`);
    return response.text();
  };
  const [rendererStyles, player, playerStyles, fontResponse] = await Promise.all([
    resource('renderer.css'), resource('player.js'), resource('player.css'), fetch(`${import.meta.env.BASE_URL}fonts/Carlito.woff2`),
  ]);
  if (!fontResponse.ok) throw Error('Player font is unavailable: Carlito.woff2');
  const resources = { rendererStyles, player, playerStyles,
    playerAssets: [{ name: 'assets/fonts/Carlito.woff2', mime: 'font/woff2', data: new Uint8Array(await fontResponse.arrayBuffer()) }] };
  if (format === 'single') return new Blob([editableHTML(doc, runtime, resources)], { type: 'text/html;charset=utf-8' });
  const cssResponse = await fetch(`${import.meta.env.BASE_URL}editor-vanjs.css`, { cache: 'no-store' });
  if (!cssResponse.ok) throw Error('VanJS stylesheet is unavailable. Rebuild editor-vanjs with --publish.');
  return editableZip(doc, runtime, await cssResponse.text(), resources);
}

async function exportPrepared(format: 'single' | 'zip', editable: boolean, destination?: any, name?: string) {
  showProgress('Preparing HTML…');
  try {
    const file = getFileInfo();
    const baseName = (file.name || file.title || 'Presentation').replace(/\.pptx$/i, '');
    const sourceName = file.name || file.title || 'Presentation.pptx';
    const fallback = format === 'zip' ? `${baseName}${editable ? '.editable' : ''}.zip` :
      editable ? `${baseName}.editable.html` : `${sourceName}${/\.pptx$/i.test(sourceName) ? '' : '.pptx'}.html`;
    return await downloadFile(await prepareHtmlExport(format, editable), name || fallback, false, undefined, destination);
  } finally { showProgress(''); }
}
export async function exportEditableHtml(destination?: any, name?: string) { return exportPrepared('zip', true, destination, name); }
export async function exportSingleEditableHtml(destination?: any, name?: string) { return exportPrepared('single', true, destination, name); }
export async function exportSinglePageHtml(destination?: any, name?: string) { return exportPrepared('single', false, destination, name); }
export async function exportPresentationZip(destination?: any, name?: string) { return exportPrepared('zip', false, destination, name); }
