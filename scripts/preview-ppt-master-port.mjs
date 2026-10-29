import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import sharp from "sharp";
import { compileDeck } from "../editor-vuejs/src/lib/agent/deck-compiler.mjs";
import { deckLayoutPreviews } from "../editor-vuejs/src/lib/agent/deck-preview.mjs";
const output = resolve(process.argv[2] || "tmp/ppt-master-proof");
await mkdir(output, { recursive: true });
const names = ["editorial", "swiss-minimal", "memphis", "soft-rounded", "glassmorphism"],
  slides = [];
let id = 0;
for (const title of names)
  slides.push({
    title,
    purpose: "Upstream compatibility proof",
    layout: "svg",
    svg: await readFile(`third_party/ppt-master/fixtures/${title}.svg`, "utf8"),
  });
const result = compileDeck(
  {
    title: "Upstream SVG port",
    audience: "Developers",
    objective: "Compare source/native geometry",
    slides,
  },
  {
    width: 1280,
    height: 720,
    genId: () => `port-${++id}`,
    geometry: () => ({}),
  },
);
const previews = deckLayoutPreviews(result),
  tiles = [];
for (const [i, slide] of slides.entries()) {
  const svg = decodeURIComponent(previews[i].url.split(",").slice(1).join(","));
  await writeFile(join(output, `${slide.title}-native.svg`), svg);
  for (const [column, input] of [slide.svg, svg].entries())
    tiles.push({
      input: await sharp(Buffer.from(input)).resize(640, 360).png().toBuffer(),
      left: 20 + 660 * column,
      top: 20 + i * 380,
    });
}
await sharp({
  create: { width: 1340, height: 20+380*slides.length, channels: 3, background: "#D7DEE2" },
})
  .composite(tiles)
  .png()
  .toFile(join(output, "source-vs-native.png"));
await writeFile(
  join(output, "native-deck.json"),
  JSON.stringify(result.pages, null, 2),
);
console.log(join(output, "source-vs-native.png"));
