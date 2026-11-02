import {transform} from 'esbuild';

// Public/embedded player assets are copied outside Vite's module pipeline.
export async function preparePlayerScript(source, production = process.env.PROD === '1') {
  if (!production) return source;
  return (await transform(String(source), {
    loader: 'js', target: 'es2022', minify: true, drop: ['console', 'debugger'], legalComments: 'none',
  })).code;
}
