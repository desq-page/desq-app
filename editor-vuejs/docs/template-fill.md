# Built-in PPTX templates

The common **Design template (PPTX)** selector has one **Built-in** template,
with twelve layouts. The model automatically chooses one Office color scheme for
the whole deck from a supplied collection of 24 schemes. There is no manual
color selector. The collection includes Office, Blue, Green, Median, Paper,
Aspect and other standard PowerPoint color schemes, with their exact twelve RGB
values extracted from installed PowerPoint color resources.

One `builtin.pptx` base uses native `schemeClr` references in its layouts. The
chosen palette updates the linked theme color scheme, keeping the master,
layouts and placeholder IDs. Opening the exported PPTX in PowerPoint lets users
apply its built-in color schemes to those theme-linked objects.

The layout definitions remain in `template-fill.mjs`. The converter in
`scripts/lib/builtin-template-scene.mjs` reads those exact geometries, text styles,
decorations and field capacities; `scripts/build-builtin-templates.mjs` builds the
PPTX assets and catalogue for the built-in library. No separate fixed-layout planner
is selected in the UI. Legacy internal HTML filling helpers remain for old tests
and compatibility.

# Legacy HTML implementation

The former **Template Fill · fixed layouts** was an optional local workflow. Twelve curated,
host-authored compositions provide bold opening, photo story, editorial statement,
two-way comparison, three ideas, four-step process, three metrics and closing with
a picture, photo-led story, three-part agenda, three milestones and idea spotlight. Seven coordinated palettes include ocean, forest, ember, plum, graphite,
midnight and terracotta. These are a small tested layout system, not exact imports
of all 383 built-in layouts. The default **built-in templates / Freeform** workflow uses the converted PPTX
families. Older decks report this legacy workflow as **Built-in fixed layouts**.

The model selects a layout and supplies JSON text/image keywords; it does not write
HTML, SVG or CSS. Users can choose a layout/palette manually. Auto chooses a palette
on the first slide and retains it across the deck. Each clean slide uses one bounded
content inference (1024 output tokens), without a separate design brief or review.
Visible content follows the topic/source language unless the user requests another
language; format corrections retain that instruction. Auto selection considers
previous slides and prefers a different suitable layout for the next slide.

The host fills fixed title, label, body, metric and photo placeholders. Font sizes,
colors, shapes and geometry come from the template. Text is escaped. Photo slots
use the existing image resolver and native image/placeholder pipeline. At most eight
photos are resolved per deck; later photo layouts retain a described placeholder.
Cover and photo-story accept omitted item lists. If the model supplies extra points
for these narrative layouts, their labels, values and text join the explanation
before measurement, avoiding a zero-item validation failure.
Other layouts also reconcile item-count mismatches: extra points join the last
item’s explanation; missing slots remain empty without inventing content. Count
adjustments log warnings and do not trigger a format-repair call or reject the deck.

Real browser measurement identifies overflowing field names. One short rewrite
requests only shorter values for those fields. If necessary, local ellipsis fitting
preserves font sizes and box geometry. Original content is retained on the slide in
`agentMetadata.overflowContent` and available via **Download full content**. The
host never replaces the template with generic columns or a whole-slide image.
The content parser accepts a single complete JSON object inside fences/prose and
structured Markdown key/value fields. Format repair is bounded to one attempt,
switching to plain field lines with a larger 1536-token budget. Invalid responses
log a bounded preview in the local console for diagnosis; unsafe model markup is never executed.
Creation count, current-slide replacement, cancellation, Undo and normal JSON/PPTX
export continue through the existing editor pipeline. Metrics must use supplied
values; model factual correctness still requires review.

Verification: `npm run test:html-slides` covers all twelve layouts in all seven
palettes, native text/images, content-only rewrites and source preservation.
`npm run test:editor-agent` includes JSON validation and existing regressions.
Live local-model response quality and latency are not established by mocked tests.

Image credit footers show full supplied titles, authors and licenses with compact
Source hyperlinks instead of long printed URLs. Full credit records also remain
in slide metadata. If a credit still cannot fit the reserved footer, that picture
becomes a described placeholder with a warning; the deck keeps its requested slide
count and other usable images. Credits are never silently truncated.
