import { hostedOAuthConfiguration } from './agent/hosted-oauth.mjs';
import { createAgentService, restoreAgentState, snapshotAgentState } from './agent/service.mjs';

// One Durable Object per random HttpOnly browser session keeps credentials and
// rotating-token state separate across users, requests, regions and cold starts.
export class AgentSession {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.ready = ctx.blockConcurrencyWhile(async () => {
      const saved = await ctx.storage.get('agent');
      const hostId = saved?.hostId || `urn:uuid:${crypto.randomUUID()}`;
      this.hostId = hostId;
      this.service = createAgentService({ origins: [env.PUBLIC_ORIGIN], hostId,
        hostedOAuth: hostedOAuthConfiguration(env, [env.PUBLIC_ORIGIN]),
        state: restoreAgentState(saved?.state), geminiImageModel: env.GEMINI_IMAGE_MODEL });
    });
  }
  async fetch(request) {
    await this.ready;
    const response = await this.service.fetch(request);
    await this.ctx.storage.put('agent', { hostId: this.hostId, state: snapshotAgentState(this.service.state) });
    await this.ctx.storage.setAlarm(Date.now() + 8 * 3600_000);
    return response;
  }
  async alarm() { await this.ctx.storage.deleteAll(); }
}

export async function agentRequest(request, env) {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin') || (() => {
    try { return new URL(request.headers.get('Referer')).origin; } catch { return ''; }
  })();
  const callback = url.pathname === '/api/agent/chatgpt/callback' && request.method === 'GET' && !!env.OPENAI_OAUTH_CLIENT_ID;
  if (url.origin !== env.PUBLIC_ORIGIN || (!callback && (origin !== env.PUBLIC_ORIGIN || request.headers.get('X-Editor-Agent') !== '1')))
    return Response.json({ error: 'Untrusted editor origin.' }, { status: 403 });
  const cookies = request.headers.get('Cookie')?.split(';').map(part => part.trim()) || [];
  const current = cookies.find(part => part.startsWith('__Host-desq_agent='))?.slice('__Host-desq_agent='.length);
  const previous = current;
  if (callback && !/^[a-f0-9]{64}$/.test(previous || ''))
    return Response.json({ error: 'Sign-in browser session is missing. Start again from the editor.' }, { status: 400 });
  const id = /^[a-f0-9]{64}$/.test(previous || '') ? previous
    : [...crypto.getRandomValues(new Uint8Array(32))].map(n => n.toString(16).padStart(2, '0')).join('');
  const stub = env.AGENT_SESSIONS.get(env.AGENT_SESSIONS.idFromName(id));
  const upstream = await stub.fetch(request);
  const response = new Response(upstream.body, upstream);
  response.headers.set('Cache-Control', 'no-store');
  if (id !== current) response.headers.append('Set-Cookie', `__Host-desq_agent=${id}; HttpOnly; Secure; SameSite=${env.OPENAI_OAUTH_CLIENT_ID ? 'Lax' : 'Strict'}; Path=/; Max-Age=28800`);
  return response;
}
