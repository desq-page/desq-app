const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function compile(source, context) {
  vm.createContext(context);
  vm.runInContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  return context;
}
function fixture() {
  const effects = ['a', 'b', 'c'].map((sh, index) => ({ sh, grp: 1, presetID: index + 1, du: index + 1,
    bh: [{ ty: 'scale', du: 1, byX: 100, byY: 100 }] }));
  const timing = { m: effects, i: [] };
  let saves = 0;
  const c = {
    selectedEffects: { value: new Set(['0:0', '0:1']) }, selectedIdx: { value: 1 }, selectedGrp: { value: 0 },
    animGrps: { value: [effects.map(eff => ({ eff, trigger: '', shpId: eff.sh }))] },
    getSlideInfo: () => ({ timing }), getEffLstRef: () => effects,
    updateSlideAnimations: value => Object.assign(timing, value), cleanupAnim() {},
    saveDexie: () => saves++, refreshAnim() {},
  };
  const helper = fs.readFileSync(__dirname + '/../../../../../shared-vuejs/src/edlib/animations/animUtils.ts', 'utf8');
  const helperFunction = helper.slice(helper.indexOf('export function effectTimingPatch'), helper.indexOf('// Keep paragraph')).replace('export ', '');
  const parent = fs.readFileSync(__dirname + '/ShapeAnimations.vue', 'utf8');
  compile(helperFunction + parent.slice(parent.indexOf('function updateEff('), parent.indexOf('\nfunction deleteEff(')), c);
  return { c, effects, timing, saves: () => saves };
}

for (const patch of [{ tr: 3 }, { dl: 2 }, { rp: 0 }, { rw: 1 }, { u: 2, ltr: 0.05 }, { du: 4 }]) {
  test(`AnimationInfo bulk update applies ${Object.keys(patch).join(', ')} to all selected effects`, () => {
    const f = fixture();
    f.c.updateEff(patch);
    for (const effect of f.effects.slice(0, 2)) {
      for (const [key, value] of Object.entries(patch)) assert.equal(effect[key], value);
      if (patch.du) assert.equal(effect.bh[0].du, 4);
    }
    assert.equal(f.effects[2].rp, undefined);
    assert.equal(f.effects[2].du, 3);
    assert.equal(f.saves(), 1);
    assert.equal(f.c.selectedEffects.value.size, 2);
  });
}

test('bulk behavior patches are independent for each effect', () => {
  const f = fixture();
  f.c.updateEff({ bh: [{ ty: 'color', color: 'red', cm: [{ v: 1 }] }] });
  f.effects[0].bh[0].cm[0].v = 99;
  assert.equal(f.effects[1].bh[0].cm[0].v, 1);
});

test('property updates resolve each selected preset, retain timing and do not mutate the catalog', () => {
  const f = fixture();
  const defs = { 1: { bh: [{ ty: 'color', du: 1 }], pv: 'color' },
    2: { bh: [{ ty: 'stroke.color', du: 1 }], pv: 'color' },
    3: { bh: [{ ty: 'scale', du: 1 }], pv: [] } };
  const child = fs.readFileSync(__dirname + '/AnimationInfo.vue', 'utf8');
  f.c.props = { effData: { type: 2, eff: f.effects[0] }, updateEff: f.c.updateEff };
  f.c.findEffectInfo = row => defs[row.eff.presetID];
  vm.runInContext(ts.transpileModule(child.slice(child.indexOf('function updatePropval('), child.indexOf('\nfunction updateTrigger(')), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText, f.c);
  f.c.updatePropval('#123456');
  assert.equal(f.effects[0].bh[0].ty, 'color');
  assert.equal(f.effects[1].bh[0].ty, 'stroke.color');
  assert.equal(f.effects[0].bh[0].color, '#123456');
  assert.equal(f.effects[1].bh[0].color, '#123456');
  assert.equal(f.effects[0].bh[0].du, 1);
  assert.equal(f.effects[1].bh[0].du, 2);
  assert.equal(defs[1].bh[0].color, undefined);
  assert.equal(defs[2].bh[0].color, undefined);
});

test('bulk trigger changes move all selected effects and retain their selection', () => {
  const f = fixture();
  f.c.refreshAnim = () => {
    f.c.animGrps.value = [f.timing.m.map(eff => ({ eff })),
      ...f.timing.i.map(group => group.ef.map(eff => ({ eff })))];
  };
  f.c.updateEff({ trs: 'button' });
  assert.deepEqual(f.timing.m.map(e => e.sh), ['c']);
  assert.deepEqual(Array.from(f.timing.i[0].ef, e => e.sh), ['a', 'b']);
  assert.deepEqual(Array.from(f.c.selectedEffects.value), ['1:0', '1:1']);
});

test('single selected effect supports effect-specific property callbacks', () => {
  const f = fixture();
  f.c.selectedEffects.value = new Set(['0:1']);
  f.c.updateEff(effect => ({ prv: effect.sh }));
  assert.equal(f.effects[1].prv, 'b');
  assert.equal(f.effects[0].prv, undefined);
});
