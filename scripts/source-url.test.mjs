import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchSourceHTML,publicSourceURL} from '../cloudflare-publisher/src/agent/source-url.mjs';
import {ingestUrl} from '../editor-vuejs/src/lib/agent/source-intake.mjs';
import {createAgentService} from '../cloudflare-publisher/src/agent/service.mjs';
const html='<title>Article</title><nav>Noise</nav><main><h2>History</h2><p>This full article contains enough historical evidence to become a useful factual source for a presentation.</p><img src="/photo.jpg" alt="Historical photo"></main><footer>Noise</footer>';
test('URL intake preserves full article, provenance, original HTML and relative images', async()=>{
 const source=await ingestUrl('https://en.wikipedia.org/wiki/Example',{fetchImpl:async(path,options)=>{assert.equal(path,'/api/agent/sources/url');assert.equal(JSON.parse(options.body).url,'https://en.wikipedia.org/wiki/Example');return Response.json({html,url:'https://en.wikipedia.org/wiki/Example'});}});
 assert.equal(source.name,'Article');assert.equal(source.origin,'https://en.wikipedia.org/wiki/Example');assert.match(source.blocks[0].text,/historical evidence/);assert.doesNotMatch(source.blocks[0].text,/Noise/);assert.equal(source.assets[0].url,'https://en.wikipedia.org/photo.jpg');assert.ok(source.assets.at(-1).data.length);
});
test('URL fetch validates each redirect and restricts content', async()=>{
 let calls=0;const hosts=[];
 const result=await fetchSourceHTML('https://example.org/start',{validateHost:async host=>hosts.push(host),fetchImpl:async()=>++calls===1?new Response(null,{status:302,headers:{location:'https://article.example.org/read'}}):new Response(html,{headers:{'content-type':'text/html; charset=utf-8'}})});
 assert.equal(result.url,'https://article.example.org/read');assert.deepEqual(hosts,['example.org','article.example.org']);
 await assert.rejects(fetchSourceHTML('https://example.org',{fetchImpl:async()=>new Response(null,{status:302,headers:{location:'http://127.0.0.1/private'}})}),/public/);
 await assert.rejects(fetchSourceHTML('https://example.org',{fetchImpl:async()=>new Response('pdf',{headers:{'content-type':'application/pdf'}})}),/HTML/);
 for(const url of ['file:///etc/passwd','http://localhost','http://192.168.1.1','https://user:pass@example.org','http://[::1]'])assert.throws(()=>publicSourceURL(url));
});
test('source endpoint accepts same-origin requests and rejects cross-origin requests',async()=>{
 const service=createAgentService({origins:['https://editor.example.org'],hostId:'test',fetchImpl:async()=>new Response(html,{headers:{'content-type':'text/html'}})});
 const request=origin=>new Request('https://editor.example.org/api/agent/sources/url',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({url:'https://example.org/article'})});
 assert.equal((await service.fetch(request('https://evil.example.org'))).status,403);
 const response=await service.fetch(request('https://editor.example.org'));assert.equal(response.status,200);assert.equal((await response.json()).html,html);
});

test('Node address validation accepts public IPv4/IPv6 and rejects private and mapped private addresses', async()=>{
 const {validateSourceHost}=await import('../cloudflare-publisher/src/agent/node.mjs');
 for (const [address,family] of [['103.102.166.224',4],['208.80.154.224',4],['2606:4700:4700::1111',6],['::ffff:208.80.154.224',6]]) {
   await validateSourceHost('en.wikipedia.org',async()=>[{address,family}]);
 }
 for (const [address,family] of [['127.0.0.1',4],['10.0.0.1',4],['192.168.1.1',4],['169.254.169.254',4],['::1',6],['fc00::1',6],['fe80::1',6],['::ffff:127.0.0.1',6],['::ffff:192.168.1.1',6]]) {
   await assert.rejects(validateSourceHost('example.org',async()=>[{address,family}]),/public address/);
 }
 await assert.rejects(validateSourceHost('example.org',async()=>[]),/public address/);
 await assert.rejects(validateSourceHost('example.org',async()=>[{address:'208.80.154.224',family:4},{address:'10.0.0.1',family:4}]),/public address/);
});

test('URL intake tolerates HTML5 void tags, optional/mismatched end tags and HTML entities', async()=>{
 const html = '<!doctype html><title>Example</title><main><h2>History</h2><p>New Mexico &amp; its neighbors have a long history. This article contains enough factual evidence for presentation slides.<wbr> More details follow.</p><p>Second paragraph has an optional end tag.<ul><li>First fact<li>Second fact</ul><picture><source srcset="large.webp"><img src="photo.webp" alt="Research &amp; history"></picture><div><b>Recovered text</div></main>';
 const source = await ingestUrl('https://example.org/article',{fetchImpl:async()=>Response.json({html,url:'https://example.org/article'})});
 const text=source.blocks.map(block=>block.text).join(' ');
 assert.match(text,/New Mexico & its neighbors/);
 assert.match(text,/First fact/);assert.match(text,/Second fact/);assert.match(text,/Recovered text/);
 assert.equal(source.assets[0].url,'https://example.org/photo.webp');
 assert.equal(source.assets[0].name,'Research & history');
});
