import { lookup } from 'node:dns/promises';
import { BlockList } from 'node:net';
import { hostedOAuthConfiguration } from './hosted-oauth.mjs';
import { localOAuthStore } from './oauth-store.mjs';
import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { mkdirSync, chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createAgentService, createAgentState, isAgentPath } from './service.mjs';

const privateNetworks = new BlockList();
for (const [network, prefix] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.168.0.0',16],['192.0.0.0',24],['198.18.0.0',15],['224.0.0.0',3]]) privateNetworks.addSubnet(network,prefix,'ipv4');
for (const [network,prefix] of [['::',96],['fc00::',7],['fe80::',10],['ff00::',8]]) privateNetworks.addSubnet(network,prefix,'ipv6');
export async function validateSourceHost(host, lookupImpl = lookup) {
  const addresses = await lookupImpl(host,{all:true});
  if (!addresses.length || addresses.some(({address,family})=>privateNetworks.check(address,family===6?'ipv6':'ipv4'))) throw Error('Source URL must resolve to a public address.');
}

export function persistentHostId(directory = resolve('.chatgpt-agent')) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  chmodSync(directory, 0o700);
  const path = resolve(directory, 'host-id');
  try { return readFileSync(path, 'utf8').trim(); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const id = `urn:uuid:${randomUUID()}`;
    try { writeFileSync(path, id, { mode: 0o600, flag: 'wx' }); return id; }
    catch (failure) { if (failure.code === 'EEXIST') return readFileSync(path, 'utf8').trim(); throw failure; }
  }
}

// Bridge Fetch requests without buffering large generated-image responses twice.
export function nodeHandler(handle) {
  return async (req, res, next) => {
    if (!isAgentPath(new URL(req.url, 'http://localhost').pathname) && new URL(req.url, 'http://localhost').pathname !== '/auth/callback') {
      if (next) return next();
      res.statusCode = 404; res.end('Not found'); return;
    }
    const controller = new AbortController();
    const abort = () => { if (!res.writableEnded) controller.abort(); };
    res.on('close', abort);
    try {
      const scheme = req.socket.encrypted ? 'https' : 'http';
      // Vite's HTTPS listener uses HTTP/2. Its compatible IncomingMessage has
      // :authority instead of Host, and Fetch rejects all colon-prefixed headers.
      const authority = req.headers[':authority'] || req.headers.host;
      const headers = new Headers();
      for (const [name, value] of Object.entries(req.headers)) {
        if (name.startsWith(':') || value === undefined) continue;
        for (const item of Array.isArray(value) ? value : [value]) headers.append(name, item);
      }
      const request = new Request(`${scheme}://${authority}${req.url}`, {
        method: req.method, headers, signal: controller.signal,
        ...(!['GET', 'HEAD'].includes(req.method) ? { body: Readable.toWeb(req), duplex: 'half' } : {}),
      });
      const response = await handle(request);
      res.statusCode = response.status;
      for (const [name, value] of response.headers) if (name !== 'set-cookie') res.setHeader(name, value);
      const cookies = response.headers.getSetCookie();
      if (cookies.length) res.setHeader('Set-Cookie', cookies);
      if (response.body) Readable.fromWeb(response.body).pipe(res);
      else res.end();
    } catch {
      if (!res.headersSent) { res.statusCode = 500; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'Agent host request failed.' })); }
      else res.destroy();
    }
  };
}

export function createNodeAgentHost({ origins, localOAuth = false, hostId, credentialDirectory = resolve('.chatgpt-agent'), persistOAuth = true, ...options }) {
  const hostedOAuth = options.hostedOAuth || (!localOAuth ? hostedOAuthConfiguration(process.env, origins) : undefined);
  let callbackServer, callbackReady;
  const identity = hostId || persistentHostId(credentialDirectory);
  const state = options.state || createAgentState();
  const store = (localOAuth || hostedOAuth) && persistOAuth ? localOAuthStore({ directory: credentialDirectory, hostId: identity, origins }) : undefined;
  if (store) state.chatgpt = store.load();
  const service = createAgentService({ validateSourceHost, ...options, origins, localOAuth, hostedOAuth, state,
    ...(store ? { oauthSessionMaxAgeMs: 30 * 24 * 3600_000, onCredentialsChanged: () => store.save(state.chatgpt) } : {}),
    hostId: identity,
    getRedirectUri: () => callbackReady ||= new Promise((resolve, reject) => {
      callbackServer = createServer(nodeHandler(request => service.callback(request)));
      callbackServer.once('error', error => { callbackReady = undefined; reject(error); });
      // The documented OSS flow permits varying the port, but not host/path.
      callbackServer.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${callbackServer.address().port}/auth/callback`));
    }),
  });
  return { service, middleware: nodeHandler(request => service.fetch(request)),
    close() { callbackServer?.closeAllConnections(); callbackServer?.close(); } };
}

export function agentHostPlugin() {
  const install = server => {
    let host;
    server.middlewares.use((req, res, next) => {
      if (!isAgentPath(new URL(req.url, 'http://localhost').pathname)) return next();
      if (!host) {
        const port = server.httpServer?.address()?.port || server.config.server.port;
        host = createNodeAgentHost({ localOAuth: true,
          origins: ['http:', 'https:'].flatMap(scheme => ['localhost', '127.0.0.1'].map(name => `${scheme}//${name}:${port}`)),
          geminiApiKey: process.env.GEMINI_API_KEY, geminiImageModel: process.env.GEMINI_IMAGE_MODEL });
      }
      return host.middleware(req, res, next);
    });
    server.httpServer?.once('close', () => host?.close());
  };
  return { name: 'savanna-agent-host', configureServer: install, configurePreviewServer: install };
}
