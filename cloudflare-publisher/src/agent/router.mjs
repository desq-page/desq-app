// The provider modules register the same small middleware API in Express or Fetch.
// Production and Vite use Fetch; legacy companion entry points still use Express.
export function createRouter() {
  const routes = [];
  const app = {
    use(...args) {
      const path = typeof args[0] === 'string' ? args.shift() : '';
      for (const handler of args.flat()) routes.push({ path, handler });
    },
    get(path, handler) { routes.push({ path, method: 'GET', handler }); },
    post(path, handler) { routes.push({ path, method: 'POST', handler }); },
    async fetch(request) {
      const url = new URL(request.url), headers = Object.fromEntries(request.headers);
      headers.host = url.host;
      const req = { request, headers, query: Object.fromEntries(url.searchParams),
        socket: { localPort: Number(url.port) || (url.protocol === 'https:' ? 443 : 80) } };
      const responseHeaders = new Headers(), listeners = new Set();
      let body, status = 200, streamController, resolveResponse;
      const responseReady = new Promise(resolve => { resolveResponse = resolve; });
      const encoder = new TextEncoder();
      const res = {
        headersSent: false, writableEnded: false, destroyed: false,
        set(name, value) {
          if (typeof name === 'object') for (const [key, entry] of Object.entries(name)) responseHeaders.set(key, entry);
          else responseHeaders.set(name, value);
          return res;
        },
        flushHeaders() {
          if (res.headersSent) return;
          const stream = new ReadableStream({
            start(controller) { streamController = controller; },
            cancel() { res.destroyed = true; cancel(); },
          });
          res.headersSent = true;
          resolveResponse(new Response(stream, { status, headers: responseHeaders }));
        },
        write(value) {
          if (res.destroyed || res.writableEnded) return false;
          res.flushHeaders();
          streamController.enqueue(typeof value === 'string' ? encoder.encode(value) : value);
          return true;
        },
        destroy(error) {
          if (res.destroyed) return;
          res.destroyed = true;
          if (streamController && !res.writableEnded) streamController.error(error || new Error('Connection closed.'));
          cancel();
        },
        end(value) {
          if (res.writableEnded) return res;
          if (value !== undefined) res.write(value);
          if (!res.headersSent) res.flushHeaders();
          res.writableEnded = true;
          if (!res.destroyed) streamController.close();
          return res;
        },
        status(code) { status = code; return res; },
        type(value) { return res.set('Content-Type', value === 'text' ? 'text/plain; charset=utf-8' : value); },
        send(value) { body = value; res.headersSent = res.writableEnded = true; return res; },
        json(value) { res.set('Content-Type', 'application/json'); return res.send(JSON.stringify(value)); },
        on(event, handler) {
          if (event === 'close') {
            listeners.add(handler);
            if (request.signal.aborted) queueMicrotask(handler);
          }
        },
        off(event, handler) { if (event === 'close') listeners.delete(handler); },
      };
      const cancel = () => { for (const listener of listeners) listener(); };
      request.signal.addEventListener('abort', cancel, { once: true });
      const matches = routes.filter(route => route.method
        ? route.method === request.method && route.path === url.pathname
        : !route.path || url.pathname === route.path || url.pathname.startsWith(`${route.path}/`));
      async function dispatch(index, error) {
        while (index < matches.length && (matches[index].handler.length === 4) !== !!error) index++;
        if (index === matches.length) {
          if (!res.headersSent) res.status(error ? 400 : 404).json({ error: error ? 'Agent request failed.' : 'Unknown agent endpoint.' });
          return;
        }
        let continuation;
        const next = nextError => { continuation = dispatch(index + 1, nextError); return continuation; };
        try {
          const handler = matches[index].handler;
          await (error ? handler(error, req, res, next) : handler(req, res, next));
          await continuation;
        } catch (failure) { await dispatch(index + 1, failure); }
      }
      request.signal.throwIfAborted();
      // Return flushed headers immediately while the handler continues producing
      // progress. Keep cancellation attached until the producer finishes.
      void dispatch(0).then(() => {
        if (!streamController) resolveResponse(new Response(body ?? null, { status, headers: responseHeaders }));
        else if (!res.writableEnded) res.end();
      }).catch(error => {
        if (streamController && !res.destroyed && !res.writableEnded) {
          res.destroyed = true;
          streamController.error(error);
        } else if (!streamController) {
          resolveResponse(Response.json({ error: 'Agent request failed.' }, { status: 500 }));
        }
      }).finally(() => request.signal.removeEventListener('abort', cancel));
      return responseReady;
    },
  };
  return app;
}

createRouter.json = () => async (req, res, next) => {
  if (!req.request.body) { req.body = {}; return next(); }
  if (!req.headers['content-type']?.split(';')[0].trim().match(/^application\/json$/i))
    return res.status(415).json({ error: 'Agent requests require application/json.' });
  const reader = req.request.body.getReader(), decoder = new TextDecoder();
  let bytes = 0, source = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 1024 * 1024) {
        await reader.cancel();
        return res.status(413).json({ error: 'Agent request is too large.' });
      }
      source += decoder.decode(value, { stream: true });
    }
    source += decoder.decode();
    try { req.body = source ? JSON.parse(source) : {}; }
    catch { return res.status(400).json({ error: 'Invalid JSON request.' }); }
  } finally { reader.releaseLock(); }
  return next();
};
