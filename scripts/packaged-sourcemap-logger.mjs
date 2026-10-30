import { resolve } from 'node:path';

// Packaged shared-vuejs contains maps without the original source files.
export function suppressPackagedSourcemapWarnings(logger, appRoot) {
  const packageRoot = resolve(appRoot, 'node_modules/shared-vuejs').replaceAll('\\', '/') + '/';
  const warnOnce = logger.warnOnce.bind(logger);
  logger.warnOnce = (message, ...args) => {
    const match = /^Sourcemap for "([^"]+)" points to missing source files$/.exec(message);
    if (match && match[1].replaceAll('\\', '/').startsWith(packageRoot)) return;
    return warnOnce(message, ...args);
  };
  return logger;
}
