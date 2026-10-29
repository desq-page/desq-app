export async function generateAgentImage(request, controllerSignal, model, image, { signal } = {}) {
  const timeout = AbortSignal.timeout(210_000);
  const combined = AbortSignal.any([controllerSignal, timeout, ...(signal ? [signal] : [])]);
  const result = await request('image', { signal: combined, body: { query: image.query, alt: image.alt, ...(model ? { model } : {}) } });
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(result.mimeType) ||
      typeof result.data !== 'string' || result.data.length > 10_666_668 || !/^[a-zA-Z0-9+/]+={0,2}$/.test(result.data))
    throw new Error('Image generation returned invalid raster data. No slide was inserted.');
  const bytes = Uint8Array.from(atob(result.data), char => char.charCodeAt(0));
  if (!bytes.length || bytes.length > 8_000_000) throw new Error('The generated image is empty or too large.');
  combined.throwIfAborted();
  return { blob: new Blob([bytes], { type: result.mimeType }), title: image.alt,
    author: result.provider, license: 'AI-generated', sourceUrl: '',
    generation: { provider: result.provider, model: result.model, prompt: image.query } };
}
