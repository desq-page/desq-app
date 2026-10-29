const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const vue = require('vue');
const { parse, compileScript, compileTemplate } = require('@vue/compiler-sfc');
const naiveRoot = path.dirname(require.resolve('naive-ui'));
const DropdownGroup = require(path.join(naiveRoot, 'dropdown/src/DropdownGroup.js')).default;
const DropdownOption = require(path.join(naiveRoot, 'dropdown/src/DropdownOption.js')).default;

function fixture(usePointerUp) {
  const filename = __dirname + '/ToolbarItemDropdown.vue';
  const { descriptor } = parse(fs.readFileSync(filename, 'utf8'), { filename });
  const script = compileScript(descriptor, { id: 'dropdown-events' });
  const template = compileTemplate({ source: descriptor.template.content, filename, id: 'dropdown-events',
    compilerOptions: { bindingMetadata: script.bindings } });
  assert.deepEqual(template.errors, []);
  assert.match(template.code, /node-props.*optionNodeProps/);
  const info = { curPopupId: 'menu', setCurPopup(value) { this.curPopupId = value; } };
  const exports = {};
  const deps = {
    vue: { ...vue, watch() {} },
    '@/lib/common/store': { piniaInfo: () => info },
    'shared-vuejs/api/utility': { genId: () => 'menu' },
  };
  new Function('exports', 'require', ts.transpileModule(script.content, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText)(exports, id => deps[id] || {});
  return { panel: exports.default.setup({ usePointerUp }, { expose() {} }), info };
}

function event() {
  return { prevented: false, stopped: false,
    preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; } };
}

for (const grouped of [true, false]) {
  for (const usePointerUp of [true, false]) {
    test(`${grouped ? 'recent/theme group' : 'standalone'} option applies once on pointer-${usePointerUp ? 'up' : 'down'} and preserves selection`, () => {
      const { panel, info } = fixture(usePointerUp);
      const applied = [];
      const rawNode = panel.mapOption({ label: 'Arial (System)', key: 'arial', onClick: () => applied.push('Arial') });
      const child = { key: 'arial', rawNode };
      let optionProps = { tmNode: child, props: rawNode.props };
      if (grouped) {
        // Use Naive UI's actual group renderer, which omits the child's props.
        const group = DropdownGroup.render.call({ clsPrefix: 'n', parentKey: null,
          tmNode: { key: 'recent', children: [child] } });
        optionProps = group.children[1][0].props;
        assert.equal(optionProps.props, undefined);
      }
      const rendered = DropdownOption.render.call({ ...optionProps, clsPrefix: 'n', rawNode,
        nodeProps: panel.optionNodeProps });
      const down = event();
      rendered.props.onpointerdown(down);
      assert.equal(down.prevented, true, 'must not collapse the editor selection');
      assert.equal(down.stopped, true);
      if (usePointerUp) {
        assert.deepEqual(applied, []);
        rendered.props.onpointerup(event());
      }
      assert.deepEqual(applied, ['Arial']);
      assert.equal(info.curPopupId, '');
    });
  }
}

test('disabled grouped font options never apply', () => {
  const { panel } = fixture(true);
  const option = panel.mapOption({ label: 'Unavailable', disabled: true, onClick: () => assert.fail('disabled') });
  panel.optionNodeProps(option).onpointerup(event());
});
