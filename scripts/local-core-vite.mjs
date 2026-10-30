import path from 'node:path';
import {searchForWorkspaceRoot} from 'vite';
import {appRoot, localCoreDirectory, resolveCorePackage, localBuildMarker} from './local-core.mjs';

export function localCorePlugin(core = localCoreDirectory()) {
  if (!core) return null;
  const shared = path.join(core, 'shared-vuejs/dist') + path.sep;
  const player = path.join(core, 'player/dist') + path.sep;
  const isCoreOutput = file => file.startsWith(shared) || file.startsWith(player);
  return {
    name: 'desq-local-core', apply: 'serve', enforce: 'pre',
    config() {
      return {
        resolve: {dedupe: ['vue', 'vanjs-core', 'vanjs-ext']},
        optimizeDeps: {exclude: ['shared-vuejs', '@desq/player']},
        server: {fs: {allow: [searchForWorkspaceRoot(appRoot), core]}},
      };
    },
    resolveId(specifier) { return resolveCorePackage(specifier, core); },
    configureServer(server) { server.watcher.add(localBuildMarker); },
    handleHotUpdate({file, server}) {
      // Shared stores have side effects: reload only after a whole core build,
      // rather than hot-replacing individual files while dist is being updated.
      if (file === localBuildMarker) {
        server.moduleGraph.invalidateAll();
        server.ws.send({type:'full-reload'});
        server.config.logger.info('[local core] rebuilt; browser reloaded');
        return [];
      }
      if (isCoreOutput(file)) return [];
    },
  };
}
