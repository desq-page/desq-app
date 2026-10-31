const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function fixture({ dirty = false, active = true, saved = true } = {}) {
  let dialogOptions, saveCalls = 0, deletes = 0, closed = 0;
  const dialog = {};
  const deps = {
    'shared-vuejs/editor': { getFileInfo: () => ({ id: active ? 'file' : 'other' }) },
    'shared-vuejs/api/global': { default: { globalDialog: { warning(options) { dialogOptions = options; return dialog; } } } },
    'shared-vuejs/api/db': { getDexie: async () => ({ dirty }) },
    'shared-vuejs/api/dbutils': { deleteFile: async () => { deletes++; } },
    '@/lib/common/store': { piniaInfo: () => ({ fileDirty: dirty }) },
    'shared-vuejs/api/save-document': { documentSaveFormat: async () => 'PPTX',
      saveDocument: async (id, picker) => { assert.equal(id, 'file'); assert.equal(picker, true); saveCalls++; return saved; } },
  };
  const exports = {};
  const source = fs.readFileSync(__dirname + '/closeFile.ts', 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('exports', 'require', code)(exports, name => deps[name]);
  return { open: () => exports.confirmCloseFile('file', () => { closed++; }),
    options: () => dialogOptions, dialog, counts: () => ({ saveCalls, deletes, closed }) };
}

for (const dirty of [false, true]) for (const active of [false, true]) {
  test(`save and unload saves ${dirty ? 'dirty' : 'clean'} ${active ? 'active' : 'cached'} file`, async () => {
    const f = fixture({ dirty, active });
    await f.open();
    await f.options().onPositiveClick();
    assert.deepEqual(f.counts(), { saveCalls: 1, deletes: 1, closed: 1 });
    assert.equal(f.dialog.loading, false);
  });
}

test('cancelling the save keeps the file loaded and allows another attempt', async () => {
  const f = fixture({ saved: false });
  await f.open();
  assert.equal(await f.options().onPositiveClick(), false);
  assert.deepEqual(f.counts(), { saveCalls: 1, deletes: 0, closed: 0 });
  assert.equal(f.dialog.loading, false);
});
