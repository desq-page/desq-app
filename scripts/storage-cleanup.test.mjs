import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

function load(source, dependencies = {}, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { exports, require: name => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  }, ...globals });
  return exports;
}

for (const remaining of [[], [{ id: 'other' }]]) {
  test(`shared deletion clears all storage only with ${remaining.length} files remaining`, async () => {
    const calls = [];
    const source = fs.readFileSync('shared-vuejs/src/edlib/common/db/dbutils.ts', 'utf8');
    const ast = ts.createSourceFile('dbutils.ts', source, ts.ScriptTarget.Latest, true);
    const fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'deleteFile');
    const storage = { getItem: () => 'last', removeItem: () => {} };
    const module = load(fn.getText(ast), {}, {
      removePptxArchive: async () => calls.push('archive'),
      removeMediaFromOPFS: async () => calls.push('media'),
      isFileDexieExist: async () => true,
      deleteWhereDexie: async table => { await Promise.resolve(); calls.push(table); },
      deleteDexie: async () => calls.push('file'),
      getAllDexie: async table => { assert.equal(table, 'files'); return remaining; },
      clearPptxArchives: async () => calls.push('all-archives'),
      clearAllOPFS: async () => calls.push('all-opfs'),
      clearAllRecordsDexie: async () => calls.push('all-dexie'),
      localStorage: storage, sessionStorage: storage,
      vStaticSlides: { fileInfo: { id: 'last' } },
      resetAllStores: () => calls.push('reset'),
    });
    await module.deleteFile('last');
    assert.deepEqual(calls, ['archive', 'media', 'assets', 'patches', 'fonts', 'file', 'reset',
      ...(remaining.length ? [] : ['all-archives', 'all-opfs', 'all-dexie'])]);
  });
}

test('OPFS cleanup removes orphan folders and root files recursively', async () => {
  const entries = new Map([['pptx', {}], ['unknown-import', {}], ['root-file', {}]]);
  const removed = [];
  const root = {
    async *entries() { yield* entries; },
    async removeEntry(name, options) {
      assert.equal(options.recursive, true);
      removed.push(name); entries.delete(name);
    },
  };
  const module = load(fs.readFileSync('shared-vuejs/src/edlib/common/db/opfs.ts', 'utf8'), {}, {
    navigator: { storage: { getDirectory: async () => root } },
  });
  await module.clearAllOPFS();
  assert.equal(entries.size, 0);
  assert.deepEqual(removed, ['pptx', 'unknown-import', 'root-file']);
});

test('Dexie cleanup clears every object store and leaves the database open', async () => {
  const cleared = [];
  const stores = ['files', 'assets', 'fonts', 'patches', 'additional-store'];
  let completed = false;
  const db = {
    objectStoreNames: stores,
    transaction(names, mode) {
      assert.deepEqual(Array.from(names), stores); assert.equal(mode, 'readwrite');
      return {
        objectStore: name => ({ clear: async () => { cleared.push(name); } }),
        get done() { return Promise.resolve().then(() => { completed = true; }); },
      };
    },
  };
  const module = load(fs.readFileSync('shared-vuejs/src/edlib/common/db/db.ts', 'utf8'), {
    idb: { openDB: async () => db }, '#shared/lib/slideUtils': {},
  });
  await module.setupDB();
  await module.clearAllRecordsDexie();
  assert.deepEqual(cleared, stores); assert.equal(completed, true);
});
