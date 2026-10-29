import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('build produces contributor sizes and dependency graphs for every bundled output', async () => {
  for (const name of ['editor', 'presentation', 'player', 'player-css']) {
    const base = new URL(`../dist/stats/${name}`, import.meta.url);
    const [analysis, metadata] = await Promise.all([
      readFile(new URL(base.href + '.html'), 'utf8'),
      readFile(new URL(base.href + '.meta.json'), 'utf8').then(JSON.parse),
    ]);
    const outputs = Object.values(metadata.outputs);
    assert.ok(outputs.length, `${name} has an output`);
    assert.ok(outputs.some(output => Object.values(output.inputs).some(input => input.bytesInOutput > 0)), `${name} records actual contributing bytes`);
    assert.match(analysis, /<html/, `${name} has an interactive visualizer report`);
    assert.match(analysis, /nodeParts/, `${name} report includes module data`);
  }
  const combined = await readFile(new URL('../stats.html', import.meta.url), 'utf8');
  for (const output of ['editor.js', 'presentation.js', 'player.js', 'player.css']) {
    assert.ok(combined.includes(output), `combined report includes ${output}`);
  }
  const editor = await readFile(new URL('../dist/stats/editor.meta.json', import.meta.url), 'utf8');
  assert.doesNotMatch(editor, /video-optimization\.ts|optimize-video\.worker\.ts|node_modules\/(?:echarts|zrender|txml|fast-xml-parser)\/|player\/src\/|googleFonts\.js|\/txml\/txml\.ts/);
  assert.doesNotMatch(editor, /node_modules\/(?:buffer|crc|base64-js|ieee754)\//, 'editor uses shared browser-native CRC-32');
  const presentation = JSON.parse(await readFile(new URL('../dist/stats/presentation.meta.json', import.meta.url), 'utf8'));
  assert.ok(!Object.keys(presentation.inputs).some(name => /(?:^|\/)src\/editor\.jsx$|\/edlib\/(?!common\/export\/(?:document-model|presentation-document)\.mjs)|node_modules\/(?:echarts|zrender)\//.test(name)),
    'presentation renderer excludes the editor and chart runtime');
  const editorReport = await readFile(new URL('../dist/stats/editor.html', import.meta.url), 'utf8');
  assert.ok(editorReport.includes('generated output, including inline source maps'), 'report accounts for generated bundle overhead');
  for (const name of ['editor']) {
    const metadata = await readFile(new URL(`../dist/stats/${name}.meta.json`, import.meta.url), 'utf8');
    assert.doesNotMatch(metadata, /node_modules\/color-convert\//, `${name} excludes unused color replacement`);
    const runtime = await readFile(new URL(`../dist/${name}.js`, import.meta.url), 'utf8');
    assert.doesNotMatch(runtime, /(?:editor-vanjs-)?charts?\.js/, `${name} does not request a chart runtime`);
  }
});
