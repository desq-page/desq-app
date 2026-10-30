import {
  MARKDOWN_AUTHORING_GUIDE,
  parseMarkdownSlides,
  markdownVisualRequest,
  markdownStyleRequest,
  markdownContent,
} from "./markdown-slides.mjs";
import { parseToolPlan, compactModelContext } from "./agent-plan.mjs";
import { preflightDeckPlan } from "./deck-preflight.mjs";
import { authoringEffort } from "./authoring-effort.mjs";
import { PRESENTON_TEMPLATES } from "./presenton-templates.mjs";
export async function planLocalMarkdown({
  command,
  tools,
  context,
  generate,
  isStopped = () => false,
  onProgress,
  onPreview,
  modelLabel = "Local model",
}) {
  if (!command?.trim() || command.length > 4000)
    throw Error("Enter a slide request within 4000 characters.");
  const count =
    context.slideTask?.mode === "edit" ? 1 : context.slideTask?.count;
  const metrics = {
    source: "model",
    workflow: "markdown-local",
    inferenceMs: 0,
    inputTokens: 0,
    elaboratedVisuals: 0,
    elaboratedStyles: 0,
    repaired: false,
    reviewed: false,
    warnings: [],
  };
  const check = () => {
    if (isStopped())
      throw Error("Local model stopped. No slides were inserted.");
  };
  async function infer(instructions, data, budget = 4096) {
    check();
    const response = await generate(
      [
        { role: "system", content: instructions },
        { role: "user", content: JSON.stringify(data) },
      ],
      { maxNewTokens: budget },
    );
    check();
    metrics.inferenceMs += response.metrics?.inferenceMs || 0;
    metrics.inputTokens += response.metrics?.inputTokens || 0;
    if (typeof response.text !== "string" || response.text.length > 80000)
      throw Error("Local model returned an invalid or oversized response.");
    return response.text;
  }
  let draft, parsed, error;
  const current = compactModelContext(context).page;
  for (let attempt = 0; attempt < 2; attempt++) {
    onProgress?.(
      `${modelLabel}: ${attempt ? "correcting" : "writing"} the Markdown slides…`,
    );
    draft = await infer(MARKDOWN_AUTHORING_GUIDE, {
      request: command,
      effort: authoringEffort(command, context),
      requiredSlideCount: count,
      currentSlide: current,
      ...(context.htmlTemplate === "builtin-ocean"
        ? {
            designReference:
              "Built-in: coordinated editable layouts with selectable Office theme colors; vary compositions.",
            availableLayouts: PRESENTON_TEMPLATES[0].layouts.map(
              (l) => l.description,
            ),
          }
        : {}),
      ...(error
        ? { correction: error, previousDraft: draft?.slice(0, 9000) }
        : {}),
    });
    try {
      parsed = parseMarkdownSlides(draft, { count });
      break;
    } catch (failure) {
      if (attempt) throw Error(`${failure.message} No slides were inserted.`);
      error = failure.message;
      metrics.repaired = true;
    }
  }
  const deck = {
    title: parsed.title,
    generationModel: modelLabel,
    audience: "The audience specified in the request",
    objective: "Communicate the requested presentation",
    design: { fontFamily: "Arial" },
    slides: parsed.slides,
  };
  const makePlan = () =>
    parseToolPlan(
      JSON.stringify({
        message: `Prepared ${deck.slides.length} editable slides from Markdown with ${modelLabel}.`,
        calls: [{ name: "desq_create_deck", arguments: deck }],
      }),
      tools,
      context,
    );
  for (let index = 0; index < deck.slides.length; index++) {
    check();
    const slide = deck.slides[index];
    const styleSuggestion = markdownStyleRequest(slide.markdown);
    if (styleSuggestion) {
      onProgress?.(
        `${modelLabel}: elaborating the style for slide ${index + 1}…`,
      );
      try {
        const response = await infer(
          "Translate this style suggestion into an editable slide palette. Return ONLY Markdown blockquote directives: > Style: clean, > Background: #RRGGBB, > Foreground: #RRGGBB, > Accent: #RRGGBB, > Font: Arial. Pick actual six-digit hex colors, no CSS, HTML or explanation. Preserve the intended mood and contrast using simple native shapes.",
          { suggestion: styleSuggestion, slide: slide.title },
          512,
        );
        const directives = response
          .split(/\r?\n/)
          .filter((line) =>
            /^>\s*(?:Style|Background|Foreground|Accent|Font):/i.test(line),
          );
        if (
          !["Background", "Foreground", "Accent"].every((key) =>
            directives.some((line) =>
              new RegExp(`^>\\s*${key}:\\s*#[0-9a-f]{6}\\s*$`, "i").test(line),
            ),
          )
        )
          throw Error("Missing concrete palette colors.");
        slide.markdown =
          slide.markdown.replace(
            /^(?:>\s*)?(?:Style|Background|Foreground|Accent|Font):.*$/gim,
            "",
          ) +
          "\n" +
          directives.join("\n");
        metrics.elaboratedStyles++;
      } catch (failure) {
        check();
        metrics.warnings.push(
          `Slide ${index + 1}: style elaboration failed; keeping a simple native palette.`,
        );
      }
    }
    let visual;
    try {
      visual = markdownVisualRequest(slide.markdown);
    } catch (failure) {
      visual = null;
    }
    if (visual) {
      let visualError;
      const originalMarkdown = slide.markdown;
      const imageIsVisual =
        markdownContent(slide.markdown).directives.image === visual;
      for (let attempt = 0; attempt < 2; attempt++) {
        onProgress?.(
          `${modelLabel}: elaborating the visual for slide ${index + 1}…`,
        );
        try {
          const response = await infer(
            'Elaborate ONE suggested slide visual. Return Markdown only: either > Diagram: process: Label -> Label -> Label, or a fenced svg code block with a complete <svg viewBox="0 0 1280 720">...</svg>. Use editable text and simple shapes. No scripts, foreignObject, CSS, external resources, or whole-slide images. Use supplied facts only; never invent data. This visual will be fitted into the right half of its slide.',
            {
              suggestion: visual,
              slide: slide.markdown.slice(0, 5000),
              ...(visualError ? { correction: visualError } : {}),
            },
          );
          const svg =
            response.match(/```svg\s*\n([\s\S]*?)\n```/i)?.[1] ||
            (response.trim().startsWith("<svg") ? response.trim() : undefined);
          if (svg) slide.visualSVG = svg;
          if (imageIsVisual)
            slide.markdown = slide.markdown
              .replace(/^(?:>\s*)?Image:.*$/gim, "")
              .replace(/!\[[^\]]*\]\([^)]*\)/g, "");
          if (!svg) {
            const directive = response.match(/^>\s*Diagram:\s*(.+)$/im)?.[0];
            if (!directive)
              throw Error(
                "Return one process Diagram directive or one fenced SVG.",
              );
            slide.markdown =
              slide.markdown.replace(
                /^(?:>\s*)?(?:Diagram|Visual):.*$/gim,
                "",
              ) +
              "\n" +
              directive;
            if (markdownVisualRequest(slide.markdown))
              throw Error(
                "Describe the process using 2–6 short labels separated by ->.",
              );
          }
          const visualPlan = makePlan();
          visualPlan.calls[0].arguments.slides = [slide];
          preflightDeckPlan(visualPlan, context);
          metrics.elaboratedVisuals++;
          break;
        } catch (failure) {
          check();
          delete slide.visualSVG;
          slide.markdown = originalMarkdown;
          visualError = failure.message;
          if (attempt) {
            metrics.warnings.push(
              `Slide ${index + 1}: visual elaboration failed; keeping its editable description.`,
            );
          } else metrics.repaired = true;
        }
      }
    }
  }
  let plan, proof;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      plan = makePlan();
      proof = preflightDeckPlan(plan, context);
      break;
    } catch (failure) {
      if (attempt) throw Error(`${failure.message} No slides were inserted.`);
      onProgress?.(
        `${modelLabel}: adjusting Markdown content to fit the slides…`,
      );
      const response = await infer(MARKDOWN_AUTHORING_GUIDE, {
        request: command,
        requiredSlideCount: count || deck.slides.length,
        correction: failure.message,
        previousDraft: draft.slice(0, 14000),
      });
      const revised = parseMarkdownSlides(response, {
        count: count || deck.slides.length,
      });
      deck.slides = revised.slides;
      metrics.repaired = true;
    }
  }
  check();
  onPreview?.(proof.previews);
  metrics.warnings.push(...proof.compiled.warnings);
  if (metrics.warnings.length)
    plan.message += ` ${[...new Set(metrics.warnings)].join(" ")}`;
  metrics.designFindings = proof.review.findings;
  metrics.effort = authoringEffort(command, context);
  return { ...plan, metrics };
}
