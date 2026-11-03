import test from 'node:test';
import assert from 'node:assert/strict';
import {retargetGroupedAnimations} from '../editor-vuejs/src/lib/agent/html-shape-groups.mjs';
test('Rudolph entrance, bob and nose glow retain distinct targets after grouping',()=>{
 const outer='html-reveal-1',bob='html-reveal-2',nose='html-reveal-3';
 const page={shapes:[{id:'rudolph',sourceIds:[outer],children:[
 {id:'deer-svg',sourceIds:[outer,bob],children:[{id:'face',sourceIds:[outer,bob]},{id:'antlers',sourceIds:[outer,bob]}]},
 {id:'glow',sourceIds:[outer,nose]}, {id:'label',sourceIds:[outer]}]}],
 timing:{m:[
 {sh:'face',sourceTarget:outer,nativeTiming:{rowXml:'entrance'}},
 {sh:'label',sourceTarget:outer,nativeTiming:{rowXml:'entrance'}},
 {sh:'face',sourceTarget:bob,nativeTiming:{rowXml:'bob'}},
 {sh:'antlers',sourceTarget:bob,nativeTiming:{rowXml:'bob'}},
 {sh:'glow',sourceTarget:nose,nativeTiming:{rowXml:'glow'}},
 ]}};
 retargetGroupedAnimations(page);
 assert.deepEqual(page.timing.m.map(effect=>effect.sh),['rudolph','deer-svg','glow']);
 assert.deepEqual(page.timing.m.map(effect=>effect.nativeTiming.rowXml),['entrance','bob','glow']);
});
