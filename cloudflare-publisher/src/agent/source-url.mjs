// Public HTML intake only; never forward editor cookies or provider credentials.
export function publicSourceURL(value) {
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      (url.port && !['80', '443'].includes(url.port)) || !host.includes('.') ||
      /(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(host) ||
      /^[\d.]+$/.test(host) || host.includes(':') || host.includes('['))
    throw Error('Enter a public HTTP or HTTPS article URL.');
  url.hash = '';
  return url;
}
export async function fetchSourceHTML(value, {fetchImpl = fetch, signal, validateHost} = {}) {
  let url = publicSourceURL(value);
  const timeout = AbortSignal.timeout(20000);
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  for (let redirects = 0; redirects <= 5; redirects++) {
    await validateHost?.(url.hostname);
    const response = await fetchImpl(url.href, {signal: requestSignal, redirect: 'manual', headers: {Accept: 'text/html, application/xhtml+xml'}});
    if ([301,302,303,307,308].includes(response.status)) {
      await response.body?.cancel();
      url = publicSourceURL(new URL(response.headers.get('location'), url).href);
      continue;
    }
    if (!response.ok) throw Error(`Source page returned HTTP ${response.status}.`);
    if (!/^(text\/html|application\/xhtml\+xml)(?:;|$)/i.test(response.headers.get('content-type') || '')) {
      await response.body?.cancel(); throw Error('URL must return an HTML page. Upload PDF or Office documents as files.');
    }
    const reader = response.body.getReader(), chunks = []; let size = 0;
    try {
      while (true) { const {value, done} = await reader.read(); if (done) break; size += value.byteLength;
        if (size > 5 * 1024 * 1024) throw Error('HTML source exceeds 5 MB.'); chunks.push(value); }
    } finally { await reader.cancel(); }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return {html: new TextDecoder().decode(bytes), url: url.href};
  }
  throw Error('Source page redirected too many times.');
}
