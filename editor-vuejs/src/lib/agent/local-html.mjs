import {officeColorCatalogue} from './office-color-schemes.mjs';
import {planNativeTemplate} from './native-template-plan.mjs';
import {loadPresentonTemplate} from './presenton-pptx.mjs';
import { HTML_AUTHORING_GUIDE } from './html-authoring.mjs';
import { parseToolPlan, compactModelContext } from './agent-plan.mjs';
import { preflightDeckPlan } from './deck-preflight.mjs';
import { HTML_LAYOUTS, LOCAL_DESIGN_BRIEF_PROMPT, localDesignBrief } from './local-html-design.mjs';
import { restoreLocalPhoto, photoDirection } from './local-html-photos.mjs';
import { parseSlideHTML } from './html-slides.mjs';
import { reflowLocalHTML } from './local-html-reflow.mjs';
import { refineLocalHTML } from './local-html-quality.mjs';
import { authoringEffort } from './authoring-effort.mjs';
import { PRESENTON_AUTO, PRESENTON_TEMPLATES, presentonFamilyCatalogue, presentonCandidateReference, presentonLayoutCandidates } from './presenton-templates.mjs';

// Request final markup directly, keeping each request small and independent.
export async function planLocalHTML({ command, tools, context, generate,
  isStopped = () => false, onProgress, onPreview, modelLabel = 'Local model' }) {
  if (!command?.trim() || command.length > 4000) throw Error('Enter a slide request within 4000 characters.');
  const count = context.slideTask?.mode === 'edit' ? 1 : context.slideTask?.count ?? 1;
  if (!Number.isInteger(count) || count < 1 || count > 20) throw Error('Invalid requested local slide count.');
  const check = () => { if (isStopped()) throw Error('Local model stopped. No slides were inserted.'); };
  const metrics = { source: 'model', workflow: 'html-local-guided', inferenceMs: 0,
    inputTokens: 0, repaired: false, reviewed: false, planningCalls: 1, repairCalls: 0, reflowedSlides: 0, reflowAttempts: 0, photosRestored: 0, adjustments: [], warnings: [] };
  check();
  onProgress?.(`${modelLabel}: choosing the shared style and slide titles…`);
  const planned = await generate([
    { role: 'system', content: (context.htmlTemplate&&context.htmlTemplate!=='freeform'?LOCAL_DESIGN_BRIEF_PROMPT.replace(/^(?:Palette:|Colors:).*$/gm,''):LOCAL_DESIGN_BRIEF_PROMPT)+(context.htmlTemplate&&context.htmlTemplate!=='freeform'?'\nAlso return OfficeColors: exact ID chosen from officeColorSchemes. Choose one appropriate Office color scheme for the entire deck; no custom palette is needed.':'') },
    { role: 'user', content: JSON.stringify({ request: command, slideCount: count,
      ...(context.htmlTemplate&&context.htmlTemplate!=='freeform'?{officeColorSchemes:officeColorCatalogue()}:{}),
      ...(context.slideTask?.mode === 'edit' ? { currentSlide: compactModelContext(context).page } : {}),
      ...(context.htmlTemplate === PRESENTON_AUTO ? { templateCatalogue: presentonFamilyCatalogue(), instruction: 'Choose ONE template family for the whole deck and return Template: family-id. Its palette will be used unless Colors explicitly overrides it.' } : context.htmlTemplate && context.htmlTemplate !== 'freeform' ? { templateFamily: context.htmlTemplate, templateDescription: PRESENTON_TEMPLATES.find(t=>t.id===context.htmlTemplate)?.description } : {}),
    }) },
  ], { maxNewTokens: 512 });
  check();
  metrics.inferenceMs += planned.metrics?.inferenceMs || 0;
  metrics.inputTokens += planned.metrics?.inputTokens || 0;
  const brief = localDesignBrief(typeof planned.text === 'string' ? planned.text.slice(0, 6000) : '', command, count, { template: context.htmlTemplate || 'freeform' });
  if (brief.template !== 'freeform') {
    await loadPresentonTemplate(brief.template,{signal:context.signal,onProgress});
    check();
  }
  if (brief.template !== 'freeform' && context.slideTask?.mode !== 'edit') return planNativeTemplate({command,tools,context,generate,brief,metrics,onProgress,modelLabel,isStopped});
  if (brief.templateFallback) metrics.warnings.push('Used the Modern template family because the model did not choose a known family.');
  if (brief.fallback) metrics.warnings.push('Used host title/layout defaults for incomplete design brief entries.');
  const slides = [];
  const deck = { title: 'Generated presentation', generationModel: modelLabel,
    audience: 'The requested audience', objective: 'Communicate the requested topic',
    design: brief.design, slides };
  const makePlan = (pages = slides) => parseToolPlan(JSON.stringify({
    message: `Prepared ${pages.length} editable HTML slides with ${modelLabel}${brief.template !== 'freeform' ? ` using ${PRESENTON_TEMPLATES.find(t=>t.id===brief.template).name}` : ''}.`,
    calls: [{ name: 'savanna_create_deck', arguments: { ...deck, slides: pages } }],
  }), tools, context);
  const guide = HTML_AUTHORING_GUIDE.slice(HTML_AUTHORING_GUIDE.indexOf('Include every title'))
    .replace('For repairs return the entire corrected HTML deck.', 'For repairs return the complete corrected section.');
  const detailed = authoringEffort(command, context) === 'detailed';
  for (let index = 0; index < count; index++) {
    const direction = brief.slides[index], layout = HTML_LAYOUTS[direction.layout];
    const usedLayouts = slides.map(slide=>slide.templateSelection?.layout).filter(Boolean);
    const templateCandidates = presentonLayoutCandidates(brief.template, direction.layout, index, {usedLayouts});
    const familyLayouts = PRESENTON_TEMPLATES.find(t=>t.id===brief.template)?.layouts || [];
    const imageBudget = Math.max(0,8-slides.reduce((sum,slide)=>sum+parseSlideHTML(slide.html).querySelectorAll('img').length,0));
    const suggestedPhoto = photoDirection(command,direction.title,templateCandidates[0],imageBudget);
    let correction;
    for (let attempt = 0; attempt < 2; attempt++) {
      check();
      onProgress?.(`${modelLabel}: ${attempt ? 'repairing' : 'writing'} HTML slide ${index + 1} of ${count}…`);
      if (attempt) metrics.repairCalls++;
      const response = await generate([
        { role: 'system', content: `Create one polished editable presentation slide. Return ONLY one complete <section style="position:relative;width:1280px;height:720px;overflow:hidden;...">...</section>. No JSON, Markdown fences, explanation or tool calls. Write the final content and layout now. Follow the supplied shared palette, title and layout direction. When a PPTX reference is supplied, its geometry, fonts and field capacities take priority over the generic sizing recommendations below. Use Arial, title 40–56px, body 24–30px, labels at least 20px. Keep a 56px outer margin, title in the top 150px, body below 180px, 24px gaps, and at most 2 title lines. Prefer flex/grid and flow text over unrelated absolute text boxes. Use compact content that fits; never shrink dense text. The section must stay 1280×720 including padding (box-sizing:border-box). Limit body content to 480px height and roughly 80 words; use at most 4 short modules. For flex/grid children use min-height:0 and avoid fixed heights larger than the available space. No content below y=680. Use background/foreground for primary text, accent for emphasis, surface for panels; choose readable ink on accent panels. ${guide}` },
        { role: 'user', content: JSON.stringify({ request: command, slideNumber: index + 1,
          totalSlides: count, sharedStyle: { theme: brief.theme, ...brief.design },
          title: direction.title, layoutDirection: layout.guide,
          imagePolicy: { maxImages: Math.min(1,imageBudget), ...(suggestedPhoto ? { requiredPhoto: suggestedPhoto, instruction: 'Keep the photo region using a real img with data-query and alt; do not replace it with a text panel. Use this topical subject query or improve it.' } : { instruction: 'Use an image only where the chosen layout has a meaningful photo slot; draw icons/diagrams as editable SVG.' }) },
          previousTitles: slides.map(slide => slide.title), previousLayouts: usedLayouts,
          layoutSelection: 'Choose a composition that fits this slide. Prefer a suitable unused layout from the selected family; repeat when the content calls for it. Set data-presenton-layout to the exact chosen layout ID.',
          ...(context.slideTask?.mode === 'edit' ? { currentSlide: compactModelContext(context).page } : {}),
          ...(brief.template !== 'freeform' ? {
            templateFamily: brief.template, templateReference: presentonCandidateReference(brief.template, direction.layout, index, {usedLayouts}),
          } : {}), ...(correction ? { correction } : {}) }) },
      ], { maxNewTokens: 3072, stopSequence: '</section>' });
      check();
      metrics.inferenceMs += response.metrics?.inferenceMs || 0;
      metrics.inputTokens += response.metrics?.inputTokens || 0;
      try {
        if (typeof response.text !== 'string' || response.text.length > 80000) throw Error('Invalid or oversized HTML response.');
        let html = response.text.trim().replace(/^```(?:html)?\s*/i, '').replace(/\s*```$/, '').trim();
        if (!/^<section[\s>]/i.test(html) || !/<\/section>\s*$/i.test(html)) throw Error('Return one complete HTML section, including its closing tag.');
        let quality;
        const rawLayoutID = html.match(/data-presenton-layout=["']([^"']+)["']/i)?.[1];
        const photoLayout = familyLayouts.find(l=>l.id===rawLayoutID) || templateCandidates[0];
        try {
          quality = restoreLocalPhoto(html,{request:command,title:direction.title,layout:photoLayout,budget:imageBudget,design:brief.design}) || refineLocalHTML(html);
          if (quality.photoRestored) { metrics.photosRestored++; metrics.reflowedSlides++; }
        }
        catch (error) {
          if (error.code !== 'HTML_SLIDE_OVERFLOW') throw error;
          onProgress?.(`${modelLabel}: reflowing slide ${index + 1} to fit locally…`);
          metrics.reflowAttempts++;
          quality = reflowLocalHTML(html, { title: direction.title, design: brief.design });
          metrics.reflowedSlides++;
          if (!quality.overflowContent) metrics.warnings.push(`Slide ${index + 1}: oversized generated layout was replaced with a compact editable layout; text and media retained.`);
        }
        if (quality.overflowContent) metrics.warnings.push(`Slide ${index + 1}: showing a labelled excerpt. Full generated content is saved with the slide; use Download full content in the agent pane.`);
        html = quality.html;
        metrics.adjustments.push(...quality.adjustments.map(item => `Slide ${index + 1}: ${item}`));
        if (quality.issues.length && !attempt) throw Error(quality.issues.join(' '));
        if (quality.issues.length) metrics.warnings.push(...quality.issues.map(item => `Slide ${index + 1}: ${item}`));
        const title = (html.match(/<h[12]\b[^>]*>([\s\S]*?)<\/h[12]>/i)?.[1] || direction.title)
          .replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 120) || direction.title;
        const selectedLayout = rawLayoutID;
        const templateSelection = brief.template !== 'freeform' ? { family: brief.template, layout: familyLayouts.find(l=>l.id===selectedLayout)?.id || templateCandidates[0].id, modelSelectedLayout: familyLayouts.some(l=>l.id===selectedLayout), hostReflowed: !!quality.photoRestored || quality.adjustments.some(item=>/Reflowed|excerpt/i.test(item)) } : undefined;
        const slide = { ...(templateSelection ? { templateSelection } : {}), ...(quality.overflowContent ? { overflowContent: quality.overflowContent } : {}), title, purpose: 'Explain the requested topic', layout: 'html', html };
        const proof = preflightDeckPlan(makePlan([slide]), context);
        // Detailed adds targeted refinement only when deterministic checks find
        // significant typography/contrast problems, never an unconditional review.
        const significant = proof.review.findings.filter(item => /small body text|improve text contrast/i.test(item));
        if (detailed && significant.length && !attempt) throw Error(significant.slice(0, 4).join(' '));
        slides.push(slide);
        if (!index) deck.title = title;
        break;
      } catch (error) {
        if (attempt) throw Error(`Slide ${index + 1}: ${error.message} No slides were inserted.`);
        correction = error.message.slice(0, 1500);
        if (/overflow|clipped box|too dense/i.test(correction)) correction += ' Keep the canvas exactly 1280×720; NEVER enlarge the section or hide overflowing text. Reduce body content by about one third, remove excess vertical margins/padding/gaps, and make the body fit between y=180 and y=660. Preserve the title, key facts and readable font sizes. Return the complete corrected section.';
        metrics.repaired = true;
      }
    }
  }
  const plan = makePlan();
  const proof = preflightDeckPlan(plan, context);
  check();
  onPreview?.(proof.previews);
  if (metrics.warnings.length) {
    console.warn('[Savanna local design]', metrics.warnings);
    plan.message += ` Design notes: ${metrics.warnings.join(' ')}`;
  }
  return { ...plan, metrics: { ...metrics, designBrief: brief, designFindings: proof.review.findings } };
}
