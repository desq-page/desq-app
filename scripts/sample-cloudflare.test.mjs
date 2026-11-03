import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { resolve } from 'node:path';
import { isPublishedPath, reservedUsernames } from '../../desq-core/shared-vuejs/src/lib/published-path.js';

test('sample HTML routes to static assets rather than publication storage', async () => {
  assert.equal(reservedUsernames.has('samples'), true);
  for (const path of ['/samples/christmas-2026-claude.html', '/Samples/example.html', '/%73amples/example.html'])
    assert.equal(isPublishedPath(path), false);
  assert.equal(isPublishedPath('/hong/christmas-2026/'), true);
  const result = await build({entryPoints:[resolve(import.meta.dirname, '../cloudflare-publisher/src/worker.js')],bundle:true,write:false,platform:'node',format:'esm',plugins:[{name:'routing-test',setup(build){
    build.onResolve({filter:/^shared-vuejs\/api\/lib-published-path$/},()=>({path:resolve(import.meta.dirname,'../../desq-core/shared-vuejs/src/lib/published-path.js')}));
    build.onResolve({filter:/^\.\/agent\.js$/},()=>({path:'agent',namespace:'stub'}));
    build.onLoad({filter:/.*/,namespace:'stub'},()=>({contents:'export class AgentSession {} export function agentRequest() { throw Error("Unexpected agent request"); }'}));
  }}]});
  const {default:worker} = await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
  const seen = [];
  const env = {PUBLIC_ORIGIN:'https://desq.page',ASSETS:{fetch:async request=>{seen.push(new URL(request.url).pathname);return new Response('<html>sample</html>',{headers:{'Content-Type':'text/html'}});}}};
  const response = await worker.fetch(new Request('https://desq.page/samples/christmas-2026-claude.html'), env, {});
  assert.equal(response.status,200);
  assert.equal(await response.text(),'<html>sample</html>');
  assert.deepEqual(seen,['/samples/christmas-2026-claude.html']);
});
