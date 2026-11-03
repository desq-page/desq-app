import test from 'node:test';
import assert from 'node:assert/strict';
import source from '../../desq-core/shared-vuejs/src/edlib/html-import/snapshot-slides-source.mjs';

test('already-revealed first slide resets without transition and preserves authored transition styles',()=>{
 const start=source.indexOf('    const resetActivation = slide => {');
 const end=source.indexOf('    const output = [];',start);
 assert.ok(start>0 && end>start);
 function style(value='',priority=''){
  return {value,priority,getPropertyValue(){return this.value;},getPropertyPriority(){return this.priority;},
   setProperty(name,v,p){this.value=v;this.priority=p;},removeProperty(){this.value='';this.priority='';}};
 }
 const heading={style:style()},year={style:style('transform .9s ease','important')};
 const classes=new Set(['slide','active','visible']);
 const slide={style:style(),querySelectorAll:()=>[heading,year],classList:{remove(...names){names.forEach(name=>classes.delete(name));}}};
 let snapshots=0;
 const getComputedStyle=element=>{
  if(element!==slide){assert.equal(classes.has('visible'),false);assert.equal(element.style.value,'none');snapshots++;}
  return {transform:'none',opacity:'0'};
 };
 new Function('slide','getComputedStyle',source.slice(start,end)+'resetActivation(slide);')(slide,getComputedStyle);
 assert.equal(snapshots,2);assert.deepEqual([...classes],['slide']);
 assert.equal(heading.style.value,'');assert.equal(year.style.value,'transform .9s ease');assert.equal(year.style.priority,'important');
 assert.match(source,/resetActivation\(slide\);\s*const before/);
});
