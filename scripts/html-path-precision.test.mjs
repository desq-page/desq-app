import test from 'node:test';
import assert from 'node:assert/strict';
import {SVGPathData} from 'svg-pathdata';
import {roundHtmlShapePaths} from '../editor-vuejs/src/lib/agent/html-path-precision.mjs';

test('HTML paths round transformed coordinates and nested preset paths to three decimals',()=>{
  const shapes=[{d:'M12.345678-0.000001C1.234567 2.345678 3.456789 4.567891 5.678912 6.789123Z',children:[
    {d:'R0,0,123.456789,98.765432',prstGeom:{$_prst:'rect'}},
    {d:'M1e-7 0A5.123456 6.234567 12.345678 0 1 10.987654 20.876543'},
  ]}];
  roundHtmlShapePaths(shapes);
  const commands=new SVGPathData(shapes[0].d).commands;
  assert.equal(commands[0].x,12.346);
  assert.equal(commands[0].y,0);
  assert.equal(commands[1].x1,1.235);
  assert.equal(shapes[0].children[0].d,'R0,0,123.457,98.765');
  assert.equal(shapes[0].children[0].prstGeom.$_prst,'rect');
  const arc=new SVGPathData(shapes[0].children[1].d).commands[1];
  assert.equal(arc.rX,5.123);
  assert.equal(arc.lArcFlag,0);
  assert.equal(arc.sweepFlag,1);
  assert.equal(arc.x,10.988);
  const once=JSON.stringify(shapes);
  roundHtmlShapePaths(shapes);
  assert.equal(JSON.stringify(shapes),once);
});
