import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {existsSync, writeFileSync, rmSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {appRoot, localBuildMarker} from './local-core.mjs';
import {preparePlayerAssets} from './prepare-player-assets.mjs';

const core = resolve(appRoot, process.env.DESQ_CORE_DIR || '../desq-core');
const env = {...process.env, DESQ_LOCAL_CORE:'1', DESQ_CORE_DIR:core};
const children = new Set();
let stopping = false, timer, generation = 0, playerReady = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  clearTimeout(timer);
  for (const child of children) child.kill('SIGTERM');
  rmSync(localBuildMarker, {force:true});
  process.exitCode = code;
}
function rebuilt() {
  if (!playerReady) return;
  clearTimeout(timer);
  timer = setTimeout(async () => {
    try {
      if (stopping) return;
      await preparePlayerAssets(core);
      if (!stopping) writeFileSync(localBuildMarker, JSON.stringify({generation:++generation}));
    } catch (error) { console.error(error.message); stop(1); }
  }, 250);
}
function watch(script, cwd, args, onLine) {
  let ready = false;
  return new Promise((resolveReady, reject) => {
    const child = spawn(process.execPath, [script, ...args], {cwd, env, stdio:['ignore','pipe','inherit']});
    children.add(child);
    let buffer = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      buffer += chunk;
      let newline;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0,newline).trim(); buffer = buffer.slice(newline+1);
        const complete = onLine(line);
        if (complete && !ready) {ready = true; resolveReady(child);}
      }
    });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      children.delete(child);
      if (stopping) return;
      const error = Error(`Local core watcher stopped (${signal || code}): ${script}`);
      if (!ready) reject(error);
      else { console.error(error.message); stop(1); }
    });
  });
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
try {
  for (const directory of ['shared-vuejs','player']) {
    if (!existsSync(resolve(core,directory,'package.json'))) throw Error(`Core checkout not found: ${core}. Set DESQ_CORE_DIR to its location.`);
  }
  const requireCore = createRequire(resolve(core,'package.json'));
  for (const dependency of ['esbuild','typescript']) {
    try {requireCore.resolve(dependency);} catch {throw Error(`Run npm ci in ${core} before starting local development (missing ${dependency}).`);}
  }
  console.log(`[local core] ${core}`);
  await watch(resolve(core,'shared-vuejs/scripts/watch.mjs'), resolve(core,'shared-vuejs'), [], line => {
    if (line.startsWith('SHARED_VUEJS_BUILD_COMPLETE ')) {
      console.log('[local core] shared library ready'); rebuilt(); return true;
    }
    if (line.startsWith('SHARED_VUEJS_BUILD_ERROR ')) console.error('[local core] shared build failed; fix the source to retry');
    else if (line) console.log(line);
    return false;
  });
  if (!stopping) {
    const completed = new Set();
    await watch(resolve(core,'player/esbuild.js'), resolve(core,'player'), ['--watch','--dev'], line => {
      if (line.startsWith('DESQ_PLAYER_BUILD_COMPLETE ')) {
        completed.add(JSON.parse(line.slice('DESQ_PLAYER_BUILD_COMPLETE '.length)).file);
        rebuilt();
        return completed.size === 4;
      }
      if (line) console.log(line);
      return false;
    });
    playerReady = true;
    await preparePlayerAssets(core);
    writeFileSync(localBuildMarker, JSON.stringify({generation:++generation}));
    console.log('[local core] player ready');
  }
  if (!stopping && process.argv.includes('--check')) {
    console.log('[local core] startup check passed'); stop();
  } else if (!stopping) {
    const require = createRequire(import.meta.url);
    const vite = resolve(dirname(require.resolve('vite/package.json')), 'bin/vite.js');
    const child = spawn(process.execPath,[vite,...process.argv.slice(2)],{cwd:resolve(appRoot,'editor-vuejs'),env,stdio:'inherit'});
    children.add(child);
    child.on('error', error => {console.error(error); stop(1);});
    child.on('exit', code => {children.delete(child); stop(code || 0);});
  }
} catch (error) {
  console.error(error.message); stop(1);
}
