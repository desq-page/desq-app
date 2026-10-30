import { build, context } from 'esbuild';
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, relative } from 'node:path';
import { createRequire } from 'node:module';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { packageEntries } from '../src/package.mjs';
import { createZip } from '../src/zip.mjs';
import { blankDocument, createShape, setText } from '../src/model.mjs';
import { localCoreDirectory, resolveCorePackage } from '../../scripts/local-core.mjs';
import { disabledOfficeModule } from './office-stubs.mjs';
import { createBundleStats } from './bundle-stats.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const outdir = resolve(root, 'dist');
const statsDir = resolve(outdir, 'stats');
const bundleStatsPlugin = createBundleStats(statsDir, resolve(root, 'stats.html'));
const workspaceRequire = createRequire(new URL('../../package.json', import.meta.url));
const localCore = localCoreDirectory();
const resolvePackage = name => resolveCorePackage(name, localCore) || workspaceRequire.resolve(name);
const budget = 1536 * 1024;
const published = process.argv.includes('--publish');
const minify = !process.argv.includes('--watch') || process.argv.includes('--minify');
const inputs = {};
let packageQueue = Promise.resolve();
const sharedRoot = resolve(resolvePackage('shared-vuejs/package.json'), '..');
const sharedDist = resolve(sharedRoot, 'dist');
const sizes = runtime => ({ raw: Buffer.byteLength(runtime), gzip: gzipSync(runtime).byteLength, brotli: brotliCompressSync(runtime).byteLength });
function options(entry, filename, globalName, wrapper, kind) {
  return {
    absWorkingDir: root, entryPoints: [entry], outfile: `dist/${filename}`, bundle: true,
    banner: { js: `function ${wrapper}() {` }, footer: { js: `return ${globalName}; }\nwindow.${globalName} = ${wrapper}();` },
    minify, format: 'iife', globalName, target: ['es2022'], charset: 'utf8',
    jsx: 'automatic', jsxImportSource: 'shared-vuejs/jsx', tsconfigRaw: { compilerOptions: { jsx: 'react-jsx', jsxImportSource: 'shared-vuejs/jsx' } },
    resolveExtensions: ['.tsx', '.ts', '.jsx', '.mjs', '.js', '.json'],
    alias: { 'vanjs-core': workspaceRequire.resolve('vanjs-core'), 'vanjs-ext': workspaceRequire.resolve('vanjs-ext') },
    define: { global: 'globalThis', 'process.env.NODE_ENV': '"production"', 'import.meta.env.DEV': 'false', 'process.versions.node': 'undefined' }, external: ['module', 'fs', 'path', 'url'], loader: { '.css': 'text', '.txt': 'text', '.wasm': 'binary' }, metafile: true, legalComments: 'none',
    sourcemap: localCore ? 'inline' : false,
    plugins: [...(localCore ? [{name:'local-core', setup(builder) {
      builder.onResolve({filter:/^(shared-vuejs(?:\/|$)|@desq\/player(?:\/|$))/}, args => ({path:resolveCorePackage(args.path, localCore)}));
    }}] : []), { name: 'native-editor-boundaries', setup(builder) {
      builder.onResolve({ filter: /^(vue|vue-router|pinia|naive-ui|@vicons\/|@vue\/|@vueuse\/)/ }, args => ({ errors: [{ text: `The standalone editor cannot import ${args.path}.` }] }));
      if (kind === 'editor') {
        builder.onLoad({ filter: /[\\/]edlib[\\/]common[\\/]inout[\\/]downloadShape\.js$/ }, async args => {
          const source = await readFile(args.path, 'utf8');
          const catalogue = 'const { googleFonts } = await import("../../../lib/googleFonts.js");';
          if (!source.includes(catalogue)) throw Error('Shape font detection changed; update the standalone font integration.');
          // The document already records its Google fonts. Keep the font loader
          // and use that metadata for picture export without the full catalogue.
          const replacement = 'const googleFonts = (vStaticSlides.fileInfo?.fonts || []).filter(font => font.type === "google").map(font => [font.family]);';
          return { contents: source.replace(catalogue, replacement), loader: 'ts', resolveDir: resolve(args.path, '..'), watchFiles: [args.path] };
        });
        // Shared editing modules refer to the Office archive pipeline for the
        // Vue host. The standalone canvas has its own document store and only
        // saves HTML/ZIP, so those operations are unavailable here.
        builder.onResolve({ filter: /(?:^|\/)(?:unzipPPTX|pptxArchive|updateSlideXml|slidePackage|import-txml)(?:\.js)?$/ }, args => {
          const name = args.path.split('/').pop().replace(/\.js$/, '');
          const source = resolve(sharedDist, 'edlib/pptx', name === 'import-txml' ? 'import/import-txml.js' : name + '.js');
          return { path: source, namespace: 'office-archive-disabled' };
        });
        builder.onLoad({ filter: /.*/, namespace: 'office-archive-disabled' }, async args => {
          const source = await readFile(args.path, 'utf8');
          const contents = disabledOfficeModule(source);
          return { contents, loader: 'js', watchFiles: [args.path] };
        });
        builder.onLoad({ filter: /[\\/]edlib[\\/]common[\\/]inout[\\/]upload\.js$/ }, async args => {
          const source = await readFile(args.path, 'utf8');
          const importLine = 'import { optimizeDeckVideos } from "../media/video-optimization.js";';
          const optimizeBlock = /\s*if \(\/\\\.\(mp4\|m4v\|mov\|avi\)\$\/i\.test\(blobId\)\) \{\s*void optimizeDeckVideos\(fileId, true\)\.catch\(\(error\) => console\.warn\("Video optimization unavailable:", error\)\);\s*\}/;
          if (!source.includes(importLine) || !optimizeBlock.test(source)) throw Error('Video upload optimization changed; update the standalone upload integration.');
          return { contents: source.replace(importLine, '').replace(optimizeBlock, ''), loader: 'ts', resolveDir: resolve(args.path, '..'), watchFiles: [args.path] };
        });
      }
      if (kind === 'editor' || kind === 'presentation') {
        // Charts are rendered by the Vue host before transfer to VanJS.
        builder.onLoad({ filter: /[\\/]lib[\\/]chart[\\/]chart\.js$/ }, () => ({ contents:
          'export const processChart=(shape)=>shape.chartSvg?.replace(/<svg width="[^"]*" height="[^"]*"/, `<svg width="${shape.w}rem" height="${shape.h}rem"`) || `<svg width="${shape.w}rem" height="${shape.h}rem"><text x="8" y="20">Chart preview unavailable</text></svg>`; export const resizeChart=()=>{};', loader: 'js' }));
      }
      builder.onEnd(result => {
        if (result.errors.length) return;
        const files = Object.keys(result.metafile.inputs);
        const forbidden = files.filter(name => /node_modules\/(?:vue|@vue|vue-router|pinia|naive-ui|@vicons)\//.test(name) ||
          (kind === 'editor' && /(?:^|\/)player\/src\//.test(name)) ||
          (kind === 'editor' && !name.startsWith('office-archive-disabled:') && /shared-vuejs\/dist\/edlib\/(?:common\/media\/(?:video-optimization|optimize-video\.worker)|pubbridge\/|pptx\/(?:import\/|unzipPPTX|pptxArchive|updateSlideXml|slidePackage|export\/))/.test(name)));
        if (forbidden.length) throw Error(`Renderer crossed an editor dependency boundary: ${forbidden.join(', ')}`);
        inputs[kind] = files.map(name => relative(root, resolve(root, name)));
        if (kind === 'editor') {
          packageQueue = packageQueue.then(packageBuild);
          return packageQueue;
        }
      });
    } }, bundleStatsPlugin(kind)],
  };
}
async function packageBuild() {
  const [runtime, presentation, player, playerStyles, styles] = await Promise.all(['dist/editor.js', 'dist/presentation.js', 'dist/player.js', 'dist/player.css', 'src/style.css'].map(name => readFile(resolve(root, name), 'utf8')));
  const playerAssets = await Promise.all([
    ['Carlito.woff2', 'font/woff2'],
  ].map(async ([name, mime]) => ({ name: `assets/fonts/${name}`, mime, data: await readFile(resolve(root, `../editor-vuejs/public/fonts/${name}`)) })));
  // The renderer's getStyles() combines the exact shared CSS. Reuse its source
  // files here too, without executing browser rendering code in Node.
  const rendererStyles = (await Promise.all(['slide.css', 'math.css', 'tight-wrap.css', 'selection-handles.css'].map(name => readFile(resolve(sharedDist, 'assets', name), 'utf8'))))
    .join('\n').replace(/@font-face\s*\{[^}]*\}/gi, '').replace(/(-?(?:\d*\.?\d+))rem\b/g, '$1px');
  const report = { editor: { ...sizes(runtime), gzipBudget: budget }, inputs };
  if (!localCore && report.editor.gzip > budget) throw Error('Editor exceeded its gzip budget.');
  const doc = blankDocument(); doc.file.name = 'Editable HTML'; doc.slides[0].name = 'Welcome';
  const text = createShape('text', doc.file); text.x = 80; text.y = 80; text.w = 1100; text.h = 180;
  setText(text, 'Every HTML file can be editable.\nDouble-click this text to start.'); doc.slides[0].shapes.push(text);
  const entries = await packageEntries(doc, runtime, styles, { rendererStyles, player, playerStyles, playerAssets });
  for (const entry of entries) { await mkdir(resolve(outdir, entry.name, '..'), { recursive: true }); await writeFile(resolve(outdir, entry.name), entry.data); }
  await writeFile(resolve(outdir, 'editable-editor.zip'), new Uint8Array(await createZip(entries).arrayBuffer()));
  await writeFile(resolve(outdir, 'bundle-report.json'), JSON.stringify(report, null, 2));
  if (published) {
    const publicRoot = localCore ? resolve(root, '../.desq-local-assets') : resolve(root, '../editor-vuejs/public');
    await mkdir(publicRoot, {recursive:true});
    // Remove the obsolete optional runtime so Vue's public directory cannot
    // carry it into later builds after charts moved to SVG previews.
    await rm(resolve(publicRoot, 'editor-vanjs-charts.js'), { force: true });
    await rm(resolve(publicRoot, 'editor-vanjs-renderer.js'), { force: true });
    for (const [name, data] of Object.entries({ 'editor-vanjs.js': runtime, 'editor-vanjs.css': styles,
      'editor-vanjs-renderer.css': rendererStyles,
      'editor-vanjs-player.js': player })) {
      await writeFile(resolve(publicRoot, name), data);
    }
  }
  console.log(`Editor gzip ${report.editor.gzip} bytes. dist/editable-editor.zip`);
}
await mkdir(outdir, { recursive: true });
await Promise.all(['video-worker.txt', 'video-worker.meta.json', 'charts.html', 'charts.meta.json', 'renderer.html', 'renderer.meta.json'].map(name => rm(resolve(statsDir, name), { force: true })));
await Promise.all(['charts.js', 'renderer.js'].map(name => rm(resolve(outdir, name), { force: true })));
// Use released standalone assets without rebuilding the player source.
const playerBundle = await readFile(resolvePackage('@desq/player/vanjs.js'));
const playerStyles = await readFile(resolvePackage('@desq/player/player.css'));
await writeFile(resolve(outdir, 'player.js'), playerBundle);
await writeFile(resolve(outdir, 'player.css'), playerStyles);
for (const [name, output, data] of [['player', 'dist/player.js', playerBundle], ['player-css', 'dist/player.css', playerStyles]]) {
  const input = `@desq/player/${name === 'player' ? 'vanjs.js' : 'player.css'}`;
  await bundleStatsPlugin.record(name, { inputs: { [input]: { bytes: data.length, imports: [] } },
    outputs: { [output]: { bytes: data.length, inputs: { [input]: { bytesInOutput: data.length } } } } });
}
if (published) {
  if (!localCore) await rm(resolve(root, '../editor-vuejs/public/player'), {recursive:true,force:true});
  await mkdir(resolve(root, '../editor-vuejs/public/player'), { recursive: true });
  await writeFile(resolve(root, '../editor-vuejs/public/player/player.js'), await readFile(resolvePackage('@desq/player/player.js')));
  await writeFile(resolve(root, '../editor-vuejs/public/player/player.css'), playerStyles);
  await mkdir(resolve(root, '../editor-vuejs/public/player/css'), { recursive: true });
  await writeFile(resolve(root, '../editor-vuejs/public/player/css/player.css'), playerStyles);
}
await build(options('src/presentation-entry.jsx', 'presentation.js', 'DesqPresentation', 'desqPresentationRuntime', 'presentation'));
if (published) {
  const publicRoot = localCore ? resolve(root, '../.desq-local-assets') : resolve(root, '../editor-vuejs/public');
  await mkdir(publicRoot, { recursive: true });
  await writeFile(resolve(publicRoot, 'editor-vanjs-presentation.js'), await readFile(resolve(outdir, 'presentation.js')));
  await writeFile(resolve(publicRoot, 'editor-vanjs-player.css'), playerStyles);
}
const configurations = [options('src/index.jsx', 'editor.js', 'DesqVanEditor', 'desqVanRuntime', 'editor')];
if (process.argv.includes('--watch')) {
  const contexts = await Promise.all(configurations.map(c => context(c)));
  await Promise.all(contexts.map(c => c.watch()));
  const server = await contexts[0].serve({ servedir: outdir, host: '127.0.0.1', port: 5174 });
  console.log(`Editor: http://${server.hosts[0]}:${server.port}`);
} else for (const configuration of configurations) await build(configuration);
