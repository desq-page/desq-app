const reasons = {
  API_KEY_INVALID: 'Google rejected this API key. Copy a Gemini API key from Google AI Studio without quotes or prefixes.',
  API_KEY_EXPIRED: 'This API key has expired. Replace it in Google AI Studio.',
  API_KEY_SERVICE_BLOCKED: 'This key does not permit the Gemini API. Check its API restrictions for generativelanguage.googleapis.com.',
  API_KEY_HTTP_REFERRER_BLOCKED: 'This key requires an allowed website referrer. Desq calls Gemini from its backend; use a key configured for that server environment.',
  API_KEY_IP_ADDRESS_BLOCKED: 'This key does not allow the production server IP. Localhost and production use different outbound IP addresses.',
  API_KEY_ANDROID_APP_BLOCKED: 'This key is restricted to an Android app and cannot be used by the editor backend.',
  API_KEY_IOS_APP_BLOCKED: 'This key is restricted to an iOS app and cannot be used by the editor backend.',
  SERVICE_DISABLED: 'The Gemini API is disabled for this key’s Google Cloud project. Enable generativelanguage.googleapis.com.',
  BILLING_DISABLED: 'Billing is disabled for this key’s Google Cloud project. Check its Gemini billing configuration.',
  CONSUMER_INVALID: 'Google rejected the project associated with this key. Check its project and Gemini API access.',
};
const statuses = new Set(['INVALID_ARGUMENT', 'FAILED_PRECONDITION', 'PERMISSION_DENIED', 'UNAUTHENTICATED', 'RESOURCE_EXHAUSTED', 'NOT_FOUND', 'UNAVAILABLE', 'INTERNAL']);

export async function geminiAPIError(response, stage, { direct = false } = {}) {
  // Upstream messages/metadata may echo keys, project IDs or prompt text.
  // Read a bounded body; emit only known codes and our own diagnostic wording.
  let payload;
  const reader = response.body?.getReader();
  if (reader) {
    try {
      const decoder = new TextDecoder(); let source = '', bytes = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 32768) throw Error('Oversized error');
        source += decoder.decode(value, { stream: true });
      }
      payload = JSON.parse(source + decoder.decode());
    } catch { /* Keep the generic diagnostic for non-JSON/oversized bodies. */ }
    finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  }
  const error = payload?.error;
  const reason = (Array.isArray(error?.details) ? error.details : []).find(detail =>
    detail?.['@type'] === 'type.googleapis.com/google.rpc.ErrorInfo' && typeof detail.reason === 'string' && Object.hasOwn(reasons, detail.reason))?.reason;
  const status = statuses.has(error?.status) ? error.status : undefined;
  const message = typeof error?.message === 'string' ? error.message : '';
  const directReasons = {
    API_KEY_HTTP_REFERRER_BLOCKED: 'Google rejected this website’s referrer. Check the allowed website origins for this key.',
    API_KEY_IP_ADDRESS_BLOCKED: 'This key does not allow your current network IP. Check its IP address restrictions.',
    API_KEY_ANDROID_APP_BLOCKED: 'This key is restricted to an Android app and cannot be used by this website.',
    API_KEY_IOS_APP_BLOCKED: 'This key is restricted to an iOS app and cannot be used by this website.',
  };
  const help = reason ? (direct && directReasons[reason] || reasons[reason])
    : /API key.*reported as leaked/i.test(message) ? 'Google has blocked this key as leaked. Replace it in Google AI Studio.'
    : /(?:user location|country|region).*(?:not supported|not available)|(?:not supported|not available).*(?:country|region)/i.test(message)
      ? (direct ? 'Google reports that Gemini is unavailable from your browser’s network location. Check regional availability and project billing.' : 'Google reports that Gemini is unavailable in the production server’s location. Check regional availability and project billing.')
    : response.status === 429 ? 'Gemini quota or rate limit reached. Check your Google AI Studio limits.'
    : [400, 401, 403].includes(response.status) ? 'Check the API key, its restrictions, and Gemini API access in Google AI Studio.'
    : response.status === 404 ? 'This Gemini model is no longer available. Reconnect to refresh the model list.'
    : 'Gemini is temporarily unavailable. Try again later.';
  return new Error(`Gemini API failed (HTTP ${response.status}${reason || status ? `, ${reason || status}` : ''}).${stage === 'models' ? ' Google rejected the model-list request.' : ''} ${help}`);
}
