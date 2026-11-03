import test from 'node:test';
import assert from 'node:assert/strict';
import source from '../../desq-core/shared-vuejs/src/edlib/html-import/snapshot-slides-source.mjs';

test('snapshot ignores slide-container and detached animations before creating entrance records',()=>{
 const start=source.indexOf('        const effect = animation.effect, timing = effect?.getComputedTiming();');
 const end=source.indexOf('        const iterations =',start);
 assert.ok(start>=0 && end>start);
 const root={},child={},detached={};
 const slide={contains:target=>target===child};
 const animation=target=>({effect:{target,getComputedTiming:()=>({duration:900})}});
 const processed=[];
 new Function('animations','slide','processed',`for (const animation of animations) { ${source.slice(start,end)} processed.push(element); }`)(
 [animation(slide),animation(child),animation(detached),animation(null),{effect:null}],slide,processed);
 assert.deepEqual(processed,[child]);
 assert.ok(source.includes('if (!record) continue;'));
});
