import test from 'node:test';
import assert from 'node:assert/strict';
import {compileMotion} from '../editor-vuejs/src/lib/agent/ppt-master-motion.mjs';

test('imported Santa floating translation preserves midpoint, cycle and infinite repeat', () => {
 const result=compileMotion({groups:{santa:{effect:'custom_emphasis',duration:3,trigger:'with-previous',repeat_indefinitely:true,auto_reverse:false,
 translation_frames:[{t:0,x:0,y:0},{t:.5,x:0,y:-15},{t:1,x:0,y:0}]}}},[{id:'santa-id',name:'santa',x:20,y:30,w:200,h:100}],{width:1280,height:720});
 const effect=result.timing.m[0];
 assert.equal(effect.presetID,undefined);assert.equal(effect.customName,'Custom Emphasis');
 assert.doesNotMatch(effect.nativeTiming.rowXml,/presetID=|presetSubtype=/);
 assert.equal(effect.rp,0);assert.equal(effect.tr,2);
 const vertical=effect.bh.find(bh=>bh.pr==='ppt_y');
 assert.ok(vertical);assert.equal(vertical.du,3);
 assert.equal(vertical.cm.length,3);
 assert.ok(String(vertical.cm[1].v).includes(String(-.021)));
});

test('snapshot recognizes translate-only CSS keyframes from floating-santa', async()=>{
 const {default:source}=await import('../../desq-core/shared-vuejs/src/edlib/html-import/snapshot-slides-source.mjs');
 const start=source.indexOf('          const translation = frames.map');
 const end=source.indexOf('          const scales = frames.flatMap',start);
 assert.ok(start>0 && end>start);
 const effects=[];
 class Matrix { constructor(value){this.e=0;this.f=Number(/translateY\((-?[\d.]+)/.exec(value)?.[1]||0);} }
 new Function('frames','effects','DOMMatrix','width','effect',source.slice(start,end))([
 {computedOffset:0,transform:'translateY(0px)'},{computedOffset:.5,transform:'translateY(-15px)'},{computedOffset:1,transform:'translateY(0px)'}],effects,Matrix,1280,{getTiming:()=>({direction:'normal'})});
 assert.equal(effects.length,1);
 assert.deepEqual(effects[0].translation_frames,[{t:0,x:0,y:0},{t:.5,x:0,y:-15},{t:1,x:0,y:0}]);
});

test('Custom Emphasis export omits preset identity for retained and rebuilt timing',async()=>{
 const {applyNativeTiming}=await import('../../desq-core/shared-vuejs/src/edlib/pptx/nativeTimingXml.mjs');
 const {XMLValidator}=await import('fast-xml-parser');
 const result=compileMotion({groups:{santa:{effect:'custom_emphasis',duration:3,trigger:'with-previous',repeat_indefinitely:true,
 translation_frames:[{t:0,x:0,y:0},{t:.5,x:0,y:-15},{t:1,x:0,y:0}]}}},[{id:'santa',name:'santa',x:0,y:0,w:100,h:100}],{width:1280,height:720});
 const slide='<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld/></p:sld>';
 for(const retained of [true,false]){
  const timing=structuredClone(result.timing);
  if(!retained)delete timing.m[0].nativeTiming;
  const xml=applyNativeTiming(slide,timing,new Map([['santa','7']]),{width:1280,height:720});
  assert.equal(XMLValidator.validate(xml),true);
  assert.doesNotMatch(xml,/presetID=|presetSubtype=|animRot/);
  assert.match(xml,/presetClass="emph"/);assert.match(xml,/ppt_y/);assert.match(xml,/repeatCount="indefinite"/);
 }
});

test('nested snowfall and sway animate independent axes on the same imported shape',()=>{
 const result=compileMotion({groups:{
  'html-reveal-1':{effect:'custom_emphasis',duration:11.59,trigger:'with-previous',repeat_indefinitely:true,coordinate_width:1920,coordinate_height:1080,
   translation_frames:[{t:0,x:0,y:-10},{t:1,x:0,y:1090}]},
  'html-reveal-2':{effect:'custom_emphasis',duration:4.85,trigger:'with-previous',repeat_indefinitely:true,auto_reverse:true,coordinate_width:1920,coordinate_height:1080,
   translation_frames:[{t:0,x:-27,y:0},{t:1,x:27,y:0}]},
 }},[{id:'flake',name:'rect',sourceIds:['html-reveal-1','html-reveal-2'],x:100,y:100,w:10,h:10}],{width:1280,height:720});
 assert.equal(result.timing.m.length,2);
 const [fall,sway]=result.timing.m;
 assert.deepEqual(fall.bh.map(behavior=>behavior.pr),['ppt_y']);
 assert.deepEqual(sway.bh.map(behavior=>behavior.pr),['ppt_x']);
 assert.equal(fall.sh,sway.sh);
 assert.equal(fall.du,11.59);assert.equal(sway.du,4.85);
 assert.equal(fall.rp,0);assert.equal(sway.rp,0);assert.equal(sway.rv,1);
 assert.doesNotMatch(fall.nativeTiming.rowXml,/ppt_x/);
 assert.doesNotMatch(sway.nativeTiming.rowXml,/ppt_y/);
});

test('diagonal translation retains both axes, and zero movement adds no effect',()=>{
 const shapes=[{id:'shape',name:'shape',x:0,y:0,w:10,h:10}];
 const compile=frames=>compileMotion({groups:{shape:{effect:'custom_emphasis',translation_frames:frames}}},shapes,{width:1280,height:720});
 assert.deepEqual(compile([{t:0,x:0,y:0},{t:1,x:20,y:30}]).timing.m[0].bh.map(behavior=>behavior.pr),['ppt_x','ppt_y']);
 assert.equal(compile([{t:0,x:0,y:0},{t:1,x:0,y:0}]).timing.m.length,0);
});
