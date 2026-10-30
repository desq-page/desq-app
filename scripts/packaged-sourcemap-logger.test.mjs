import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { suppressPackagedSourcemapWarnings } from './packaged-sourcemap-logger.mjs';

test('only missing source warnings from the packaged shared library are suppressed', () => {
  const messages = [];
  const logger = suppressPackagedSourcemapWarnings({warnOnce: message => messages.push(message)}, resolve('.'));
  const shared = resolve('node_modules/shared-vuejs/dist/example.js');
  const other = resolve('node_modules/another-package/example.js');
  logger.warnOnce(`Sourcemap for "${shared}" points to missing source files`);
  logger.warnOnce(`Sourcemap for "${other}" points to missing source files`);
  logger.warnOnce(`Another warning for "${shared}"`);
  assert.deepEqual(messages, [
    `Sourcemap for "${other}" points to missing source files`,
    `Another warning for "${shared}"`,
  ]);
});
