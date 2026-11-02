import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {preparePlayerScript} from './player-production.mjs';
test('production player assets remove console calls while preserving the player global',async()=>{
 const source='var player={initSlides(){console.log("log");console.info("info");console.warn("warn");console.error("error");debugger;return 42;}};';
 assert.equal(await preparePlayerScript(source,false),source);
 const output=await preparePlayerScript(source,true);
 assert.doesNotMatch(output,/console|debugger/);
 const context={};vm.runInNewContext(output,context);
 assert.equal(context.player.initSlides(),42);
});
