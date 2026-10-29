# HTML slide authoring and built-in templates

The agent pane has a **Slide design** selector for ChatGPT and Gemini: SVG retains
the existing PPT Master route; HTML enables browser layout. Local models now default
to direct HTML for Qwen and Gemma; see [local runtime notes](local-markdown-models.md). The **Built-in** template provides twelve layouts with automatic Office color selection; **Freeform** supports HTML authoring. See [the template library](native-pptx-templates.md).
Create and Edit current slide both use the selected format and exact slide count.
The normal save, Undo, thumbnail and PPTX export paths remain the integration boundary.

## Conversion

`savanna_create_deck` accepts `slides: [{title, purpose, layout: "html", html: "…"}]`.
Each HTML string contains one `section`, positioned at 0,0 and sized 1280×720.
Use inline CSS or a local style element inside the section. The model does not
produce React, executable scripts, or PPTX bytes.

`html-slides.mjs` validates inert template content before mounting it in a
script-disabled, network-blocked iframe. The browser resolves flex/grid/absolute
layout, CSS inheritance, text wrapping and inline font styles. Element bounds and
text ranges become a temporary SVG geometry transport. `compileDeck` feeds that
transport through the existing SVG-to-native converter. The output is native
editor JSON with text bodies, shapes, paths and picture references, so the
existing PPTX exporter produces editable objects without an HTML embed or a
whole-slide screenshot. The original HTML does not execute in saved slides.

Already-loaded host font faces are reused for measurement; the adapter loads
requested document/Google fonts and recompiles before insertion. Font availability
and PowerPoint metrics can still affect final wrapping. Native previews show the
converted objects, not a screenshot of the original HTML.

Images use `img data-query="solar panels" alt="Rooftop solar"` and explicit CSS
width/height. No src or srcset. Their manifests use the existing SVG image keys,
image search/generation, attribution, storage, cropping and placeholder pipeline.
Keep the last 26px free on image slides. Rounded image clips use native picture
clipping. At most eight image slots are permitted across a deck.

The entire deck is checked before insertion. The default local HTML planner chooses a compact shared style/title/layout brief, then requests each final section directly. Local contrast/spacing fixes and bounded vertical-whitespace fitting run first; oversized layouts can then use a host-owned column reflow preserving text and media; significant findings can request one repair per slide. The legacy staged planner generates a storyboard,
authors one HTML slide per inference, retries each invalid slide once, and runs
the existing native review/preview checks. Detailed mode can request specific
page revisions. Cloud providers receive the HTML-only schema and instructions;
the existing repair/review loop validates their drafts before execution.

## Built-in templates

The project-authored built-in family provides 12 native PPTX layouts. See [the
loading workflow](native-pptx-templates.md). Generate its PPTX and source catalogue
with `scripts/build-builtin-templates.mjs`.

`presenton-pptx.mjs` loads and validates the native PPTX template families. When
built-in is selected for creation, cloud and local agents fill native placeholder
IDs while retaining masters, layouts and theme relationships. See [native PPTX
templates](native-pptx-templates.md). This HTML authoring guide applies to Freeform
and existing whole-slide replacement flows; built-in creation no longer redraws
its base as HTML.

## Supported boundary

- Block, flex, grid and absolute layouts; padding, margins, CSS classes and styles.
- Editable HTML text, rich inline styles and browser-measured line positions.
- Solid fills, uniform solid borders, uniform pixel/percentage corner radii, and opacity.
- Literal-string, attr(name), and empty decorative ::before/::after content materialized as editable text/shapes before layout extraction. Unresolved expressions use editable labels with warnings.
- CSS box-shadow mapped to native shadow/glow effects. The first outer shadow is retained; spread is approximated through blur and inset shadows are omitted with warnings.
- Image slots with contain/cover/fill and rounded picture clipping.
- Simple inline SVG geometry through the existing converter.

Visual fidelity limitations log warnings and continue. Nonuniform borders become
separate editable edge lines; dashed/dotted borders retain dash patterns, and
other border styles use solid lines. Nonuniform corner radii use the first corner.
Transforms, filters, masks, clipping, blend modes and text shadows are omitted;
measurement runs after removing effects that change geometry. Gradients use a
solid first-color approximation when possible. Text-transform and list markers
become literal editable text. Stacking follows document order, and animation is
frozen. Unresolved generated CSS content is retained as an editable expression
label. Native conversion warnings appear in the browser console and the agent's
completion response; they do not prevent later slides from being inserted.

Unsafe markup/resources, malformed slide structure, invalid content, missing image
descriptions, invalid canvas dimensions, out-of-bounds/clipped text and complexity
limits remain blocking errors. They are not suppressed by the visual-warning
policy. Tailwind/CDN runtime dependencies remain unsupported: use actual CSS.
HTML tables become editable cell shapes/text, not native PowerPoint tables. Inline
SVG remains subject to its own converter constraints. File-based imported assets
and external HTML uploads are not a UI flow.

## Verification

`npm run test:html-slides` runs transport and template tests and a real headless
Chrome layout test (set `CHROME_BIN` on nonstandard installations; browser test
skips when Chrome is absent). It checks every imported layout, flex/grid, rich
text, scaled native JSON, previews, image manifests/placeholders, unsafe markup,
frame cleanup, the local HTML repair path, and native text through the real PPTX serializer. `npm run test:editor-agent` includes
the HTML contract tests and existing insertion, persistence and PPTX serializer
regressions. Live model design quality still requires a loaded local model or an
authenticated provider; automated model responses are fixtures.

Restart the editor server and refresh the app after updating. The authoring
handshake is `html-svg-browser-v6`.

## Morph continuity

Cloud SVG and HTML prompts require consecutive endpoint slides with matching explicit
`!!` ids and Morph on the destination slide. SVG ids belong on individual native
objects, rather than multi-object groups. HTML elements retain separate `:box`,
`:text` and `:image` identity suffixes for the native objects they produce.
The compiler rejects Morph on the first generated slide, absent or duplicate pair
keys, unmatched destination keys and incompatible text/image/shape pairs before
insertion. Full-canvas paired objects remain shapes instead of becoming backgrounds.
Single-slide replacement cannot validate its preceding endpoint and should use a
different transition. Existing decks are not retroactively paired.

Generated HTML images that accidentally include `src` or `srcset` are normalized
inside the inert template before mounting. Resource URLs are discarded. Existing
`data-query` is retained, or descriptive `alt` becomes the query; missing alt is
filled from the query. The host resolves the resulting image slot normally.
Images without either description still require repair. Other resource attributes
and executable markup remain blocking errors.
