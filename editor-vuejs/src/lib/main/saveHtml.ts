import { getFileInfo, getDocumentRevision, markFileSaved } from 'shared-vuejs/editor';
import { downloadFile, selectDownloadFile } from 'shared-vuejs/api/downloadShape';
import { flushPendingDexieSaves } from 'shared-vuejs/api/dbutils';
import { flushPendingTextSave } from 'shared-vuejs/api/updateText';

export type HtmlSaveFormat = 'single' | 'zip';
export type HtmlSaveSnapshot = { file: any; id: string; revision: number };
export type PreparedHtml = { blob: Blob; snapshot: HtmlSaveSnapshot; format: HtmlSaveFormat; embedEditor: boolean };

export function htmlSaveSnapshot(): HtmlSaveSnapshot {
  const file = getFileInfo();
  return { file, id: file?.id, revision: getDocumentRevision() };
}
export function isHtmlSaveCurrent(snapshot: HtmlSaveSnapshot) {
  const current = getFileInfo();
  return !!current && current.id === snapshot.id && current === snapshot.file && getDocumentRevision() === snapshot.revision;
}
export async function prepareHtml(format: HtmlSaveFormat, embedEditor: boolean): Promise<PreparedHtml> {
  await flushPendingTextSave();
  await flushPendingDexieSaves();
  const before = htmlSaveSnapshot();
  const { prepareHtmlExport } = await import('./exportEditableHtml');
  const blob = await prepareHtmlExport(format, embedEditor);
  if (!isHtmlSaveCurrent(before)) throw new Error('The presentation changed while preparing HTML. Please try again.');
  return { blob, snapshot: before, format, embedEditor };
}
export function selectHtmlDestination(format: HtmlSaveFormat, embedEditor: boolean) {
  const file = getFileInfo();
  const baseName = (file.name || file.title || 'Presentation').replace(/\.(pptx|pub|docx|html?|zip)$/i, '');
  const name = `${baseName}${embedEditor ? '.editable' : ''}.${format === 'zip' ? 'zip' : 'html'}`;
  return { name, destination: selectDownloadFile(name) };
}
export async function savePreparedHtml(prepared: PreparedHtml, selection?: ReturnType<typeof selectHtmlDestination>) {
  if (!isHtmlSaveCurrent(prepared.snapshot)) throw new Error('The presentation changed. Prepare HTML again before saving.');
  const { name, destination: pendingDestination } = selection || selectHtmlDestination(prepared.format, prepared.embedEditor);
  const destination = await pendingDestination;
  if (destination === null) return false;
  if (!isHtmlSaveCurrent(prepared.snapshot)) throw new Error('The presentation changed. Prepare HTML again before saving.');
  const saved = await downloadFile(prepared.blob, name, false, undefined, destination);
  if (saved && isHtmlSaveCurrent(prepared.snapshot)) await markFileSaved(prepared.snapshot.id);
  return saved;
}
