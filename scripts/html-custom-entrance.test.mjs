import test from 'node:test';
import assert from 'node:assert/strict';
import {compileMotion} from '../editor-vuejs/src/lib/agent/ppt-master-motion.mjs';
import {applyNativeTiming} from '../../desq-core/shared-vuejs/src/edlib/pptx/nativeTimingXml.mjs';
test('custom reveal exports movement, scaling and fade separately without Expand preset identity',()=>{
 const result=compileMotion({groups:{title:{effects:[
 {effect:'custom_entrance',duration:.7,delay:.3,trigger:'with-previous',property_frames:{opacity:[{t:0,v:0},{t:1,v:1}]}},
 {effect:'custom_entrance',duration:.9,delay:.3,trigger:'with-previous',property_frames:{ppt_y:[{t:0,v:46/1080},{t:1,v:0}],ppt_w:[{t:0,v:.94},{t:1,v:1}],ppt_h:[{t:0,v:.94},{t:1,v:1}]}}
 ]}}},[{id:'title',name:'title',x:100,y:100,w:300,h:80}],{width:1280,height:720});
 assert.equal(result.timing.m.length,2);
 for(const effect of result.timing.m){
 assert.equal(effect.presetID,undefined);assert.equal(effect.customName,'Custom Entrance');assert.equal(effect.cls,'entr');assert.equal(effect.tr,2);assert.equal(effect.dl,.3);
 assert.ok(effect.bh.some(bh=>bh.ty==='set' && bh.v===1));
 }
 assert.ok(result.timing.m[1].bh.some(bh=>bh.pr==='ppt_y' && bh.cm.length===2));
 const xml=applyNativeTiming('<p:sld><p:cSld/></p:sld>',result.timing,new Map([['title','7']]),{width:1280,height:720});
 assert.doesNotMatch(xml,/presetID=|presetSubtype=/);assert.match(xml,/presetClass="entr"/);
});
