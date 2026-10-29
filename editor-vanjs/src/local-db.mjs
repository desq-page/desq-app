// Record-sized transactions keep inactive slides and history off the JS heap.
export const DATABASE_NAME = 'savanna-vanjs-editor';
export function openLocalDatabase(name = DATABASE_NAME) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('records', { keyPath: ['workspace', 'kind', 'id'] });
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(Error('Close older editor tabs to upgrade the local document database.'));
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      const range = (workspace, kind) => IDBKeyRange.bound([workspace, kind, ''], [workspace, kind, '\uffff']);
      resolve({
        read(workspace, kind, id) {
          return new Promise((resolve, reject) => {
            const tx = db.transaction('records', 'readonly');
            const request = tx.objectStore('records').get([workspace, kind, id]);
            tx.oncomplete = () => resolve(request.result?.value);
            tx.onabort = () => reject(tx.error || request.error);
            tx.onerror = () => {};
          });
        },
        list(workspace, kind) {
          return new Promise((resolve, reject) => {
            const tx = db.transaction('records', 'readonly');
            const request = tx.objectStore('records').getAll(range(workspace, kind));
            tx.oncomplete = () => resolve(request.result.map(record => [record.id, record.value]));
            tx.onabort = () => reject(tx.error || request.error);
            tx.onerror = () => {};
          });
        },
        write(workspace, entries, clearKinds = []) {
          return new Promise((resolve, reject) => {
            const tx = db.transaction('records', 'readwrite');
            tx.oncomplete = () => resolve();
            tx.onabort = () => reject(tx.error || Error('Unable to persist the local document.'));
            tx.onerror = () => {};
            try {
              const records = tx.objectStore('records');
              clearKinds.forEach(kind => records.delete(range(workspace, kind)));
              for (const [kind, id, value] of entries) {
                if (value === undefined) records.delete([workspace, kind, id]);
                else records.put({ workspace, kind, id, value });
              }
            } catch (error) { tx.abort(); reject(error); }
          });
        },
        close() { db.close(); },
      });
    };
  });
}
