// Small ZIP32 codec. Writes standard stored entries; reads stored/deflated ZIPs.
// Browser-native decompression keeps a compression library out of the editor.
const encoder = new TextEncoder(), decoder = new TextDecoder();
import { crc32 } from 'shared-vuejs/api/lib-crc32';
export { crc32 };
export function safePath(path) {
  return typeof path === 'string' && path.length > 0 && !/[\\\0]/.test(path) && !/^(?:\/|[a-z]:)/i.test(path) && !path.split('/').some(p => !p || p === '.' || p === '..');
}
export function createZip(entries) {
  if (entries.length > 65535) throw Error('Too many ZIP entries.');
  const parts = [], central = [], seen = new Set(); let offset = 0, centralSize = 0;
  for (const entry of entries) {
    if (!safePath(entry.name) || seen.has(entry.name)) throw Error(`Invalid or duplicate ZIP path: ${entry.name}`);
    seen.add(entry.name);
    const name = encoder.encode(entry.name), bytes = typeof entry.data === 'string' ? encoder.encode(entry.data) : entry.data;
    if (!(bytes instanceof Uint8Array) || name.length > 65535 || bytes.length > 0xffffffff) throw Error('ZIP entry exceeds ZIP32 limits.');
    const crc = crc32(bytes), local = new Uint8Array(30), l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true); l.setUint16(4, 20, true); l.setUint16(6, 0x800, true); l.setUint16(12, 33, true);
    l.setUint32(14, crc, true); l.setUint32(18, bytes.length, true); l.setUint32(22, bytes.length, true); l.setUint16(26, name.length, true);
    const header = new Uint8Array(46), c = new DataView(header.buffer);
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x800, true); c.setUint16(14, 33, true);
    c.setUint32(16, crc, true); c.setUint32(20, bytes.length, true); c.setUint32(24, bytes.length, true); c.setUint16(28, name.length, true); c.setUint32(42, offset, true);
    parts.push(local, name, bytes); central.push(header, name);
    offset += local.length + name.length + bytes.length; centralSize += header.length + name.length;
    if (offset + centralSize > 0xffffffff) throw Error('Package exceeds ZIP32 limits.');
  }
  const end = new Uint8Array(22), e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, entries.length, true); e.setUint16(10, entries.length, true);
  e.setUint32(12, centralSize, true); e.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end], { type: 'application/zip' });
}
export async function readZip(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer()), view = new DataView(bytes.buffer);
  const fail = () => { throw Error('Invalid or unsupported ZIP archive.'); };
  let end = bytes.length - 22;
  for (; end >= Math.max(0, bytes.length - 65557); end--) {
    if (view.getUint32(end, true) === 0x06054b50 && end + 22 + view.getUint16(end + 20, true) === bytes.length) break;
  }
  if (end < Math.max(0, bytes.length - 65557)) fail();
  if (view.getUint16(end + 4, true) || view.getUint16(end + 6, true) || view.getUint16(end + 8, true) !== view.getUint16(end + 10, true)) fail();
  let cursor = view.getUint32(end + 16, true), total = 0;
  const centralEnd = cursor + view.getUint32(end + 12, true), entries = new Map();
  if (centralEnd !== end) fail();
  for (let i = 0; i < view.getUint16(end + 10, true); i++) {
    if (cursor + 46 > centralEnd || view.getUint32(cursor, true) !== 0x02014b50) fail();
    const flags = view.getUint16(cursor + 8, true), method = view.getUint16(cursor + 10, true);
    const crc = view.getUint32(cursor + 16, true), compressed = view.getUint32(cursor + 20, true), size = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true), extraLength = view.getUint16(cursor + 30, true), commentLength = view.getUint16(cursor + 32, true);
    const local = view.getUint32(cursor + 42, true);
    if (cursor + 46 + nameLength + extraLength + commentLength > centralEnd || local + 30 > view.getUint32(end + 16, true)) fail();
    const name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    cursor += 46 + nameLength + extraLength + commentLength;
    if (name.endsWith('/')) { if (!safePath(name.slice(0, -1))) fail(); continue; }
    if (!safePath(name) || entries.has(name) || flags & 1 || ![0, 8].includes(method)) fail();
    total += size;
    if (size > 512 * 1024 * 1024 || total > 1024 * 1024 * 1024) throw Error('ZIP exceeds the import size limit.');
    if (view.getUint32(local, true) !== 0x04034b50 || view.getUint16(local + 8, true) !== method) fail();
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    if (start + compressed > view.getUint32(end + 16, true)) fail();
    let data = bytes.slice(start, start + compressed);
    if (method === 8) {
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      const reader = stream.getReader(), chunks = []; let length = 0;
      while (true) { const next = await reader.read(); if (next.done) break; length += next.value.length;
        if (length > size) { await reader.cancel(); fail(); } chunks.push(next.value); }
      data = new Uint8Array(await new Blob(chunks).arrayBuffer());
    }
    if (data.length !== size || crc32(data) !== crc) throw Error(`Corrupt ZIP entry: ${name}`);
    entries.set(name, data);
  }
  if (cursor !== centralEnd) fail();
  return entries;
}
