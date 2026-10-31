import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { existsSync } from "node:fs";
import { cp, rm } from "node:fs/promises";
import { stageCore } from './stage-core.mjs';

const root = fileURLToPath(new URL("../../", import.meta.url));
// npm is a .cmd shim on Windows; run its JavaScript CLI directly.
const npmCli = process.env.npm_execpath || join(dirname(process.execPath), "node_modules/npm/bin/npm-cli.js");
const useCli = existsSync(npmCli);
// Production uses compiled core packages, not the development watcher.
const coreDirectory = resolve(process.env.DESQ_CORE_DIR || resolve(root, '../desq-core'));
const officeDirectory = resolve(process.env.DESQ_OFFICEJS_DIR || resolve(root, '../desq-officejs'));
if (!existsSync(resolve(coreDirectory, 'package.json'))) {
  throw new Error(`Core not found at ${coreDirectory}. Check out desq-core or set DESQ_CORE_DIR.`);
}
if (!existsSync(resolve(officeDirectory, 'package.json'))) {
  throw new Error(`PowerPoint add-in not found at ${officeDirectory}. Check out desq-officejs or set DESQ_OFFICEJS_DIR.`);
}
const productionEnv = { ...process.env, VITE_PUBLISH_TARGET: 'cloudflare' };
delete productionEnv.DESQ_LOCAL_CORE;
let coreStaged = false;
for (const directory of [coreDirectory, resolve(root, 'editor-vuejs'), officeDirectory]) {
  if (directory !== coreDirectory && !coreStaged) {
    await stageCore(coreDirectory, [root, officeDirectory]);
    coreStaged = true;
  }
  const executable = useCli ? process.execPath : process.platform === "win32" ? (process.env.ComSpec || "cmd.exe") : "npm";
  const args = useCli ? [npmCli, "run", "build"] : process.platform === "win32" ? ["/d", "/s", "/c", "npm run build"] : ["run", "build"];
  const result = spawnSync(executable, args, {
    cwd: directory, stdio: "inherit",
    env: productionEnv,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
const addinOutput = resolve(officeDirectory, 'dist');
if (!existsSync(resolve(addinOutput, 'index.html'))) throw new Error('PowerPoint add-in build did not produce dist/index.html.');
const addinTarget = resolve(root, 'editor-vuejs/dist/powerpoint-addin');
await rm(addinTarget, { recursive: true, force: true });
await cp(addinOutput, addinTarget, { recursive: true });
// Generate the asset exclusions and deployment config without uploading yet.
await import("./app-assets.mjs");
