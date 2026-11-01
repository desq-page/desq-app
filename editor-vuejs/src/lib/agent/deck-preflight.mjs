import {validateNativeTemplateDeck} from './native-template-plan.mjs';
import { canvasTextMeasurer } from './deck-text.mjs';
import { authoringEffort } from './authoring-effort.mjs';
import { compileDeck } from './deck-compiler.mjs';
import { reviewDeck, compositionRequirements, deckCompositionErrors } from './deck-design.mjs';
import { deckLayoutPreviews } from './deck-preview.mjs';

// Provider-side preflight is pure: never downloads assets or calls editor mutations.
// Real preset geometry, media and archive checks are repeated by the adapter.
export function preflightDeckPlan(plan, context) {
  const call = plan.calls.find(call => call.name === 'desq_create_deck');
  if (!call) return;
  const { fileId, pageId, ...deck } = call.arguments;
  if (context.pptxTemplateContext?.role === 'native-template-base' && context.slideTask?.mode !== 'edit' && deck.slides.some(slide=>slide.layout!=='pptx')) throw Error('Presenton must use the native PPTX template as the base. Return layout=pptx and templateFields; do not redraw it as HTML/SVG.');
  if (deck.slides.some(slide=>slide.layout==='pptx')) {
    if((context.htmlTemplate?.startsWith('presenton-') || context.htmlTemplate?.startsWith('builtin-')) && context.htmlTemplate!=='presenton-auto' && deck.slides.some(slide=>slide.templateSelection?.family!==context.htmlTemplate))throw Error('Use the selected Presenton family for every native template slide.');
    validateNativeTemplateDeck(deck); return {compiled:{pages:[],warnings:[]},review:{findings:[],compositionErrors:[],storyboard:[]},previews:[]}; }
  if (context.slideAuthoring === 'markdown' && deck.slides.some(slide=>slide.layout!=='markdown')) throw Error('This local workflow requires Markdown slides.');
  if (context.slideAuthoring === 'html' && deck.slides.some(slide => slide.layout !== 'html'))
    throw new Error('This tab requires layout=html with a complete HTML section for every slide.');
  if (context.slideAuthoring === 'svg' && deck.slides.some(slide => slide.layout !== 'svg'))
    throw new Error('This tab requires layout=svg with a complete SVG for every slide. Put all objects inside svg; do not use legacy custom elements or title/footer layout bands.');
  const canvas = typeof document === 'undefined' ? undefined : document.createElement('canvas').getContext('2d');
  let sequence=0;
  const compiled = compileDeck(deck, { width: context.document.width || 1280, height: context.document.height || 720,
    genId: () => `preflight-${++sequence}`, deferTextOutlines:true, allowTextOverflow: context.allowTextOverflow === true, geometry: (p, w, h) => ({ d: `R0,0,${w},${h}` }),
    ...(canvas ? { measureText: canvasTextMeasurer(canvas) } : {}) });
  return { compiled, review: reviewDeck(deck, compiled), previews: deckLayoutPreviews(compiled, { width: context.document.width || 1280, height: context.document.height || 720 }) };
}

export async function checkedCloudPlan({ request, body, signal, tools, context, parse, onProgress, onPreview }) {
  const requirements = compositionRequirements(body.command);
  const quick = authoringEffort(body.command, body.context) === 'quick';
  onProgress?.(quick ? 'Quickly: authoring one complete solution…' : 'Planning the story, visual concepts and editor actions…');
  let response = await request('plan', { signal, body });
  signal?.throwIfAborted();
  let plan, proof, validationError;
  let repairedPlan = false;
  const check = () => { plan = parse(response.text, tools, context); proof = preflightDeckPlan(plan, context); };
  try { check(); }
  catch (error) {
    // Repair generated arguments before any edit executes. Provider failures
    // remain outside this catch and are never automatically retried.
    if (!response.text?.includes('desq_create_deck')) {
      onProgress?.('Correcting the editor command arguments…');
      const first = response;
      response = await request('plan', { signal, body: { ...body, context: { ...body.context,
        planRepair: { previousResponse: first.text, validationError: error.message } } } });
      signal?.throwIfAborted();
      check();
      response.inferenceMs = (response.inferenceMs || 0) + (first.inferenceMs || 0);
      response.inputTokens = (response.inputTokens || 0) + (first.inputTokens || 0);
      response.repaired = repairedPlan = true;
    } else validationError = error.message;
  }
  if (quick) {
    const count = proof ? plan.calls[0].arguments.slides.length : undefined;
    const errors = proof ? deckCompositionErrors(proof.review, requirements) : [];
    if (validationError || errors.length) {
      signal?.throwIfAborted();
      onProgress?.('Quickly: correcting issues found by the final checker…');
      const first = response;
      response = await request('plan', { signal, body: { ...body, context: { ...body.context,
        deckRepair: { previousResponse: first.text, validationError: validationError || errors.join(' '),
          ...(count === undefined ? {} : { requiredSlideCount: count }) } } } });
      signal?.throwIfAborted();
      check();
      if (plan.calls.length !== 1 || plan.calls[0].name !== 'desq_create_deck' ||
        (count !== undefined && plan.calls[0].arguments.slides.length !== count))
        throw new Error('Quick correction must preserve the complete deck and slide count. No edits applied.');
      const remaining = deckCompositionErrors(proof.review, requirements);
      if (remaining.length) throw new Error(`Deck composition check failed: ${remaining.join(' ')} No slides were inserted.`);
      response.inferenceMs = (response.inferenceMs || 0) + (first.inferenceMs || 0);
      response.inputTokens = (response.inputTokens || 0) + (first.inputTokens || 0);
      response.repaired = true;
    }
    if (proof) {
      response.designFindings = proof.review.findings;
      onPreview?.(proof.previews);
    }
    response.workflow = 'ppt-master-quick';
    response.reviewed = false;
    return { plan, response };
  }
  if (proof || validationError) {
    signal?.throwIfAborted();
    if (proof) onPreview?.(proof.previews);
    onProgress?.(validationError ? 'Refining the deck to fix layout or data validation…' : 'Reviewing the storyboard, composition variety, hierarchy and contrast…');
    const first = response;
    const draftSlideCount = proof ? plan.calls[0].arguments.slides.length : undefined;
    const revision = validationError ? { deckRepair: { previousResponse: first.text, validationError } }
      : { deckReview: { previousResponse: first.text, ...proof.review, compositionErrors: deckCompositionErrors(proof.review, requirements), requirements } };
    signal?.throwIfAborted();
    response = await request('plan', { signal, body: { ...body, context: { ...body.context, ...revision } } });
    signal?.throwIfAborted();
    proof = undefined;
    check();
    response.inferenceMs = (response.inferenceMs || 0) + (first.inferenceMs || 0);
    response.inputTokens = (response.inputTokens || 0) + (first.inputTokens || 0);
    response.repaired = repairedPlan || !!validationError;
    response.reviewed = true;
    if (plan.calls.length !== 1 || plan.calls[0].name !== 'desq_create_deck') throw new Error('Deck correction must return one complete deck. No edits applied.');
    if (draftSlideCount !== undefined && plan.calls[0].arguments.slides.length !== draftSlideCount)
      throw new Error('Design review changed the slide count. No edits applied; ask the agent to preserve the requested count.');
    const compositionErrors = deckCompositionErrors(proof.review, requirements);
    if (compositionErrors.length) {
      onProgress?.('Rebuilding repeated slides as native content compositions…');
      const reviewed = response, count = plan.calls[0].arguments.slides.length;
      signal?.throwIfAborted();
      response = await request('plan', { signal, body: { ...body, context: { ...body.context,
        deckRepair: { previousResponse: reviewed.text, validationError: compositionErrors.join(' '), requiredSlideCount: count } } } });
      signal?.throwIfAborted();
      check();
      if (plan.calls.length !== 1 || plan.calls[0].name !== 'desq_create_deck' || plan.calls[0].arguments.slides.length !== count)
        throw new Error('Composition repair must preserve the complete deck and slide count. No edits applied.');
      const remaining = deckCompositionErrors(proof.review, requirements);
      if (remaining.length) throw new Error(`Deck composition check failed: ${remaining.join(' ')} No slides were inserted.`);
      response.inferenceMs = (response.inferenceMs || 0) + (reviewed.inferenceMs || 0);
      response.inputTokens = (response.inputTokens || 0) + (reviewed.inputTokens || 0);
      response.repaired = true; response.reviewed = true;
    }
    response.designFindings = proof.review.findings;
    onPreview?.(proof.previews);
  }
  return { plan, response };
}
