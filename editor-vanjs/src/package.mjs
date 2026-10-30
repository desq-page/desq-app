import { clone, normalizeDocument } from './model.mjs';
import { escapeHTML, scriptJSON, fileDataURL } from './document.mjs';
import { createZip, readZip, safePath } from './zip.mjs';
const encoder = new TextEncoder(), decoder = new TextDecoder();
const extensions = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg',
  'image/avif': 'avif', 'image/bmp': 'bmp', 'video/mp4': 'mp4', 'video/webm': 'webm', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'font/woff': 'woff', 'font/woff2': 'woff2', 'font/ttf': 'ttf', 'font/otf': 'otf' };
export function packageHTML(doc) {
  return `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width,initial-scale=1">\n  <title>${escapeHTML(doc.file.name || 'Presentation')}</title>\n  <link rel="stylesheet" href="editor.css" data-desq-styles>\n  <link rel="stylesheet" href="renderer.css" data-desq-renderer-styles>\n  <style>html,body,[data-desq-editor]{height:100%;margin:0}</style>\n</head>\n<body>\n  <div data-desq-editor></div>\n  <script src="document.js"></script>\n  <script src="editor.js"></script>\n</body>\n</html>\n`;
}
export function parseDocumentScript(source) {
  const match = /^\s*window\.DesqDocument\s*=\s*([\s\S]*?)\s*;\s*$/.exec(source);
  if (!match) throw Error('Invalid document.js in editable ZIP.');
  return JSON.parse(match[1]);
}
async function sourceBytes(source) {
  if (typeof source !== 'string') throw Error('Invalid media source.');
  if (/^data:/i.test(source)) {
    const comma = source.indexOf(','); if (comma < 0) throw Error('Invalid media data URL.');
    const header = source.slice(5, comma), mime = header.split(';')[0] || 'application/octet-stream';
    const data = /;base64$/i.test(header) ? Uint8Array.from(atob(source.slice(comma + 1)), c => c.charCodeAt(0)) : encoder.encode(decodeURIComponent(source.slice(comma + 1)));
    return { data, mime };
  }
  const url = new URL(source, document.baseURI);
  if (!['https:', 'http:', 'blob:'].includes(url.protocol)) throw Error('To save local media, serve the extracted folder over HTTP.');
  const response = await fetch(url);
  if (!response.ok) throw Error(`Unable to package media ${source}: ${response.status}`);
  const blob = await response.blob();
  return { data: new Uint8Array(await blob.arrayBuffer()), mime: blob.type || 'application/octet-stream' };
}
export async function packageEntries(documentData, runtime, styles, resources) {
  if (!runtime?.trim() || !styles?.trim()) throw Error('The editor runtime or stylesheet is missing.');
  if (!resources?.rendererStyles?.trim()) throw Error('The shared renderer stylesheet is missing.');
  if (!resources?.player?.trim() || !resources?.playerStyles?.trim()) throw Error('The presentation player or its stylesheet is missing.');
  if (!Array.isArray(resources.playerAssets) || !resources.playerAssets.length) throw Error('The presentation player fonts are missing.');
  const doc = clone(normalizeDocument(documentData));
  const targets = new Set(Object.keys(doc.assets));
  const walk = shapes => (shapes || []).forEach(s => { for (const target of [s.blipFill?.blip?.$_target, s.src, s.audio?.$_target, s.video?.$_target, s.poster]) if (target) targets.add(target); walk(s.children); });
  [...doc.slides, ...doc.layouts, ...doc.masters].forEach(s => walk(s.shapes));
  const media = [], aliases = new Map(), names = new Set();
  for (const target of targets) {
    const asset = doc.assets[target], source = typeof asset === 'string' ? asset : asset?.data || asset?.url || target;
    let path = aliases.get(source);
    if (!path) {
      const { data, mime } = await sourceBytes(source);
      let name = target.split(/[?#]/)[0].split(/[\\/]/).pop().replace(/[^a-z0-9._-]/gi, '-').replace(/^\.+/, '').slice(0, 100) || 'media';
      if (/^data:/i.test(target)) name = 'media';
      if (!/\.[a-z0-9]{1,8}$/i.test(name)) name += '.' + (extensions[mime] || 'bin');
      const base = name; let counter = 1;
      while (names.has(name.toLowerCase())) { const dot = base.lastIndexOf('.'); name = `${base.slice(0, dot)}-${++counter}${base.slice(dot)}`; }
      names.add(name.toLowerCase()); path = 'assets/' + name; aliases.set(source, path);
      media.push({ name: path, data, mime });
    }
    // Preserve optional asset metadata while replacing its embedded content.
    if (asset && typeof asset === 'object') { const { data, url, ...metadata } = asset; doc.assets[target] = { ...metadata, url: path }; }
    else doc.assets[target] = path;
    if (/^data:/i.test(target)) { // Avoid retaining the data URL itself as an asset-map key.
      const rewrite = shapes => (shapes || []).forEach(s => {
        if (s.blipFill?.blip?.$_target === target) s.blipFill.blip.$_target = path;
        for (const media of [s.audio, s.video]) if (media?.$_target === target) media.$_target = path;
        if (s.src === target) s.src = path;
        if (s.poster === target) s.poster = path;
        rewrite(s.children);
      });
      [...doc.slides, ...doc.layouts, ...doc.masters].forEach(s => rewrite(s.shapes));
      delete doc.assets[target]; doc.assets[path] = path;
    }
  }
  const entries = [
    { name: 'index.html', data: packageHTML(doc) },
    { name: 'document.js', data: 'window.DesqDocument = ' + scriptJSON(doc) + ';\n' },
    { name: 'editor.js', data: runtime }, { name: 'editor.css', data: styles },
    { name: 'renderer.css', data: resources.rendererStyles },
    { name: 'player.js', data: resources.player },
    { name: 'player.css', data: resources.playerStyles.replace(/url\((['"]?)\/fonts\//g, 'url($1assets/fonts/') },
    ...resources.playerAssets.map(asset => ({ name: asset.name, data: asset.data, mime: asset.mime })),
    ...media,
  ];
  const manifest = { format: 'desq-editable', version: 2, document: 'document.js', entry: 'index.html',
    files: entries.map(e => ({ path: e.name, bytes: typeof e.data === 'string' ? encoder.encode(e.data).length : e.data.length, ...(e.mime ? { mime: e.mime } : {}) })) };
  entries.push({ name: 'manifest.json', data: JSON.stringify(manifest, null, 2) + '\n' });
  return entries;
}
export async function editableZip(doc, runtime, styles, resources) { return createZip(await packageEntries(doc, runtime, styles, resources)); }
export async function readEditableZip(blob) {
  const entries = await readZip(blob), payload = entries.get('document.js'), legacy = entries.get('document.json');
  if (!payload && !legacy) throw Error('This ZIP does not contain document.js or document.json.');
  // Older packages contain both files; their JSON is authoritative.
  const doc = normalizeDocument(legacy ? JSON.parse(decoder.decode(legacy)) : parseDocumentScript(decoder.decode(payload)));
  const manifest = entries.has('manifest.json') ? JSON.parse(decoder.decode(entries.get('manifest.json'))) : {};
  const mimeTypes = new Map((manifest.files || []).map(f => [f.path, f.mime]));
  for (const [key, asset] of Object.entries(doc.assets)) {
    const path = typeof asset === 'string' ? asset : asset?.url;
    if (!safePath(path) || !entries.has(path)) throw Error(`Missing media in ZIP: ${path}`);
    const mime = mimeTypes.get(path) || Object.entries(extensions).find(([, ext]) => path.toLowerCase().endsWith('.' + ext))?.[0] || 'application/octet-stream';
    const data = await fileDataURL(new Blob([entries.get(path)], { type: mime }));
    doc.assets[key] = typeof asset === 'object' ? { ...asset, data } : data;
  }
  return doc;
}
