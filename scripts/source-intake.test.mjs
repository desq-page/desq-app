import test from 'node:test';
import assert from 'node:assert/strict';
import {pdfSource,htmlSource} from '../editor-vuejs/src/lib/agent/source-intake.mjs';
import {sourceContext,sourceSections,localSourceBrief} from '../editor-vuejs/src/lib/agent/source-bundle.mjs';
test('PDF intake keeps every page, text geometry and fonts and flags OCR pages',async()=>{
 let destroyed=0;
 const pdfjs={getDocument:()=>({promise:Promise.resolve({numPages:2,getPage:async page=>({getViewport:()=>({width:612,height:792,rotation:0}),getTextContent:async()=>({items:page===1?[{str:'Meaningful source facts',hasEOL:true,transform:[12,0,0,12,20,700],width:140,height:12,fontName:'f1'}]:[],styles:{f1:{fontFamily:'Arial',ascent:0.8}}}),cleanup(){}})}),destroy:async()=>{destroyed++;}})};
 const file={name:'paper.pdf',arrayBuffer:async()=>new ArrayBuffer(1)};
 const source=await pdfSource(file,{id:'pdf1',pdfjs});
 assert.equal(source.blocks.length,2);assert.equal(source.design.pages[0].width,612);
 assert.equal(source.blocks[0].evidence[0].transform[5],700);assert.match(source.warnings[0],/page 2.*OCR/);assert.equal(destroyed,1);
});
test('HTML sources share stable blocks and preserve image references without executing or loading them',()=>{
 const source=htmlSource('<h2>History</h2><p>A sufficiently long source paragraph gives historical details without including executable instructions or network resources.</p><img src="https://invalid.example/photo.jpg" alt="Evidence photo"><script>bad()</script>',{id:'html1',name:'Article',origin:'https://en.wikipedia.org/wiki/Example'});
 assert.equal(source.blocks[0].id,'html1:B1');assert.ok(!source.blocks[0].text.includes('bad()'));
 assert.equal(source.assets[0].name,'Evidence photo');assert.equal(source.design.headings[0].tag,'h2');
});
test('provider context excludes binary media and local prompts can reach later source blocks',()=>{
 const source=htmlSource('<p>'+('Readable source content. '.repeat(100))+'</p><h2>Later</h2><p>'+('Later source detail. '.repeat(30))+'</p>',{id:'s1',name:'Article'});
 source.assets.push({id:'asset',data:new Uint8Array([1,2]),name:'photo.png'});
 const compact=sourceContext([source],{maxChars:2000});assert.ok(!('data' in compact.documents[0].assets.at(-1)));assert.ok(compact.warnings.length);
 const brief=localSourceBrief([source],[{content:'{"slideNumber":3}'}]);assert.match(brief,/Later/);
 assert.ok(sourceSections([source]).length>=2);
});

import {compactModelContext} from '../editor-vuejs/src/lib/agent/agent-plan.mjs';
import {buildProviderPlan} from '../editor-vuejs/src/lib/agent/provider-request.mjs';
test('cloud providers receive the same source content and workflow without media bytes',()=>{
 const source=htmlSource('<p>'+('Supplied factual content. '.repeat(5))+'</p>',{id:'source-cloud',name:'Evidence'});
 source.assets.push({id:'private-bytes',data:new Uint8Array([1,2,3]),name:'image.png'});
 const context=compactModelContext({sourceBundles:[source],document:{width:1280,height:720},page:{}});
 for(const provider of ['chatgpt','gemini']){
  const request=buildProviderPlan(provider,{model:'test',command:'Create slides',context}).request;
  assert.match(JSON.stringify(request),/SOURCE WORKFLOW/);assert.match(JSON.stringify(request),/source-cloud:B1/);
  assert.ok(!JSON.stringify(request).includes('"data":{"0":1'));
 }
});
