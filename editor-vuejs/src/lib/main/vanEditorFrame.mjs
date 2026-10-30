import { DATA_ID, scriptJSON, escapeHTML } from '../../../../editor-vanjs/src/document.mjs';

export function vanEditorFrame(doc, runtimeURL, sourceKey) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHTML(doc.file.name || 'VanJS editor')}</title>
<style>html,body,[data-desq-editor]{height:100%;margin:0}</style></head>
<body><div data-desq-editor></div>
${sourceKey ? `<script>window.DesqDocumentSource=parent.DesqVanSources[${scriptJSON(sourceKey)}];window.DesqWorkspace=${scriptJSON("vanjs:" + doc.file.id + ":" + (doc.file.timestamp || 0))};</script>` : `<script type="application/json" id="${DATA_ID}">${scriptJSON(doc)}</script>`}
<script src="${escapeHTML(runtimeURL)}"></script></body></html>`;
}
