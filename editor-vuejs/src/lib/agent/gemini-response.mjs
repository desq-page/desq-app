export function readGeminiPlan(data) {
  const candidate = data.candidates?.[0];
  if (data.promptFeedback?.blockReason) throw new Error('Gemini blocked this request. No edits applied.');
  if (!candidate || candidate.finishReason !== 'STOP')
    throw new Error(`Gemini did not complete the request (${/^[A-Z_]{1,40}$/.test(candidate?.finishReason) ? candidate.finishReason : 'no completed candidate'}). No edits applied.`);
  const text = (candidate.content?.parts || []).filter(part => !part.thought && typeof part.text === 'string').map(part => part.text).join('');
  if (!text || text.length > 100_000) throw new Error('Gemini did not return a bounded editor plan.');
  return { text, inputTokens: data.usageMetadata?.promptTokenCount || 0 };
}

