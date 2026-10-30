import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projects = new Map();
const warnings = new Set();
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const licenseName = value => typeof value === 'string' ? value : value?.type || 'Not specified';
const legalFile = name => /^(licen[cs]e|notice|copying|copyright)([._-]|$)/i.test(name);

function legalTexts(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isFile() && legalFile(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(entry => ({ file: entry.name, text: fs.readFileSync(path.join(directory, entry.name), 'utf8').replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, '').trim() }));
}

// Follow runtime dependencies from the lockfile, including installed peer and
// optional dependencies. Development-only roots are intentionally excluded.
function collect(lockDirectory, workspacePaths) {
  const lock = readJson(path.join(lockDirectory, 'package-lock.json'));
  const packages = lock.packages;
  const visited = new Set();
  function resolveDependency(from, name) {
    let location = from;
    while (true) {
      const candidate = path.posix.join(location, 'node_modules', name);
      if (packages[candidate]) return candidate;
      if (!location || location === '.') return undefined;
      location = path.posix.dirname(location);
      if (location === '.') location = '';
    }
  }
  function visit(location) {
    if (visited.has(location)) return;
    visited.add(location);
    const metadata = packages[location];
    if (metadata.link) return visit(metadata.resolved);
    const directory = path.join(lockDirectory, location);
    const manifestPath = path.join(directory, 'package.json');
    const manifest = fs.existsSync(manifestPath) ? readJson(manifestPath) : metadata;
    if (location.includes('node_modules/')) {
      const name = manifest.name || location.split('node_modules/').at(-1);
      const key = `${name}@${metadata.version || manifest.version}`;
      if (!projects.has(key)) {
        const texts = legalTexts(directory);
        if (!texts.length) warnings.add(`${key}: no standalone license/notice file found in installed package`);
        projects.set(key, {
          name, version: metadata.version || manifest.version,
          license: licenseName(manifest.license || metadata.license),
          url: typeof manifest.repository === 'string' ? manifest.repository : manifest.repository?.url || manifest.homepage || '',
          source: path.relative(root, directory), texts,
        });
      }
    }
    for (const name of Object.keys({ ...metadata.dependencies, ...metadata.optionalDependencies, ...metadata.peerDependencies })) {
      const dependency = resolveDependency(location, name);
      if (dependency) visit(dependency);
      else if (metadata.dependencies?.[name] && !metadata.optionalDependencies?.[name]) {
        throw new Error(`Missing locked dependency ${name} required by ${location || 'root'}`);
      }
    }
  }
  for (const workspace of workspacePaths) visit(workspace);
}

collect(root, ['', 'editor-vuejs', 'editor-vanjs', 'cloudflare-publisher']);
// Player dependencies are included through the application lockfile.

// Public assets are copied verbatim by Vite and may contain their own bundled
// dependencies. Preserve their supplied legal notices, as well as source copies.
function collectVendored(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (['node_modules', 'dist', '.git'].includes(entry.name)) continue;
    const file = path.join(directory, entry.name);
    if (file === path.join(root, 'editor-vuejs/public/NOTICE.txt')) continue;
    if (entry.isDirectory()) collectVendored(file);
    else if (legalFile(entry.name) || /\.LICENSE\.txt$/i.test(entry.name)) {
      const source = path.relative(root, file);
      const vendor = source.includes('/UDOC/') ? 'Photopea UDOC'
        : source.includes('/mini-van-plate/') ? 'VanJS mini-van-plate' : path.relative(root, directory);
      projects.set(`vendored:${source}`, {
        name: `Vendored notices: ${vendor}`,
        version: 'vendored', license: 'See supplied notice', url: '', source,
        texts: [{ file: entry.name, text: fs.readFileSync(file, 'utf8').replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, '').trim() }],
      });
    }
  }
}
const editorRequire = createRequire(path.join(root, 'editor-vuejs/package.json'));
const sharedDist = path.resolve(path.dirname(editorRequire.resolve('shared-vuejs/editor')), '..');
collectVendored(sharedDist);
collectVendored(path.join(root, 'editor-vuejs/public'));

// Locally adapted or inspirational sources do not appear in npm lockfiles.
for (const credit of readJson(path.join(root, 'scripts/local-open-source-credits.json'))) {
  projects.set(`local:${credit.name}`, credit);
}

const entries = [...projects.values()].sort((a, b) => `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`));
const intro = 'Desq — Third-party open-source notices\n\n'
  + 'Generated by scripts/generate-notices.mjs from installed package metadata, lockfiles, and supplied vendored notices.\n'
  + 'Includes declared runtime dependencies and their transitive dependencies for the editor, server, and player.\n'
  + 'This is a conservative inventory; some dependencies may be removed from browser bundles by tree shaking.\n'
  + 'License names are package declarations. Original supplied license and notice texts follow.\n'
  + 'Vendored bundle notices can cover multiple projects. Assets without supplied notices are not automatically identified.\n';
const notice = intro + '\nPROJECT INVENTORY\n\n'
  + entries.map(entry => `${entry.name} | ${entry.version} | ${entry.license} | ${entry.url || entry.source}`).join('\n')
  + '\n\nLICENSE AND COPYRIGHT TEXTS\n'
  + entries.map(entry => `\n${'='.repeat(78)}\n${entry.name} (${entry.version})\nLicense: ${entry.license}\nSource: ${entry.source}\n${entry.url ? `Project: ${entry.url}\n` : ''}\n`
    + (entry.texts.length ? entry.texts.map(item => `--- ${item.file} ---\n${item.text}\n`).join('\n') : 'No standalone license text supplied in the installed package; consult the project source.\n')).join('')
  + '\nMETADATA GAPS\n\n' + ([...warnings].sort().join('\n') || 'None.') + '\n';
const escape = value => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
const inventory = '# Open-source projects\n\nGenerated by `npm run notices`. See [NOTICE.txt](NOTICE.txt) for supplied license and copyright texts.\n\n'
  + 'Includes editor, server, and player runtime dependency trees plus vendored notice files. Development-only roots are excluded; browser tree shaking may remove some entries. Unidentified assets and missing standalone license texts require separate review.\n\n'
  + '| Project | Version | Declared license | Project/source |\n| --- | --- | --- | --- |\n'
  + entries.map(entry => `| ${escape(entry.name)} | ${escape(entry.version)} | ${escape(entry.license)} | ${escape(entry.url || entry.source)} |`).join('\n') + '\n';
fs.writeFileSync(path.join(root, 'NOTICE.txt'), notice);
fs.writeFileSync(path.join(root, 'OPEN_SOURCE_PROJECTS.md'), inventory);
fs.writeFileSync(path.join(root, 'editor-vuejs/public/NOTICE.txt'), notice);
console.log(`Generated notices for ${entries.length} entries (${warnings.size} missing standalone license texts).`);
