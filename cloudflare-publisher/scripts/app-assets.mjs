import { readdir, stat, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const directory = fileURLToPath(new URL("../", import.meta.url));
const config = JSON.parse(await readFile(resolve(directory, "wrangler.jsonc"), "utf8"));
const assetsDirectory = resolve(directory, config.assets.directory);
const bucket = config.r2_buckets.find(binding => binding.binding === "APP_FILES")?.bucket_name;
if (!bucket) throw new Error("APP_FILES R2 binding is missing");
const largeFiles = [];
async function scan(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const fullPath = resolve(path, entry.name);
    if (entry.isDirectory()) await scan(fullPath);
    else if (entry.isFile() && (await stat(fullPath)).size > 25 * 1024 * 1024) {
      largeFiles.push({ fullPath, key: relative(assetsDirectory, fullPath).replaceAll("\\", "/") });
    }
  }
}
await scan(assetsDirectory);
largeFiles.sort((a, b) => a.key.localeCompare(b.key));
await writeFile(resolve(assetsDirectory, ".assetsignore"),
  ["# Generated: large application assets are served from APP_FILES R2.",
    ...largeFiles.map(file => `/${file.key}`), ""].join("\n"));
config.vars.APP_LARGE_ASSET_PATHS = largeFiles.map(file => `/${file.key}`).join(",");
await writeFile(resolve(directory, "wrangler.generated.json"), JSON.stringify(config, null, 2) + "\n");
console.log(`Prepared Cloudflare app assets: ${largeFiles.length} large files routed to R2`);
if (process.argv.includes("--upload")) {
  for (const file of largeFiles) {
    const result = spawnSync("npx", ["--no-install", "wrangler", "r2", "object", "put",
      `${bucket}/${file.key}`, "--file", file.fullPath, "--content-type", "application/octet-stream", "--remote"],
    { cwd: directory, stdio: "inherit" });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status || 1);
  }
}
