const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function fixture(selection) {
  const preset = { du: 1, bh: [{ ty: 'props', du: 1, cm: [{ t: 0, v: 0 }, { t: 1, v: 1 }] }] };
  const existing = { sh: 'existing' };
  const slide = { timing: { m: [existing], i: [{ ef: [{ sh: 'triggered' }] }] } };
  let updates = 0, saves = 0, toggles = 0;
  const context = {
    defAnimList: { 0: { 1: preset }, 1: { 1: preset }, 2: { 1: preset }, 3: { 1: { d: true } } },
    piniaSelect: () => selection, getSlideInfo: () => slide,
    updateSlideAnimations: timing => { slide.timing = timing; updates++; },
    saveDexie: async () => { saves++; }, toggleTaskPane: () => { toggles++; },
  };
  const script = fs.readFileSync(__dirname + '/addAnimation.ts', 'utf8')
    .split('export async function addEffect')[1];
  vm.createContext(context);
  vm.runInContext(ts.transpileModule('async function addEffect' + script, {
    compilerOptions: { target: ts.ScriptTarget.ES2020 },
  }).outputText, context);
  return { context, slide, preset, counts: () => [updates, saves, toggles] };
}

for (const grp of [0, 1, 2, 3]) {
  test(`animation group ${grp} adds independently editable effects to every selected shape`, async () => {
    const f = fixture({ selShps: ['a', 'b', 'a'], selGrpShps: [], selShpFormat: null });
    const path = [{ p: [0, 0] }, { p: [100, 100] }];
    await f.context.addEffect(grp, 1, path);
    assert.deepEqual(Array.from(f.slide.timing.m, e => e.sh), ['existing', 'a', 'b']);
    const [a, b] = f.slide.timing.m.slice(1);
    if (grp === 3) assert.equal(a.cls, 'motion');
    assert.notEqual(a.bh, b.bh);
    assert.notEqual(a.bh[0], b.bh[0]);
    a.bh.find(bh => Array.isArray(bh.cm)).cm[0].v = 99;
    const other = b.bh.find(bh => Array.isArray(bh.cm));
    assert.notEqual(other.cm[0].v, 99);
    assert.equal(f.preset.bh[0].cm[0].v, 0);
    assert.equal(f.slide.timing.i[0].ef[0].sh, 'triggered');
    assert.deepEqual(f.counts(), [1, 1, 1]);
  });
}

test('selected group children receive animations rather than the parent group', async () => {
  const f = fixture({ selShps: ['parent'], selGrpShps: ['child1', 'child2'] });
  await f.context.addEffect(1, 1);
  assert.deepEqual(Array.from(f.slide.timing.m.slice(1), e => e.sh), ['child1', 'child2']);
});

test('no selection does not create an effect or save', async () => {
  const f = fixture({ selShps: [], selGrpShps: [], selShpFormat: { id: 'stale' } });
  await f.context.addEffect(1, 1);
  assert.equal(f.slide.timing.m.length, 1);
  assert.deepEqual(f.counts(), [0, 0, 0]);
});
