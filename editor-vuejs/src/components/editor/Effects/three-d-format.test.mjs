import test from 'node:test';
import assert from 'node:assert/strict';
import { read3dValue, set3dValue } from './three-d-format.mjs';
const EMU = 9525;
test('3D format controls preserve other properties and use PowerPoint units', () => {
  const original = { id: 'shape', sp3d: { $_prstMaterial: 'clear' }, scene3d: { camera: { $_prst: 'orthographicFront' }, lightRig: { $_rig: 'threePt', $_dir: 't' } } };
  const beveled = set3dValue(original, 'bevel', 'circle', EMU);
  const depth = set3dValue(beveled, 'extrusion', 12, EMU);
  const lit = set3dValue(depth, 'lighting', 90, EMU);
  assert.equal(read3dValue(lit, 'bevelWidth', EMU), 6);
  assert.equal(read3dValue(lit, 'extrusion', EMU), 12);
  assert.equal(read3dValue(lit, 'lighting', EMU), 90);
  assert.equal(lit.sp3d.$_prstMaterial, 'clear');
  assert.equal(original.sp3d.bevelT, undefined);
  assert.equal(set3dValue(lit, 'bevel', 'none', EMU).sp3d.bevelT, undefined);
});
test('rotation changes preserve other axes and existing camera presets', () => {
  const shape = { scene3d: { camera: { $_prst: 'isometricTopUp' } } };
  const resolve = () => ({ rotateX: 20, rotateY: 30, rotateZ: -40 });
  const result = set3dValue(shape, 'x', 10, EMU, resolve);
  assert.equal(read3dValue(result, 'x', EMU, resolve), 10);
  assert.equal(read3dValue(result, 'y', EMU, resolve), 30);
  assert.equal(read3dValue(result, 'z', EMU, resolve), 40);
  assert.equal(result.scene3d.camera.$_prst, 'isometricTopUp');
  assert.equal(set3dValue({}, 'extrusion', 8, EMU).scene3d.camera.$_prst, 'isometricTopUp');
});
