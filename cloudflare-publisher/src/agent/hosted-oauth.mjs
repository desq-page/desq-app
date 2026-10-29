// Enable only for an OpenAI-registered website client approved for plan inference.
// Identity-only website sign-in cannot replace API credentials for the agent.
export function hostedOAuthConfiguration(env, origins) {
  if (!env.OPENAI_OAUTH_CLIENT_ID) return undefined;
  if (env.OPENAI_OAUTH_PLAN_ENABLED !== 'true')
    throw new Error('Hosted ChatGPT requires OpenAI approval for plan usage; set OPENAI_OAUTH_PLAN_ENABLED=true only after approval.');
  const redirectUri = env.OPENAI_OAUTH_REDIRECT_URI || `${origins[0]}/api/agent/chatgpt/callback`;
  const url = new URL(redirectUri);
  if (url.protocol !== 'https:' || !origins.includes(url.origin) || url.pathname !== '/api/agent/chatgpt/callback' || url.search || url.hash || url.username || url.password)
    throw new Error('OPENAI_OAUTH_REDIRECT_URI must be the registered HTTPS editor /api/agent/chatgpt/callback URL.');
  return { clientId: env.OPENAI_OAUTH_CLIENT_ID, clientSecret: env.OPENAI_OAUTH_CLIENT_SECRET, redirectUri };
}
