# PPT Master workflow → Desq native JSON

The active cloud deck-generation path is now the pinned upstream-reference/SVG
port described in [PPT Master port](ppt-master-port.md). The legacy authoring
contract below remains supported for existing clients and native tables/charts.

## Architecture

Desq already uses a DrawingML-shaped document model. We compile a bounded,
declarative deck specification to that model rather than generating a temporary
PPTX, importing it, or running Python in the browser.

The legacy preset compiler is original JavaScript. The new SVG path includes
pinned upstream references, source modules and fixtures under `third_party/`,
with the complete [MIT notice](https://github.com/hugohe3/ppt-master/blob/main/LICENSE).

1. Gemini/ChatGPT plans a thesis, narrative and visual direction in `strategy`,
   then authors audience/objective, slide takeaways, visual concepts and content
   through `desq_create_deck`.
2. Schema validation rejects unknown properties and bounds slide/object counts.
3. A pure preflight checks word wrapping, text fit, safe bounds, overlapping text,
   tables and charts. It produces schematic layout previews and reviews contrast,
   small text and repeated compositions. Cloud agents get one additional pass:
   repair an invalid draft, or review/refine a valid storyboard using compiled
   scene summaries. Only the final validated complete deck becomes executable.
   Review preserves the draft's slide count. No provider failures are retried.
4. The adapter checks the active document, resolves requested Wikimedia raster
   images, stores assets, and compiles/checks the entire deck again with real
   preset geometry and browser font measurements.
5. Complete pages are inserted, saved, selected and thumbnailed in sequence via
   public editor APIs. Existing pages are preserved. Each page has normal Undo.
6. Standard Desq Save as exports the native PPTX archive.

This is not an implementation of PPT Master's Python runtime, SVG parser,
document research tools, or all of its PowerPoint authoring capabilities. It is
the native-JSON deck-generation path and a feature compatibility contract.

## Feature map

| PPT Master / PowerPoint capability | Desq JSON representation | Agent authoring status |
| --- | --- | --- |
| Narrative / audience / slide job | Deck title/audience/objective; per-page `agentMetadata.purpose` | Implemented |
| Consistent design | Shared design → native fills and run fonts/colors | Five coordinated palettes, custom colors/font, per-slide base/dark/accent tones and standard/split/band variants |
| Page compositions | `slides[].layout` → positioned objects | Cover, section, content, two-column, comparison, metrics, timeline, closing, custom, process, statement, agenda, hub-spoke, three-column |
| Textboxes | `type:text`, `txBody.bodyPr`, `txBody.p` | Implemented |
| Rich text | `txBody.p[].r[].rPr` | Bold, italic, color, shared font, size |
| Bullets | `pPr.buChar`, margins and indent | One textbox; one paragraph per bullet |
| AutoShapes | `prstGeom`, `d`, fill, line | All presets in Desq's supplied catalog; real geometry compiler |
| Connectors | Connector presets → `cxnSp` | Visual preset geometry; semantic endpoint attachment not exposed |
| Images | `pic`, `blipFill.blip.$_target`; OPFS media | Wikimedia search → connected cloud image generation fallback, aspect fit, editable raster, source/AI labels |
| Citations / credits | Native footer text, image provenance | Implemented; sources must be supplied, not invented |
| Tables | `graphicFrame`, `graphic.graphicData.tbl`, EMU grid/rows/cells | Native rectangular tables; first row styled header |
| Charts | `chartData` preview plus `graphic.graphicData['c:chart'].chartJson` | Native bar, line, pie with category/value caches |
| Chart workbook / Edit Data | Embedded workbook and chart relationships | Not generated; no embedded Excel workbook. Cached native values retained |
| Page size | File width/height; authoring canvas scaled independently | Uses current presentation dimensions |
| Layout association | Page `layoutid`, existing archive template page | Implemented; generated page uses `showMaster:0` to suppress inherited graphics |
| Reusable master/theme authoring | File masters/layouts and theme parts | Not generated; design currently repeated as native page-local objects |
| Transitions | Page `transition` and archive transition serializer | Click-to-advance default only; effect authoring not exposed |
| Entrance / exit / motion / Morph | Page timing tree and animation relationships | Not mapped by this generator yet |
| Speaker notes | Notes slide/master parts and relationships | No verified public write mapping; not silently stored as visible text |
| Narration / audio / video | Media records, media shapes and relationships | Not mapped by this generator yet |
| Formulas / OMML | Native mathematical XML | Not exposed by this generation schema |
| Groups / Boolean / freeform | `children`, parent IDs, custom paths | Not exposed; diagrams use editable presets and text |
| Gradients / shadows / alpha / crop | `gradFill`, `effectLst`, shape transforms, crop metadata | Not exposed by the first deck schema |
| Hyperlinks / actions | Run/shape hyperlink relationships | Not exposed |
| SVG authoring/import | Parse SVG to native objects | Deliberately bypassed; native declarative objects instead |
| PDF/DOCX/URL source intake | Extracted source text and provenance | Topic/pasted text via chat only; attachments/research intake remains separate |
| Template reconstruction / reference matching | Analyze masters/layouts/fonts/images and map slots | Not implemented by this generator |
| Visual quality / revision | Schematic layout proofs and compiled scene review | Chat previews, contrast/readability/repetition checks, one cloud design review or repair. No image/vision critique of the actual Desq rendering yet |

## Schema and limits

`src/lib/agent/deck-schema.mjs` is the authoring contract. It allows 2–20 slides,
up to 24 explicit elements per slide, eight images per deck and two per page.
Elements use 1280×720 design coordinates, scaled to the actual document.
Custom elements must stay within x=54..1226 and y=155..644 to protect title and
footer space. Invalid layouts fail before slide insertion. Images are resolved
before committing any pages, but downloaded media may remain cached if a later
asset/credit validation fails.

Charts require equal category/value counts and a source/units label. Numeric
truth cannot be verified by a schema: the prompt requires supplied data or an
explicit illustrative-data label. Tables are at most 10 rows × 6 columns. Native
chart XML caches and preview data are compiled from the same input. Later chart
edits depend on the editor's existing chart-edit/export implementation; generating
an embedded workbook is a separate feature.

If cancellation, navigation, or persistence fails during commit, already inserted
pages remain; errors report the count. Retrying the whole command can duplicate
those pages, so review or Undo them first. The operation is intentionally not
described as atomic across an entire deck.

Text fitting uses browser Canvas font measurements (conservative character width
fallback in Node tests), progressively shrinking within a floor. This is an
estimate, not proof against every renderer/font difference. Font loading and
vision-based review of actual editor renders are follow-on work. The model reviews
content and compiled geometry, not raster previews. Layout proofs approximate
AutoShapes and show image/chart/table slots schematically; final slides retain
native editor objects and real preset geometry. No model-authored code executes.

## Design controls

`design.palette` accepts `ocean`, `forest`, `ember`, `plum`, or `graphite`.
Optional `secondary`, `surface` and `dark` colors complement the existing colors.
Each slide can choose `tone: base|dark|accent`, `variant: standard|split|band`,
and an accent override. Explicit tones and colors take precedence over defaults.
All pages default to the shared base background. Dark/accent backgrounds are
explicit choices; color changes do not count as composition variety.
Content variants use a flat text composition, editorial side panel, or takeaway
band. Bullets remain one native textbox with a paragraph per bullet.

Process slides use 2–5 items and native chevrons, agenda slides 2–6 numbered rows,
and hub-spoke slides 2–4 nodes around a short central takeaway. Comparisons use
contrasting fields; timelines have rails/milestones; metrics emphasize values.
The authoring prompt asks for content-appropriate variety while preserving any
user-requested uniform template or brand. Structural errors block insertion;
repeated basic geometry or a complete absence of informational native carriers
trigger a bounded repair and then block insertion. Explicit uniform-layout
requests bypass those composition gates; text-only requests bypass the carrier
requirement. Other style findings remain warnings.

Decks use at most three planning requests (draft, review, and only when needed
a final composition repair); normal edits
and conversational replies still use one. This adds inference time and usage.
`node scripts/preview-deck-design.mjs [output-directory]` creates reproducible
layout proofs for the sample fixture; `npm run test:deck-agent` exercises designs
and the shared Gemini/ChatGPT review flow.

## Example

Ask Agent: “Create an 8-slide deck about a solar pilot for business leaders.
Include a comparison, a timeline, and a table. Use these illustrative costs:
Option A $10, Option B $20. Label these as illustrative. No photos.”

Validation: `npm run test:editor-agent`, `npm run test:gemini-agent`,
`npm run test:chatgpt-agent`. The generated tool embedding index and API inventory
must be rebuilt after registry/schema changes.

## Native composition workflow adaptation

The strategy/execution/checking separation and content-relationship-to-carrier
selection are adapted to Desq from PPT Master 6.7.2, inspected 2026-10-18:
[plan core](https://github.com/hugohe3/ppt-master/blob/main/skills/ppt-master/references/plan-core.md),
[executor core](https://github.com/hugohe3/ppt-master/blob/main/skills/ppt-master/references/executor-base.md),
and [generation workflow](https://github.com/hugohe3/ppt-master/blob/main/skills/ppt-master/workflows/generate-pptx.md).
Upstream: Copyright (c) 2025-2026 Hugo He, MIT. This is an original native-JSON
adaptation, not a bundled copy or execution of the Python/SVG runtime. It does
not claim parity with image treatments, Boolean geometry, effects, template
reconstruction, research, animation, or vision-based rendering review.

The native contract now includes three-column pages (three rounded AutoShapes
containing native text), labels inside arbitrary custom AutoShapes, and per-page
carrier receipts. Cover/content/closing briefs preserve that roster; the opening
and closing place images on opposite sides. Images may remain placeholders
without suppressing the native content composition. Authoring version handshake
prevents an older running companion from silently bypassing the new prompts.


## Quick Generate effort

The Create slide effort selector carries an explicit `authoringEffort` through
context compaction to both cloud providers and the local workflow. Explicit
`quick`/`detailed` wins over topic text; callers without that field may select
Quick with the words “quickly”, “quick”, or “fast”.

This adapts the pinned upstream `workflows/profiles/quick-generate.md`: choose
one solution directly, retain factual and native-authoring capabilities, and
finish with checks rather than an unconditional second design pass. Cloud
Quick returns the first valid complete deck after schema, compilation and
composition checks, with at most one targeted deck correction when needed.
Detailed retains the automatic design review and composition repair path.
The local 4B model retains a transient roster and bounded per-page SVG calls
for output capacity, but skips its separate model review/redraw stage. Invalid
outlines and SVG still get their existing bounded correction attempts.

This is the editor's in-memory adaptation; upstream filesystem planning,
confirmation and PPTX CLI stages are not executed by the browser agent. Quick
does not set provider-specific reasoning parameters or remove image/native
object capabilities. Progress and execution details identify the workflow.


## Native slide backgrounds

After native shapes and motion are compiled, eligible leading full-canvas opaque
rectangles and picture layers become `page.bg.bgPr` fills instead of selectable
objects. Solid colors and full-canvas gradients retain native fill definitions;
background pictures retain their media target, source crop and attribution.
Oversized cover pictures combine the visible slide crop with the source crop.
Licensed image credits remain on the slide, and image counts include native
background pictures. Layout previews and contrast review read the background fill.

Only bottom layers that cover the slide qualify. Rounded contours, foreground
panels/overlays, borders, transparency, effects, links and animation targets retain
their original shape behavior. Background image provenance is stored in agent
metadata. The normal PPTX background exporter writes the native `p:bg`, image
relationships and media, and persisted slide data retains the same background.
Media cleanup recognizes native background image references.

This applies to new agent insertion and replacement; existing slide contents are
not changed automatically.
