import test from 'node:test';
import assert from 'node:assert/strict';
import { compileDeck } from '../editor-vuejs/src/lib/agent/deck-compiler.mjs';
import { MORPH_AUTHORING_GUIDE } from '../editor-vuejs/src/lib/agent/morph-pairs.mjs';
import { pptMasterReferences } from '../editor-vuejs/src/lib/agent/ppt-master-references.mjs';
import { HTML_AUTHORING_GUIDE } from '../editor-vuejs/src/lib/agent/html-authoring.mjs';
let sequence = 0;
const options = { width:1280, height:720, genId:()=>`m-${++sequence}`, geometry:(_p,w,h)=>({d:`R0,0,${w},${h}`}) };
const rect = (id,x=20) => `<rect id="${id}" x="${x}" y="40" width="180" height="100" fill="#123456"/>`;
const slide = (body,morph=false) => ({title:'Endpoint',purpose:'Continue action',layout:'svg',svg:`<svg viewBox="0 0 1280 720">${body}</svg>`,...(morph?{motion:{transition:{effect:'morph',duration:1}}}:{})});
const compile = slides => compileDeck({title:'Morph',audience:'Readers',objective:'Show change',slides}, options);
test('both cloud authoring guides include endpoint pairing requirements',()=>{
  assert.ok(pptMasterReferences.includes(MORPH_AUTHORING_GUIDE));
  assert.ok(HTML_AUTHORING_GUIDE.includes(MORPH_AUTHORING_GUIDE));
});
test('matching objects retain shared names and distinct native ids',()=>{
  const {pages}=compile([slide(rect('!!card')),slide(rect('!!card',500),true)]);
  assert.equal(pages[0].shapes[0].name,'!!card');
  assert.equal(pages[1].shapes[0].name,'!!card');
  assert.notEqual(pages[0].shapes[0].id,pages[1].shapes[0].id);
  assert.equal(pages[1].transition.ef,'morph');
});
test('Morph rejects missing endpoint, missing pairing and unmatched keys',()=>{
  assert.throws(()=>compile([slide(rect('!!card'),true)]),/preceding endpoint/);
  assert.throws(()=>compile([slide(rect('card')),slide(rect('card'),true)]),/without explicit pairs/);
  assert.throws(()=>compile([slide(rect('!!card')),slide(rect('!!other'),true)]),/no partner/);
});
test('Morph rejects one group id flattened to multiple shapes',()=>{
  assert.throws(()=>compile([slide(`<g id="!!card">${rect('a')}${rect('b',300)}</g>`),slide(rect('!!card'),true)]),/without explicit pairs|no partner|multiple objects/);
});
test('paired full canvas objects remain objects',()=>{
  const body='<rect id="!!backdrop" width="1280" height="720" fill="#123456"/>';
  const {pages}=compile([slide(body),slide(body,true)]);
  assert.ok(pages.every(p=>p.shapes.some(s=>s.name==='!!backdrop')));
});

test('Morph rejects incompatible text and picture/shape pairs',()=>{
  assert.throws(()=>compile([slide(rect('!!card')),slide('<text id="!!card" x="100" y="100" font-size="32">Card</text>',true)]),/incompatible object types/);
});
test('Morph rejects duplicate explicit native names',()=>{
  const page=slide('<g id="!!card"><rect x="20" y="40" width="100" height="100" fill="#123456"/><rect x="200" y="40" width="100" height="100" fill="#123456"/></g>');
  assert.throws(()=>compile([page,slide(rect('!!card'),true)]),/multiple objects/);
});
