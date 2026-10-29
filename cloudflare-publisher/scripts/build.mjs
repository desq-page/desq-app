import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { existsSync } from "node:fs";
import { cp, rm } from "node:fs/promises";

const root = fileURLToPath(new URL("../../", import.meta.url));
// npm is a .cmd shim on Windows; run its JavaScript CLI directly.
const npmCli = process.env.npm_execpath || join(dirname(process.execPath), "node_modules/npm/bin/npm-cli.js");
const useCli = existsSync(npmCli);
// Production resolves the installed shared library, not the development watcher.
// The add-in is a sibling repository; never deploy a stale or missing copy.
const officeDirectory = resolve(process.env.SAVANNA_OFFICEJS_DIR || resolve(root, '../desq-officejs'));
if (!existsSync(resolve(officeDirectory, 'package.json'))) {
  throw new Error(`PowerPoint add-in not found at ${officeDirectory}. Check out desq-officejs or set SAVANNA_OFFICEJS_DIR.`);
}
for (const directory of [resolve(root, 'editor-vuejs'), officeDirectory]) {
  const executable = useCli ? process.execPath : process.platform === "win32" ? (process.env.ComSpec || "cmd.exe") : "npm";
  const args = useCli ? [npmCli, "run", "build"] : process.platform === "win32" ? ["/d", "/s", "/c", "npm run build"] : ["run", "build"];
  const result = spawnSync(executable, args, {
    cwd: directory, stdio: "inherit",
    env: { ...process.env, VITE_PUBLISH_TARGET: "cloudflare" },
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
