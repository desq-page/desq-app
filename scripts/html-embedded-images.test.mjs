import test from 'node:test';
import assert from 'node:assert/strict';
import {imageAlphaMask} from '../editor-vuejs/src/lib/agent/image-alpha-mask.mjs';
import {compilePageSVG} from '../editor-vuejs/src/lib/agent/ppt-master-svg.mjs';
const gradient={gsLst:{gs:[{$_pos:0,uniClr:{alpha:{$_val:0}}},{$_pos:19000,uniClr:{alpha:{$_val:100000}}}]},lin:{$_ang:0}};
test('image opacity gradient maps to a native blip alpha-modulate fill effect',()=>{
 const mask=JSON.stringify(gradient).replaceAll('"','&quot;');
 let id=0;
 const page=compilePageSVG(`<svg viewBox="0 0 1280 720"><image x="10" y="20" width="400" height="300" data-query="Embedded photo" aria-label="Embedded photo" data-desq-alpha-mask="${mask}" preserveAspectRatio="xMidYMid slice"/></svg>`,{
  width:1280,height:720,genId:()=>`image-${++id}`,assets:new Map([['0:svg:0',{media:{name:'photo.webp',w:1600,h:900}}]]),pageIndex:0,
 });
 const image=page.shapes.find(s=>s.type==='image');
 assert.ok(image);assert.equal(image.blipFill.blip.$_target,'photo.webp');
 const native=image.blipFill.blip.alphaMod.cont.fill.gradFill;
 assert.deepEqual(native.gsLst.gs.map(s=>[s.$_pos,s.uniClr.alpha.$_val]),[[0,0],[19000,100000]]);
 assert.equal(native.lin.$_ang,0);
});
test('mask transport validates stops and retains only native gradient fields',()=>{
 assert.equal(imageAlphaMask(undefined),undefined);
 assert.throws(()=>imageAlphaMask('{"gsLst":{"gs":[]}}'),/Invalid/);
 assert.throws(()=>imageAlphaMask(JSON.stringify({...gradient,gsLst:{gs:[gradient.gsLst.gs[0],{$_pos:200000,uniClr:{alpha:{$_val:1}}}]}})),/Invalid/);
 const input={...gradient,script:'ignored'};
 assert.equal(imageAlphaMask(JSON.stringify(input)).script,undefined);
});
