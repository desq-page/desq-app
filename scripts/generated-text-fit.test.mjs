import test from 'node:test';
import assert from 'node:assert/strict';
import { canvasTextMeasurer } from '../editor-vuejs/src/lib/agent/deck-text.mjs';
import { compilePageSVG } from '../editor-vuejs/src/lib/agent/ppt-master-svg.mjs';
let id=0;
const options={width:1280,height:720,genId:()=>String(++id),measureText:()=>600};
const compile=body=>compilePageSVG(`<svg viewBox="0 0 1280 720">${body}</svg>`,options).shapes[0];
test('long text frames reserve proportional metric slack without moving the start anchor',()=>{
  const shape=compile('<text x="100" y="100" font-size="24">A long authored line</text>');
  assert.equal(shape.w,618);
  assert.equal(shape.x,100);
  assert.equal(shape.txBody.bodyPr.$_wrap,'square');
});
test('centered multiline text keeps its anchor and excludes safety padding from alignment',()=>{
  const shape=compile('<text x="640" y="100" font-size="24" text-anchor="middle" data-paragraph-line-height="36"><tspan x="640" y="100">First line</tspan><tspan x="640" y="136">Second line</tspan></text>');
  const rightInset=shape.txBody.bodyPr.$_rIns/9525;
  assert.equal(rightInset,18);
  assert.equal(shape.x+(shape.w-rightInset)/2,640);
  assert.equal(shape.txBody.p.length,2);
});
test('canvas measurement uses italic and bold font styles',()=>{
  const canvas={measureText:()=>({width:42})};
  assert.equal(canvasTextMeasurer(canvas)('Text',18,'Source Sans 3','bold','italic'),42);
  assert.equal(canvas.font,'italic bold 24px "Source Sans 3"');
  let args;
  compilePageSVG('<svg viewBox="0 0 1280 720"><text x="20" y="80" font-size="24" font-style="italic">Text</text></svg>',{...options,measureText:(...values)=>{args=values;return 100;}});
  assert.equal(args[4],'italic');
});
