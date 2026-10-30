const ANGLE = 60000;
const DEFAULT_CAMERA = 'orthographicFront';

function cameraRotation(shape, resolveScene) {
  if (shape?.scene3d?.camera?.rot) return shape.scene3d.camera.rot;
  const scene = shape?.scene3d && resolveScene?.(shape.scene3d, 0);
  if (!scene) return { $_lat: 0, $_lon: 0, $_rev: 0 };
  let x = Number(scene.rotateX) || 0, y = Number(scene.rotateY) || 0;
  if (scene.perspective && (Math.abs(x) < 10 || Math.abs(y) < 10)) { x = -x; y = -y; }
  return { $_lat: Math.round(x * ANGLE), $_lon: Math.round(y * ANGLE), $_rev: Math.round(-(Number(scene.rotateZ) || 0) * ANGLE) };
}

export function read3dValue(shape, field, emu, resolveScene) {
  const bevel = shape?.sp3d?.bevelT;
  if (field === 'bevel') return bevel?.$_prst || (bevel ? 'circle' : 'none');
  if (field === 'bevelWidth') return Number(bevel?.$_w || 0) / emu;
  if (field === 'bevelHeight') return Number(bevel?.$_h || 0) / emu;
  if (field === 'extrusion') return Number(shape?.sp3d?.$_extrusionH || 0) / emu;
  if (field === 'lighting') return Number(shape?.scene3d?.lightRig?.rot?.$_rev ?? (bevel?.$_prst === 'relaxedInset' ? 45 : 235) * ANGLE) / ANGLE;
  const axis = { x: '$_lat', y: '$_lon', z: '$_rev' }[field];
  return axis ? Number(cameraRotation(shape, resolveScene)[axis] || 0) / ANGLE : 0;
}

export function set3dValue(shape, field, value, emu, resolveScene) {
  const next = { ...shape };
  if (field === 'bevel' || field === 'bevelWidth' || field === 'bevelHeight' || field === 'extrusion') {
    next.sp3d = { ...shape.sp3d };
    if (field === 'bevel') {
      if (value === 'none') delete next.sp3d.bevelT;
      else next.sp3d.bevelT = { $_w: 6 * emu, $_h: 6 * emu, ...shape.sp3d?.bevelT, $_prst: value };
    } else if (field === 'extrusion') next.sp3d.$_extrusionH = Math.round(Math.max(0, value) * emu);
    else next.sp3d.bevelT = { $_prst: 'circle', $_w: 6 * emu, $_h: 6 * emu, ...shape.sp3d?.bevelT,
      [field === 'bevelWidth' ? '$_w' : '$_h']: Math.round(Math.max(0, value) * emu) };
  }
  const initialCamera = field === 'extrusion' && Number(value) > 0 ? 'isometricTopUp' : DEFAULT_CAMERA;
  const camera = { $_prst: initialCamera, ...shape.scene3d?.camera };
  const lightRig = { $_rig: 'threePt', $_dir: 't', ...shape.scene3d?.lightRig };
  if (field === 'lighting') lightRig.rot = { $_lat: 0, $_lon: 0, ...lightRig.rot, $_rev: Math.round(value * ANGLE) };
  const axis = { x: '$_lat', y: '$_lon', z: '$_rev' }[field];
  if (axis) camera.rot = { ...cameraRotation(shape, resolveScene), [axis]: Math.round(value * ANGLE) };
  next.scene3d = { ...shape.scene3d, camera, lightRig };
  return next;
}
