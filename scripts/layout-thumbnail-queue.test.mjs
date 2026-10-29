import test from 'node:test';
import assert from 'node:assert/strict';
import {createLayoutThumbnailQueue} from '../editor-vuejs/src/components/editor/NaviBar/layoutThumbnailQueue.mjs';
const tick = () => new Promise(resolve => setImmediate(resolve));

test('missing previews render once, with at most two active jobs', async () => {
 const started=[],completed=[],pending=new Map();
 const queue=createLayoutThumbnailQueue({generate:id=>{started.push(id);return new Promise(resolve=>pending.set(id,resolve));},onGenerated:id=>completed.push(id),onError:()=>assert.fail()});
 for(const id of ['a','b','a','c']) queue.request(id);
 await tick(); assert.deepEqual(started,['a','b']);
 pending.get('a')(); await tick(); assert.deepEqual(started,['a','b','c']); assert.deepEqual(completed,['a']);
 pending.get('b')(); pending.get('c')(); await tick();
 assert.deepEqual(completed,['a','b','c']);
});
test('failures report once and do not prevent other previews from rendering', async () => {
 const started=[],errors=[],completed=[];
 const queue=createLayoutThumbnailQueue({concurrency:1,generate:async id=>{started.push(id);if(id==='a')throw Error('render failed');},onGenerated:id=>completed.push(id),onError:(id,error)=>errors.push([id,error.message])});
 queue.request('a');queue.request('a');queue.request('b');await tick();
 assert.deepEqual(started,['a','b']);assert.deepEqual(errors,[['a','render failed']]);assert.deepEqual(completed,['b']);
});
test('closing the chooser cancels queued work and ignores running results', async () => {
 const started=[],completed=[];let finish;
 const queue=createLayoutThumbnailQueue({concurrency:1,generate:id=>{started.push(id);return new Promise(resolve=>{finish=resolve;});},onGenerated:id=>completed.push(id),onError:()=>assert.fail()});
 queue.request('a');queue.request('b');await tick();queue.dispose();finish();await tick();queue.request('c');await tick();
 assert.deepEqual(started,['a']);assert.deepEqual(completed,[]);
});
