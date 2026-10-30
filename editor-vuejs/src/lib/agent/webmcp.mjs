export function parseAgentOrigins(value = '') {
  return value.split(',').map(value => value.trim()).filter(Boolean).map(value => {
    const url = new URL(value);
    const localHttp = url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.origin !== value || (url.protocol !== 'https:' && !localHttp))
      throw new Error('Agent origins must be exact HTTPS origins (or local development origins).');
    return url.origin;
  });
}

export async function installEditorAgent(registry, { window: win, document: doc, navigator: nav, origins = [] }) {
  const controller = new AbortController();
  let disposed = false;
  // Current draft uses document.modelContext. Older Chromium previews used
  // navigator.modelContext and unregisterTool instead of registration signals.
  const modern = !!doc.modelContext?.registerTool;
  const context = modern ? doc.modelContext : nav.modelContext;
  const registered = [];
  let nativeError = '';
  const api = Object.freeze({ version: 1, listTools: registry.listTools, executeTool: registry.executeTool });
  win.desqAgent = api;

  const listener = async event => {
    if (event.source !== win.parent || win.parent === win ||
      ![win.location.origin, ...origins].includes(event.origin)) return;
    const request = event.data;
    if (!request || request.protocol !== 'desq-agent-v1' ||
      typeof request.id !== 'string' || request.id.length > 128) return;
    let result;
    if (request.method === 'listTools') result = { ok: true, result: registry.listTools() };
    else if (request.method === 'executeTool' && typeof request.name === 'string')
      result = await registry.executeTool(request.name, request.arguments);
    else result = { ok: false, error: 'Unknown agent request.' };
    if (!disposed) event.source.postMessage({ protocol: 'desq-agent-v1', id: request.id, ...result }, event.origin);
  };
  win.addEventListener('message', listener);
  if (context?.registerTool) {
    try {
      for (const tool of registry.tools) {
        if (controller.signal.aborted) break;
        // Vue HMR can mount the replacement while the browser is still
        // processing the old registration's abort/unregister task.
        for (let attempt = 0; ; attempt++) {
          try {
            await context.registerTool(tool, modern ? { signal: controller.signal, exposedTo: origins } : undefined);
            break;
          } catch (error) {
            if (attempt >= 2 || !/duplicate/i.test(String(error))) throw error;
            await new Promise(resolve => setTimeout(resolve, 25));
          }
        }
        registered.push(tool.name);
      }
    } catch (error) {
      nativeError = error instanceof Error ? error.message : String(error);
      controller.abort();
      for (const name of registered) context.unregisterTool?.(name);
    }
  }
  return {
    api, native: registered.length === registry.tools.length && !nativeError, nativeError,
    dispose() {
      disposed = true;
      controller.abort();
      registry.dispose();
      win.removeEventListener('message', listener);
      if (win.desqAgent === api) delete win.desqAgent;
      // Some browser previews expose document.modelContext as an alias of
      // the old API but still require explicit unregisterTool cleanup.
      for (const name of registered) context?.unregisterTool?.(name);
    },
  };
}
