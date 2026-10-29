// Limit concurrent rasterization and never retry a failed image in a loop.
export function createLayoutThumbnailQueue({ generate, onGenerated, onError, concurrency = 2 }) {
  const queued = [];
  const seen = new Set();
  let running = 0;
  let disposed = false;

  function pump() {
    while (!disposed && running < concurrency && queued.length) {
      const id = queued.shift();
      running++;
      Promise.resolve().then(() => generate(id)).then(
        () => { if (!disposed) onGenerated(id); },
        error => { if (!disposed) onError(id, error); },
      ).finally(() => { running--; pump(); });
    }
  }

  return {
    request(id) {
      if (disposed || !id || seen.has(id)) return;
      seen.add(id);
      queued.push(id);
      pump();
    },
    dispose() { disposed = true; queued.length = 0; },
  };
}
