const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function fixture({ dirty = false, active = true, saved = true, cancelled = false, changed = false, error = false } = {}) {
  let dialogOptions, saveCalls = 0, deletes = 0, closed = 0, pickerCalls = 0, message;
  const dialog = {}, file = { id: active ? 'file' : 'other', name: 'Report.pptx' };
  const deps = {
    'shared-vuejs/editor': { getFileInfo: () => file },
    'shared-vuejs/api/global': { default: { globalDialog: { warning(options) { dialogOptions = options; return dialog; } } } },
    'shared-vuejs/api/db': { getDexie: async () => ({ dirty, name: 'Report.pptx' }) },
    'shared-vuejs/api/dbutils': { deleteFile: async () => { deletes++; }, flushPendingDexieSaves: async () => {} },
    'shared-vuejs/api/presentation-export': { createSinglePresentationHtml: async id => { assert.equal(id, 'file'); if (error) throw Error('Export failed'); return 'html'; } },
    'shared-vuejs/api/downloadShape': {
      selectDownloadFile: name => { assert.equal(name, 'Report.html'); pickerCalls++; return Promise.resolve(cancelled ? null : 'destination'); },
      downloadFile: async (blob, name, picker, cb, destination) => { assert.equal(blob, 'html'); assert.equal(destination, 'destination'); saveCalls++; return saved; },
    },
    '@/lib/common/store': { piniaInfo: () => ({ fileDirty: dirty }) },
    '@/lib/main/utils': { showError: text => { message = text; } },
    '@/lib/main/saveHtml': {
      prepareHtml: async (format, editable) => { assert.equal(format, 'single'); assert.equal(editable, false); if(error) throw Error('Export failed'); return { snapshot: {} }; },
      savePreparedHtml: async (prepared, selection) => { assert.equal(selection.name, 'Report.html'); assert.equal(await selection.destination, 'destination'); saveCalls++; return saved; },
      isHtmlSaveCurrent: () => !changed,
    },
  };
  const exports = {};
  const source = fs.readFileSync(__dirname + '/closeFile.ts', 'utf8').replace('import.meta.env.BASE_URL', "'/'");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('exports', 'require', code)(exports, name => deps[name]);
  return { open: () => exports.confirmCloseFile('file', () => { closed++; }),
    options: () => dialogOptions, dialog, counts: () => ({ pickerCalls, saveCalls, deletes, closed }), message: () => message };
}

for (const dirty of [false, true]) for (const active of [false, true]) {
  test(`save and unload exports single HTML for ${dirty ? 'dirty' : 'clean'} ${active ? 'active' : 'cached'} file`, async () => {
    const f = fixture({ dirty, active });
    await f.open();
    assert.match(f.options().content, /single HTML/);
    await f.options().onPositiveClick();
    assert.deepEqual(f.counts(), { pickerCalls: 1, saveCalls: 1, deletes: 1, closed: 1 });
    assert.equal(f.dialog.loading, false);
  });
}

for (const options of [{ saved: false }, { cancelled: true }, { changed: true }, { error: true }, { active: false, error: true }]) {
  test(`unsuccessful save keeps the file loaded: ${JSON.stringify(options)}`, async () => {
    const f = fixture(options);
    await f.open();
    assert.equal(await f.options().onPositiveClick(), false);
    assert.equal(f.counts().deletes, 0);
    assert.equal(f.counts().closed, 0);
    assert.equal(f.dialog.loading, false);
    if (options.error || options.changed) assert.ok(f.message());
  });
}
