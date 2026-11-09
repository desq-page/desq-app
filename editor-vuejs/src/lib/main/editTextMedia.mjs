import { deleteMediaRecordFromOPFS, getMediaRecordsFromOPFS } from 'shared-vuejs/api/opfs';

export const EDIT_TEXT_MEDIA_PREFIX = 'desq-edit-text-ai-';

export const isEditTextMedia = name => String(name || '').startsWith(EDIT_TEXT_MEDIA_PREFIX);

export async function clearEditTextMedia(fileId) {
  if (!fileId) return;
  const records = await getMediaRecordsFromOPFS(fileId);
  await Promise.all(records.filter(record => isEditTextMedia(record.name))
    .map(record => deleteMediaRecordFromOPFS(fileId, record.name)));
}

// Keep the actual targets immutable so existing undo and redo deltas stay valid.
export function originalEditTextMedia(name) {
  const match = name.match(/^desq-edit-text-ai-[^.]+\.(.+)\.webp$/);
  if (!match) return undefined;
  try { return new TextDecoder().decode(Uint8Array.from(atob(match[1].replace(/-/g, "+").replace(/_/g, "/")), char => char.charCodeAt(0))); } catch { return undefined; }
}

export function editTextMediaName(id, source) {
  const original = originalEditTextMedia(source) || source;
  const encoded = btoa(String.fromCharCode(...new TextEncoder().encode(original.slice(0, 200)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const suffix = original.length <= 200 && encoded.length <= 160 && !/^(?:https?:|blob:|data:|\/)/i.test(original)
    ? '.' + encoded : '';
  return EDIT_TEXT_MEDIA_PREFIX + id + suffix + '.webp';
}

export function visibleEditTextMedia(records, pages) {
  const used = new Set();
  const collect = value => {
    if (!value || typeof value !== 'object') return;
    if (typeof value.$_target === 'string') used.add(value.$_target.replace(/^(?:ppt\/)?media\//, ''));
    Object.values(value).forEach(collect);
  };
  pages.forEach(collect);
  const originals = new Set(records.map(record => originalEditTextMedia(record.name))
    .filter(Boolean).map(name => name.replace(/^(?:ppt\/)?media\//, '')));
  return records.filter(record => {
    const name = record.name.replace(/^(?:ppt\/)?media\//, '');
    return used.has(name) || (!isEditTextMedia(name) && !originals.has(name));
  });
}
