import test from 'node:test';
import assert from 'node:assert/strict';
import { geminiAPIError } from '../cloudflare-publisher/src/agent/gemini-errors.mjs';
import { createAgentService } from '../cloudflare-publisher/src/agent/service.mjs';
const rejection = (reason, status = 400, message = 'private-key and private-project') => Response.json({ error: {
  status: 'INVALID_ARGUMENT', message, details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason, metadata: { key: 'private-key' } }],
} }, { status });
test('Gemini diagnostics distinguish invalid keys, server restrictions, disabled APIs and quotas without echoing secrets', async () => {
  for (const [reason, expected] of Object.entries({ API_KEY_INVALID: /without quotes/, API_KEY_HTTP_REFERRER_BLOCKED: /backend/, API_KEY_IP_ADDRESS_BLOCKED: /outbound IP/, SERVICE_DISABLED: /Enable generativelanguage/, BILLING_DISABLED: /Billing is disabled/ })) {
    const error = await geminiAPIError(rejection(reason), 'models');
    assert.match(error.message, new RegExp(reason));
    assert.match(error.message, expected);
    assert.match(error.message, /model-list/);
    assert.doesNotMatch(error.message, /private-key|private-project/);
  }
  assert.match((await geminiAPIError(rejection('unknown', 429))).message, /quota or rate limit/);
  assert.match((await geminiAPIError(rejection('unknown', 400, 'User location is not supported private-key'))).message, /server’s location/);
  assert.match((await geminiAPIError(rejection('unknown', 403, 'Your API key was reported as leaked private-key'))).message, /blocked this key as leaked/);
});
test('unknown, oversized and non-JSON provider errors are not exposed', async () => {
  for (const response of [rejection('private-key'), new Response('private-key', { status: 400 }), new Response('private-key'.repeat(4000), { status: 400 })]) {
    const error = await geminiAPIError(response, 'models');
    assert.match(error.message, /HTTP 400/);
    assert.doesNotMatch(error.message, /private-key/);
  }
});
test('production Gemini connection exposes safe Google reason and never saves a rejected key', async () => {
  const origin = 'https://editor.example';
  const service = createAgentService({ origins: [origin], hostId: 'test', fetchImpl: async (url, options) => {
    assert.ok(url.endsWith('/models?pageSize=100'));
    assert.equal(options.headers['x-goog-api-key'], 'private-key');
    return rejection('API_KEY_INVALID');
  } });
  const response = await service.fetch(new Request(`${origin}/api/agent/gemini/connect`, { method: 'POST', headers: { Origin: origin, 'X-Editor-Agent': '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: 'private-key' }) }));
  const data = await response.json();
  assert.equal(response.status, 400);
  assert.match(data.error, /API_KEY_INVALID/);
  assert.doesNotMatch(data.error, /private-key/);
  assert.equal([...service.state.gemini.values()][0].key, undefined);
});
