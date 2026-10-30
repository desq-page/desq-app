import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import sharp from 'sharp';
import { compileDeck } from '../editor-vuejs/src/lib/agent/deck-compiler.mjs';
import { deckLayoutPreviews } from '../editor-vuejs/src/lib/agent/deck-preview.mjs';
import { designSample, helloWorldSample } from './deck-design-sample.mjs';

// Reproducible schematic layout proof; this is not the Desq/PPTX renderer.
const output = resolve(process.argv[2] || 'tmp/deck-design-preview');
await mkdir(output, { recursive: true });
let id = 0;
const deck = process.argv.includes('--hello-world') ? helloWorldSample() : designSample();
const assets = new Map(deck.slides.flatMap((s, i) => s.images?.length ? [[`${i}:hero`, { placeholder: true, warning: 'Layout proof uses an image placeholder.' }]] : []));
const compiled = compileDeck(deck, { width: 1280, height: 720, assets, genId: () => `preview-${++id}`, geometry: (p, w, h) => ({ d: `R0,0,${w},${h}` }) });
const previews = deckLayoutPreviews(compiled, { limit: 20 });
const tiles = [];
for (const [index, preview] of previews.entries()) {
  const svg = decodeURIComponent(preview.url.slice(preview.url.indexOf(',') + 1));
  await writeFile(join(output, `slide-${index + 1}.svg`), svg);
  const png = await sharp(Buffer.from(svg)).resize(640, 360).png().toBuffer();
  tiles.push({ input: png, left: 20 + index % 2 * 660, top: 20 + Math.floor(index / 2) * 380 });
}
await sharp({ create: { width: 1340, height: 20 + Math.ceil(previews.length / 2) * 380, channels: 3, background: '#D7DEE2' } }).composite(tiles).png().toFile(join(output, 'contact-sheet.png'));
await writeFile(join(output, 'native-deck.json'), JSON.stringify(compiled.pages, null, 2));
console.log(join(output, 'contact-sheet.png'));
