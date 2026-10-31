import { cp, readFile, realpath, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve, sep } from 'node:path';

// Replace installed package outputs, not their tracked release archives or lockfiles.
// The caller builds the core first; failures must stop the deployment.
export async function stageCore(core, consumers) {
  const packages = [
    ['shared-vuejs', 'shared-vuejs'],
    ['@desq/player', 'player'],
  ];
  const staged = new Set();
  for (const consumer of consumers) {
    const require = createRequire(resolve(consumer, 'package.json'));
    for (const [name, directory] of packages) {
      const source = resolve(core, directory);
      const target = dirname(require.resolve(`${name}/package.json`));
      const [sourcePath, targetPath] = await Promise.all([realpath(source), realpath(target)]);
      if (targetPath === sourcePath || targetPath.startsWith(sourcePath + sep)) {
        throw new Error(`Refusing to overwrite the core checkout while staging ${name}: ${targetPath}`);
      }
      if (staged.has(targetPath)) continue;
      const manifest = JSON.parse(await readFile(resolve(sourcePath, 'package.json'), 'utf8'));
      if (manifest.name !== name) throw new Error(`Unexpected core package at ${sourcePath}`);
      // Copy into a fresh temporary directory before replacing the installed dist.
      const temporary = resolve(targetPath, '.desq-core-dist');
      await rm(temporary, { recursive: true, force: true });
      await cp(resolve(sourcePath, 'dist'), temporary, { recursive: true });
      await rm(resolve(targetPath, 'dist'), { recursive: true, force: true });
      await cp(temporary, resolve(targetPath, 'dist'), { recursive: true });
      await rm(temporary, { recursive: true, force: true });
      await cp(resolve(sourcePath, 'package.json'), resolve(targetPath, 'package.json'));
      staged.add(targetPath);
      console.log(`[core] staged ${name}@${manifest.version} for ${consumer}`);
    }
  }
}
