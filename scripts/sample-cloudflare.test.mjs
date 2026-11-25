import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { resolve } from 'node:path';
import { isPublishedPath, reservedUsernames } from '../../desq-core/shared-vuejs/src/lib/published-path.js';

test('samples and Iconify files route to static assets rather than publication storage', async () => {
  assert.equal(reservedUsernames.has('samples'), true);
  assert.equal(reservedUsernames.has('iconify'), true);
  for (const path of ['/samples/christmas-2026-claude.html', '/Samples/example.html', '/%73amples/example.html',
    '/iconify/collections.json', '/iconify/sets/lucide.json.gz', '/%69conify/collections.json'])
    assert.equal(isPublishedPath(path), false);
  assert.equal(isPublishedPath('/hong/christmas-2026/'), true);
  const result = await build({entryPoints:[resolve(import.meta.dirname, '../../cloudflare-publisher/src/worker.js')],bundle:true,write:false,platform:'node',format:'esm',plugins:[{name:'routing-test',setup(build){
    build.onResolve({filter:/^shared-vuejs\/api\/lib-published-path$/},()=>({path:resolve(import.meta.dirname,'../../desq-core/shared-vuejs/src/lib/published-path.js')}));
    build.onResolve({filter:/^\.\/agent\.js$/},()=>({path:'agent',namespace:'stub'}));
    build.onLoad({filter:/.*/,namespace:'stub'},()=>({contents:'export class AgentSession {} export function agentRequest() { throw Error("Unexpected agent request"); }'}));
  }}]});
  const {default:worker} = await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
  const assets = new Map([
    ['/samples/christmas-2026-claude.html', ['text/html', '<html>sample</html>']],
    ['/iconify/collections.json', ['application/json', '{"lucide":{}}']],
    ['/iconify/sets/lucide.json.gz', ['application/gzip', Uint8Array.of(0x1f, 0x8b)]],
  ]);
  const env = {PUBLIC_ORIGIN:'https://desq.page', ASSETS:{fetch:async request=>{
    const [type, body] = assets.get(new URL(request.url).pathname);
    return new Response(body, {headers:{'Content-Type':type}});
  }}};
  for (const [path, [type, body]] of assets) {
    const response = await worker.fetch(new Request('https://desq.page'+path), env, {});
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Content-Type'), type);
    if (typeof body === 'string') assert.equal(await response.text(), body);
    else assert.deepEqual(new Uint8Array(await response.arrayBuffer()), body);
  }
});
