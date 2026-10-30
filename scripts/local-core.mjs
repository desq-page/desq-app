import {readFileSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve, sep} from 'node:path';

export const appRoot = fileURLToPath(new URL('../', import.meta.url));
export function localCoreDirectory(env = process.env) {
  if (env.DESQ_LOCAL_CORE !== '1') return null;
  return resolve(appRoot, env.DESQ_CORE_DIR || '../desq-core');
}
export function resolveCorePackage(specifier, core = localCoreDirectory()) {
  if (!core) return null;
  const name = specifier === '@desq/player' || specifier.startsWith('@desq/player/')
    ? '@desq/player' : specifier === 'shared-vuejs' || specifier.startsWith('shared-vuejs/') ? 'shared-vuejs' : null;
  if (!name) return null;
  const directory = resolve(core, name === 'shared-vuejs' ? 'shared-vuejs' : 'player');
  const manifestFile = resolve(directory, 'package.json');
  if (!existsSync(manifestFile)) throw Error(`Missing local core package at ${manifestFile}. Run npm ci in desq-core, or set DESQ_CORE_DIR.`);
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
  const key = specifier === name ? '.' : './' + specifier.slice(name.length + 1);
  const entry = manifest.exports?.[key];
  const target = typeof entry === 'string' ? entry : entry?.import || entry?.default;
  if (!target) throw Error(`Missing public local core export: ${specifier}`);
  const file = resolve(directory, target);
  if (!file.startsWith(directory + sep) || !existsSync(file)) throw Error(`Local core export is not built: ${file}. Start with npm run dev:local.`);
  return file;
}
export const localBuildMarker = resolve(appRoot, '.desq-local.json');
