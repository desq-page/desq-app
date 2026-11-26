import { readFile, writeFile } from 'node:fs/promises';
import { gunzipSync, gzipSync } from 'node:zlib';

const assets = new URL('../editor-vuejs/public/iconify/', import.meta.url);
const catalog = JSON.parse(await readFile(new URL('collections.json', assets), 'utf8'));
const index = {};
for (const set of Object.keys(catalog).sort()) {
  const bytes = await readFile(new URL(`sets/${set}.json.gz`, assets));
  const { prefix, icons, aliases } = JSON.parse(gunzipSync(bytes));
  if (prefix !== set || !icons) throw new Error(`Invalid Iconify collection: ${set}`);
  index[set] = [...new Set([...Object.keys(icons), ...Object.keys(aliases ?? {})])].sort();
}
await writeFile(new URL('search-index.json.gz', assets), gzipSync(JSON.stringify(index), { level: 9 }));
