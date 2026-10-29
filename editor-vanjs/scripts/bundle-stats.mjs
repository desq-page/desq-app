import { visualizer } from 'rollup-plugin-visualizer';
import { version as esbuildVersion } from 'esbuild';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

// The visualizer consumes Rollup chunks; translate esbuild's actual per-output
// byte counts into the equivalent chunk/module data, without rebundling.
export async function writeBundleStats(name, metafile, directory, reportPath = join(directory, `${name}.html`)) {
  await mkdir(directory, { recursive: true });
  const graphPath = join(directory, `${name}.meta.json`);
  await Promise.all([
    writeFile(graphPath, JSON.stringify(metafile, null, 2) + '\n'),
    rm(join(directory, `${name}.txt`), { force: true }),
  ]);
  const chunks = {};
  for (const [output, info] of Object.entries(metafile.outputs)) {
    const modules = {};
    let accounted = 0;
    for (const [id, contribution] of Object.entries(info.inputs)) {
      if (contribution.bytesInOutput > 0) {
        accounted += contribution.bytesInOutput;
        // The plugin calculates rendered size from code. Spaces represent the
        // exact byte count reported by esbuild; compression sizes stay disabled.
        modules[id] = { renderedLength: contribution.bytesInOutput, code: ' '.repeat(contribution.bytesInOutput) };
      }
    }
    const overhead = Math.max(0, info.bytes - accounted);
    if (overhead) modules[`[generated output, including inline source maps]`] = {
      renderedLength: overhead, code: ' '.repeat(overhead),
    };
    chunks[output] = { type: 'chunk', modules, code: '', facadeModuleId: info.entryPoint || null };
  }
  const context = {
    meta: { rollupVersion: `esbuild ${esbuildVersion}` },
    getModuleInfo(id) {
      const input = metafile.inputs[id];
      if (!input) return null;
      return { isEntry: Object.values(metafile.outputs).some(output => output.entryPoint === id),
        isExternal: false, importedIds: input.imports.filter(item => !item.external && item.kind !== 'dynamic-import').map(item => item.path),
        dynamicallyImportedIds: input.imports.filter(item => !item.external && item.kind === 'dynamic-import').map(item => item.path) };
    },
    warn(message) { console.warn(message); },
    error(message) { throw Error(message); },
  };
  const plugin = visualizer({ filename: reportPath, title: `VanJS ${name} bundle`, template: 'treemap' });
  await plugin.generateBundle.call(context, {}, chunks);
  console.log(`[bundle stats] ${name}: ${reportPath}`);
}

export function createBundleStats(directory, combinedReport) {
  const graphs = new Map();
  let queue = Promise.resolve();
  function record(name, metafile) {
    graphs.set(name, metafile);
    queue = queue.then(async () => {
      await writeBundleStats(name, metafile, directory);
      const merged = { inputs: {}, outputs: {} };
      for (const graph of graphs.values()) {
        Object.assign(merged.inputs, graph.inputs);
        Object.assign(merged.outputs, graph.outputs);
      }
      await writeBundleStats('combined', merged, directory, combinedReport);
    });
    return queue;
  }
  function bundleStatsPlugin(name) {
  return {
    name: `bundle-stats-${name}`,
    setup(builder) {
      builder.onEnd(async result => {
        if (result.errors.length || !result.metafile) return;
        await record(name, result.metafile);
      });
    },
  };
  }
  bundleStatsPlugin.record = record;
  return bundleStatsPlugin;
}
