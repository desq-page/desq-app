// An explicit UI choice wins over keywords in topic/source text. Older callers
// can opt into PPT Master's Quick Generate profile by saying quickly/quick/fast.
export function authoringEffort(command, context = {}) {
  if (['quick', 'detailed'].includes(context.authoringEffort)) return context.authoringEffort;
  return /\b(?:quickly|quick|fast)\b/i.test(command) ? 'quick' : 'detailed';
}

export const QUICK_AUTHORING_WORKFLOW = `QUICK GENERATE PROFILE (overrides the default role handoffs): choose one complete solution directly, keeping the audience, exact roster, factual grounding, visual direction and per-page composition decisions in active context. Author the complete editable SVG deck in one uninterrupted pass. Do not ask for strategy confirmation, propose alternative designs, or produce planning artifacts. Resolve unspecified choices yourself. Preserve user requirements, source facts, native editable text/shapes/charts/tables, images when useful, typography and composition quality. Quick changes workflow overhead, not authoring capability or factual standards. Do not replace requested detail with shallow content. Technical validation and the final deterministic composition checker still run; correct specific reported failures when supplied. No automatic second model design review is needed. Notes and custom animation are optional unless requested or needed for the communication job.`;
