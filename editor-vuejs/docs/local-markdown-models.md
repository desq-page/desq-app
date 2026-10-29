# Local models: Qwen and Gemma

## Current default: PPTX templates

Local generation defaults to the common **Design template (PPTX)** selector, with **Built-in** selected by default and automatic Office color selection. Individual slides fill native PPTX placeholders in suitable
layouts from that family, retaining master/layout links. A named family overrides Auto; Freeform skips template
references. The agent pane shows the current slide's recorded family/layout and a
report for the last generated deck, including fallback and host reflow notices.

The [built-in layouts](template-fill.md) use one native PPTX family with automatic Office color selection. No separate fixed-layout workflow is required.

## Freeform HTML option

Local generation uses HTML for all three models, with one compact shared design
brief per deck (maximum 512 output tokens). The plain-text brief selects the mood,
palette, slide titles and content-specific layouts. Invalid brief entries use host
defaults without another planning call. Custom background/foreground/accent colors
are accepted, with foreground and accent contrast corrected deterministically.

Each subsequent inference writes one styled 1280×720 section using the shared
palette, title and layout guidance. Auto can choose among the the built-in family. Each HTML call
receives that family’s layout IDs and three content-specific references; it can
choose any listed layout. Missing meaningful photo slots are restored as real
image requests with text reflowed beside the picture region. See [the template library](native-pptx-templates.md). Title/body zones, margins, readable font sizes and flow
layout are specified explicitly. The host converts browser layout to editable
editor JSON and PPTX. No JSON storyboard or unconditional model review is used.

Local layout checks run inside the converter's isolated, network-disabled frame.
They fix low-contrast text on known solid backgrounds and small collisions between
independent, unadorned, absolutely positioned text boxes, when the movement fits
inside the parent and avoids other text. They never shrink type or reposition
images, cards or diagram groups. For modest vertical overflow (up to 900px),
a fitting pass reclaims vertical margins, padding and row gaps, then trials smaller
oversized absolute containers only if all descendants and text remain inside.
Fonts and content are preserved, and the normal converter revalidates the result.
Larger/unresolved overflow now invokes a host-owned reflow fallback before another
model call. After normal markup safety validation and CSS/pseudo-element freezing,
it retains text, semantic emphasis, lists, tables, image queries and inline SVG,
replacing failed CSS geometry with one to three columns in the shared palette.
Body type is tried at 24, 22 and 20px; full-content reflow does not truncate or hide text.
Long lists can be distributed across columns while retaining ordered numbering.
Long rich paragraphs are split at word boundaries with their emphasis preserved.
Columns are packed using actual measured heights rather than estimated text weights.
Each candidate is measured and converted to native objects. The first fitting
candidate is accepted and reported as a design note. If content genuinely cannot
fit legibly, a clearly labelled excerpt is inserted instead of blocking the deck.
The full generated text and original HTML are retained in the slide's
`agentMetadata.overflowContent`, and the agent pane offers **Download full content
for this slide** for the selected page, including after reload. The excerpt uses
verbatim leading content, not invented summaries. The original source is retained
in the editor document; it is not a PowerPoint speaker-notes export. Requested
slide count stays fixed. Unsafe markup still fails before any fallback.
Overflow recovery uses a typed converter error so markup safety failures cannot
enter the geometry fallback. Missing titles, small text and unresolved text
collisions request one targeted HTML repair. Detailed also considers significant
native typography/contrast findings, using the same per-slide repair allowance.
Remaining design findings are logged and reported as notes; unsafe markup, overflow
and failed native conversion still block insertion. Preview and insertion remain
atomic. Metrics record the design brief, planning/repair counts, adjustments and
warnings. No target-GPU latency improvement is claimed without live measurement.

The Gemma adapter no longer calls sizeInTokens from streaming callbacks. The demo
also measures output tokens only after generation. Repeated tokenizer calls into
the active WASM engine were a suspected source of stalls and increasing overhead.
Streaming now reports characters and elapsed time, and stops at a complete outer
section. An emergency character cap bounds runaway output; token validation runs
after completion. The existing ten-minute watchdog remains. Live target-GPU
latency must still be measured; automated tests cannot establish speed parity.

The UI progress callback now follows the loaded model instance across generation
runs, rather than the model-loading run ID. This makes generation visible after
Create slides.

## Previous Markdown path (explicit programmatic callers only)

The previous Markdown path remains available explicitly. The model menu retains Qwen3.5 4B
and includes Gemma 4 E4B and Phi-4 mini instruct. Stop the current model before switching so
only one inference worker owns GPU resources. All three use the same HTML
contract and native compiler for useful output comparisons. Saved Markdown slides
include their Markdown source and model label in `agentMetadata`.

## Runtime

Qwen retains `onnx-community/Qwen3.5-4B-ONNX-OPT` and Transformers.js/ONNX WebGPU.
Gemma uses `@mediapipe/tasks-genai@0.10.29` and its locally packaged module WASM
loader/binary. It is a separate runtime, not an ONNX model substitution.

The exact `.task` weight URLs were verified against the deployed bundle of
[huggingworld/gemma-4-coder-webgpu](https://huggingface.co/spaces/huggingworld/gemma-4-coder-webgpu),
Space revision `80af78d35dd6fe79fc755620a32794760eb843c8`:

- `huggingworld/gemma-4-E4B-it-litert-lm/resolve/main/gemma-4-E4B-it-web.task`

Only model configuration was derived from the demo. Its UI/bundle is not copied
or executed. The models are downloaded from Hugging Face on first load and reused
from the browser cache when possible; inference runs in the dedicated worker.
Gemma uses its [official turn format](https://ai.google.dev/gemma/docs/core/prompt-formatting-gemma4)
without enabling thinking. Input/output context limits, progress, worker
termination and fatal-error recovery remain bounded. MediaPipe's maxTokens counts
input plus output. The adapter keeps a fixed context and uses streaming cancellation with an emergency character cap and post-generation
token checks to enforce output budgets;
it does not call setOptions without weights, which would reload the engine. Image/audio inputs
are disabled, matching the demo's text-only intent.

## Markdown contract

```markdown
# Solar energy
> Style: clean blue

## Slide 1: Turning light into power
> Diagram: process: Sunlight -> Panel -> Inverter -> Power

- **Panels** capture sunlight.
- Inverters convert the electricity for use.

## Slide 2: Installation
> Image: rooftop solar panels

Choose a suitable roof and assess the installation requirements.
```

No JSON storyboard or HTML is requested from the local model. Headings and slide
separators define the roster; paragraphs, lists, bold/italic spans and rectangular
Markdown tables become editable native content. Style directives select a palette
and font. Diagram-like image suggestions and unresolved visual descriptions get
up to two follow-up requests for a process specification or fenced SVG. Complex
style suggestions get one follow-up request for concrete color/font directives.
Ordinary photographic descriptions enter the existing image search/generation
pipeline and attribution/placeholder handling. Markdown image URLs are not fetched;
the alt text supplies the subject query.

The host composes SVG geometry from the parsed content, validates it and uses the
existing SVG-to-editor JSON compiler. Tables become native tables. The normal
editor persistence, Undo, preview and PPTX export paths apply. Whole-slide images
and executable model code are not introduced. HTML inside Markdown stays literal
text; an explicitly fenced SVG visual must pass the SVG converter's constraints.

An unresolved visual retains an editable description and warning. Invalid roster
counts or text that cannot fit get one Markdown correction attempt before any
insertion. Stop/cancellation and fatal runtime errors still stop the task. The
previous direct HTML/SVG planners remain available to explicit programmatic
callers; the local pane uses direct HTML. Cloud provider authoring is unchanged.

Current composition supports one visual/image region per slide, short vertical
process sequences, basic rich text and tables. It is a bounded Markdown dialect,
not a general Markdown/HTML browser. Detailed effort is passed to the model;
there is no separate JSON-based review stage in this workflow.

## Verification

`npm run test:markdown-slides` covers parser variants, native conversion, style
and visual elaboration, image queries, fallback/cancellation, the real PPTX text
serializer, runtime adapter contracts and prompt formatting. The HTML browser suite
covers all three model selections through the worker boundary, direct per-slide
generation, repair, cancellation and native conversion.
`npm run test:editor-agent` includes these tests with existing editor regressions.
The editor build packages the WASM loader/binary. Model responses and the Gemma
engine are mocked in automated tests; full multi-gigabyte Gemma inference on the
target GPU still requires live verification. No live model-quality parity is claimed.

## Phi instruct (ONNX WebGPU)

Phi reasoning/GGUF has been replaced with
[`webgpu/Phi-4-mini-instruct-ONNX-OPT`](https://huggingface.co/webgpu/Phi-4-mini-instruct-ONNX-OPT).
The export was checked at revision `35a22504431b51638e2ea386ebda9dedda09ce24`.
It uses the existing Transformers.js text-generation pipeline with `q4f16`.
Its config declares two external weight files and float16 KV caches; these are
loaded by Transformers.js from the repository config. No q4 fallback is published,
so devices without `shader-f16` fail before downloading weights.
The application bounds prompts to 8192 tokens and output to 4096 tokens, with
smaller per-stage budgets for template content. Stop/reload, browser caching,
model selection and native slide conversion use the existing ONNX path.
Qwen and Gemma E4B remain available; Gemma E2B and Phi reasoning are removed.
Mocked worker/browser tests verify routing, budgets and the float16 capability
check. Live model quality and GPU performance remain unverified.

## Attached source documents

The agent pane now has shared source intake for cloud and local providers. Attach
PDF, DOCX, PPTX, HTML, Markdown or text files; inspect their extracted manifests
before generation if needed. Enter a public HTML article URL (including Wikipedia)
and click **Add URL** to use a web source with the selected cloud or local model.
The Wikipedia research option and its separate models have been removed.
See [the shared source workflow](source-workflow.md) for parser details, design evidence, limits and PDF
OCR limitations.

Gemma 4 E4B now allows 8,192 input tokens and reserves up to 4,096 output tokens.
The MediaPipe engine receives a 12,288-token total context allocation. Stop and
reload an already-loaded model to apply the new allocation; cached weights are
reused. Longer prompts use more GPU memory. Runtime-budget tests cover the
5,594-token template prompt that previously exceeded the app's 4,096 input cap;
actual browser GPU capacity remains device-dependent.
