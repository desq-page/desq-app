import { createHash } from 'node:crypto';

// Keep the lock usable even if the following npm install is interrupted.
// Repacking the same filename requires refreshing its integrity explicitly.
export function refreshSharedLibraryLock(lock, manifest, tarball) {
  const name = `shared-vuejs-${manifest.version}.tgz`;
  lock.packages['editor-vuejs'].dependencies['shared-vuejs'] = `file:../packages/${name}`;
  const entry = {
    version: manifest.version,
    resolved: `file:packages/${name}`,
    integrity: `sha512-${createHash('sha512').update(tarball).digest('base64')}`,
  };
  for (const key of ['license', 'dependencies', 'optionalDependencies', 'peerDependencies',
    'peerDependenciesMeta', 'engines', 'os', 'cpu', 'bin']) {
    if (manifest[key] !== undefined) entry[key] = manifest[key];
  }
  lock.packages['node_modules/shared-vuejs'] = entry;
  return lock;
}
