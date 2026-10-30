import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import {localCoreDirectory, localBuildMarker} from './local-core.mjs';

const script = fileURLToPath(new URL('../editor-vanjs/scripts/build.mjs', import.meta.url));
const assets = /^\/editor-vanjs(?:-renderer|-charts|-player|-presentation)?\.(?:js|css)$/;

function buildAssets() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, '--publish'], { stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code, signal) => code === 0 ? resolve() : reject(new Error(`VanJS development build failed (${signal || code}).`)));
  });
}

// The Vue editor does not need these assets. Build them once, on first use of
// the VanJS route, including when older generated files are already present.
export function vanEditorDevPlugin(build = buildAssets, readAsset = name => readFile(new URL(name.slice(1), new URL(localCoreDirectory() ? '../.desq-local-assets/' : '../editor-vuejs/public/', import.meta.url)))) {
  // The packaged shared library works without a source watcher.
  let pending, builtGeneration = -1, generation = 0;
  function ensureBuilt() {
    if (pending) return pending;
    if (builtGeneration === generation) return Promise.resolve();
    const targetGeneration = generation;
    pending = Promise.resolve().then(build).then(() => {
      builtGeneration = targetGeneration;
      pending = null;
      // If core changed during a build, finish it before starting the next.
      return ensureBuilt();
    }, error => { pending = null; throw error; });
    return pending;
  }
  return {
    name: 'van-editor-dev-assets',
    apply: 'serve',
    configureServer(server) {
      if (localCoreDirectory()) {
        server.watcher.add(localBuildMarker);
        server.watcher.on('change', file => { if (file === localBuildMarker) generation++; });
      }
      server.middlewares.use((req, res, next) => {
        const path = new URL(req.url || '/', 'http://localhost').pathname;
        if (!assets.test(path)) return next();
        ensureBuilt().then(() => readAsset(path)).then(contents => {
          res.setHeader('Content-Type', path.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8');
          res.end(req.method === 'HEAD' ? undefined : contents);
        }).catch(error => {
          server.config.logger.error(error.message);
          res.statusCode = 500;
          res.end('Unable to build VanJS editor assets. See server logs.');
        });
      });
    },
  };
}
