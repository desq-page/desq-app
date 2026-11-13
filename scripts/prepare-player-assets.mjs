import {preparePlayerScript} from './player-production.mjs';
import {prepareAuthoringAssets} from './prepare-authoring-assets.mjs';
import {createRequire} from 'node:module';
import {mkdir,copyFile,access,rm,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {localCoreDirectory, resolveCorePackage} from './local-core.mjs';
const require=createRequire(import.meta.url);
export async function preparePlayerAssets(core = localCoreDirectory()) {
  await prepareAuthoringAssets();
  const resolvePackage = name => resolveCorePackage(name, core) || require.resolve(name);
  const target=new URL('../editor-vuejs/public/player/',import.meta.url);
  // Switching back from local development must not ship private development maps.
  if (!core) await rm(target,{recursive:true,force:true});
  await mkdir(new URL('css/',target),{recursive:true});
  await Promise.all(['frame-player.js','frame-player.js.map','native-player.js','native-player.js.map','anime-player.js','anime-player.js.map'].map(name => rm(new URL(name,target),{force:true})));
  for (const [name,destinations] of [['player.js',['player.js']],['player.css',['css/player.css','player.css']]]) {
    const source=resolvePackage('@desq/player/'+name);
    for (const destination of destinations) {
      if (name.endsWith('.js')) await writeFile(new URL(destination,target), await preparePlayerScript(await readFile(source)));
      else await copyFile(source,new URL(destination,target));
      if (core && process.env.PROD !== '1') {
        try {await access(source+'.map');} catch {continue;}
        await copyFile(source+'.map',new URL(destination+'.map',target));
      }
    }
  }
  const publicRoot = new URL('../editor-vuejs/public/', import.meta.url);
  const sharedAssets = [
    ['presentation.txt', 'editor-vanjs-presentation.js'],
    ['player.css', 'editor-vanjs-player.css'],
    ['player_tpl.html', 'player_tpl.html'],
    ['a_pixel.png', 'images/a_pixel.png'],
    ['tableStyles.xml', 'defaults/tableStyles.xml'],
    ...['Carlito.woff2', 'Carlito.woff', 'Carlito-Regular.ttf', 'Symbola.woff2'].map(name => [name, `fonts/${name}`]),
  ];
  for (const [name, destination] of sharedAssets) {
    const dest = new URL(destination, publicRoot);
    await mkdir(new URL('.', dest), { recursive: true });
    const source = resolvePackage(`shared-vuejs/assets/single-html/${name}`);
    if (destination.endsWith('.js')) await writeFile(dest, await preparePlayerScript(await readFile(source)));
    else await copyFile(source, dest);
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await preparePlayerAssets();
