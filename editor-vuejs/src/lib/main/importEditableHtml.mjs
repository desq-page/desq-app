import { readDocument } from '../../../../editor-vanjs/src/document.mjs';
import { genId } from 'shared-vuejs/api/utility';
import { putAssetsToDexie, putFileInfoToDexie } from 'shared-vuejs/api/dbutils';
import { saveMediaRecordToOPFS, saveToOPFS } from 'shared-vuejs/api/opfs';

const descriptor = record => {
  const { shapes, timing, bg, originalXml, xmlDirty, clrMap, txStyles, ...metadata } = record;
  return metadata;
};

// Import into a new local workspace: the portable ID remains in the metadata,
// so opening a copy cannot overwrite an existing document in this browser.
export function planEditableImport(doc, fileId) {
  const { version, file, slides, layouts, masters, themes, assets, tableStyles, ...root } = doc;
  const fileInfo = { ...file, id: fileId, sourceDocumentId: file.sourceDocumentId || file.id,
    __editableHtmlRoot: { ...root, version },
    slides: slides.map(slide => ({ ...descriptor(slide), fileId })),
    layouts: [...(masters || []), ...(layouts || [])].map(layout => ({ ...descriptor(layout), fileId })),
    ...(tableStyles ? { tblStyles: tableStyles } : {}) };
  const records = [];
  for (const [type, tag, list] of [['slides', 'sld', slides], ['slideLayouts', 'sldLayout', layouts || []], ['slideMasters', 'sldMaster', masters || []]]) {
    for (const item of list) records.push({ fileId, id: item.id, type, data: {
      $_title: item.title || item.name,
      [tag]: { cSld: { ...item, fileId }, originalXml: item.originalXml, xmlDirty: item.xmlDirty,
        $_showMasterSp: item.showMaster === 0 || item.showMaster === '0' ? '0' : '1',
        clrMap: item.clrMap, txStyles: item.txStyles, timing: item.timing, transition: item.transition },
    } });
  }
  for (const [id, theme] of Object.entries(themes || {})) {
    const data = theme?.data?.theme ? theme.data : theme?.theme ? theme : { theme: { themeElements: theme } };
    records.push({ fileId, id, type: 'theme', data });
  }
  return { fileInfo, records, assets: assets || {} };
}

function safeAssetName(name) {
  return typeof name === 'string' && !!name && !name.startsWith('/') && !/[\\\0?#]/.test(name)
    && name.split('/').every(part => part && part !== '.' && part !== '..');
}

export async function importEditableHtml(file) {
  const doc = readDocument(await file.text(), 'text/html');
  const fileId = genId(10);
  const plan = planEditableImport(doc, fileId);
  // Validate and decode every asset before writing any records.
  const media = [];
  for (const [name, asset] of Object.entries(plan.assets)) {
    if (/^data:/i.test(name)) continue; // Directly embedded shape references need no OPFS entry.
    if (!safeAssetName(name)) throw Error(`Invalid embedded asset name: ${name}`);
    if (name.startsWith('fonts/') && (!name.slice(6) || name.slice(6).includes('/'))) throw Error(`Invalid embedded font name: ${name}`);
    const source = typeof asset === 'string' ? asset : asset?.data || asset?.url;
    if (typeof source !== 'string' || !/^data:/i.test(source)) throw Error(`The HTML does not contain embedded media: ${name}`);
    const response = await fetch(source);
    if (!response.ok) throw Error(`Unable to decode embedded media: ${name}`);
    media.push({ name, data: new Uint8Array(await response.arrayBuffer()), metadata: typeof asset === 'object' ? asset : {} });
  }
  for (const asset of media) {
    if (asset.name.startsWith('fonts/')) {
      const name = asset.name.slice(6);
      await saveToOPFS(`pptx/${encodeURIComponent(fileId)}/ppt/fonts/${name}`, asset.data);
    } else {
      await saveMediaRecordToOPFS({ fileId, name: asset.name, data: asset.data, w: asset.metadata.w, h: asset.metadata.h });
    }
  }
  for (const record of plan.records) await putAssetsToDexie(record);
  await putFileInfoToDexie(plan.fileInfo);
  return fileId;
}
