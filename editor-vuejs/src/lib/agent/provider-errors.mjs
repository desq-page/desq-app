export async function inferenceError(response) {
  let payload;
  try { payload = await response.json(); } catch { /* Do not echo non-JSON upstream bodies. */ }
  const knownCodes = new Set(['unsupported_parameter', 'unsupported_value', 'invalid_value', 'invalid_request_error',
    'model_not_found', 'model_not_allowed', 'context_length_exceeded', 'rate_limit_exceeded', 'insufficient_quota',
    'invalid_api_key', 'permission_denied', 'access_denied']);
  const knownParams = new Set(['model', 'store', 'stream', 'instructions', 'input', 'max_output_tokens',
    'text', 'text.format', 'text.format.type', 'response_format', 'reasoning', 'reasoning.effort']);
  const code = knownCodes.has(payload?.error?.code) ? payload.error.code : undefined;
  const param = knownParams.has(payload?.error?.param) ? payload.error.param : undefined;
  const requestId = response.headers.get('x-request-id');
  const safeId = requestId && /^[a-zA-Z0-9_-]{1,128}$/.test(requestId) ? requestId : undefined;
  const help = response.status === 400 ? 'OpenAI rejected the request parameters. This does not by itself indicate an account or usage problem.'
    : response.status === 401 ? 'Reconnect ChatGPT to refresh sign-in.'
      : response.status === 403 ? 'This account or model is not permitted for this request.'
        : response.status === 429 ? 'Check the account rate and usage limits, then retry.' : 'Try again later.';
  return new Error(`ChatGPT inference failed (HTTP ${response.status}${code ? `, ${code}` : ''}${param ? `, parameter: ${param}` : ''}). ${help}${safeId ? ` Request ID: ${safeId}.` : ''} No edits applied.`);
}

