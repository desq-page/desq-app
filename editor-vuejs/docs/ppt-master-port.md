# PPT Master JavaScript / Desq port

## Running path

The Gemini and ChatGPT companions now load the actual pinned upstream plan-core
and executor design references. Their transport override asks the model to author
complete SVG pages, not choose Desq's old composition presets. This is the
upstream SVG authoring boundary with a JavaScript native-object compiler in place
of Python's DrawingML/XML packager. One designed slide is supported too.

`desq_create_deck` takes `slides: [{title, purpose, layout: "svg", svg: "…"}]`.
The full page belongs to SVG: the compiler adds no title band, background, rounded
cards or layout decoration. The existing tool, asset resolver, persistence and
Undo paths remain the editor integration boundary. Legacy layouts remain for
backward compatibility and existing native chart/table authoring.

The old native-shape quotas and preset-variety gate do not apply to SVG decks.
Page-job/content/geometry review and an upstream-guided correction remain. The
model reviews a scene summary; it does not yet receive rendered pixels.

## Provenance

Upstream: https://github.com/hugohe3/ppt-master

Pinned commit: `b113d23720260c411ee47b2b05a73615f954deeb`.
Unmodified source references, selected data and compatibility SVG pages are in
`third_party/ppt-master/`, with the complete MIT license and source/hash manifest. Copyright (c) 2025-2026 Hugo He.

The direct JavaScript port maps affine composition, inherited SVG paint/geometry,
font units and traversal semantics to Desq's DrawingML-shaped JSON. The SVG
path grammar and Bezier/arc normalization use `svg-pathdata`; the output remains
native paths, not SVG images. Python is not loaded or executed at runtime.

## Implemented

- Ordered SVG traversal; nested groups; bounded local `defs`/`use` expansion.
- Rectangles and rounded corners, ellipses/circles, lines, polygons/polylines,
  complete SVG path commands normalized into native freeform geometry.
- Translation, scale, rotation and affine matrix transforms on geometry.
- Fill/stroke inheritance, inline literal geometry, opacity, stroke width,
  common caps/joins, dashes, native arrowheads, non-scaling strokes, object-bounds
  linear/radial gradients, native patterns, RGB/RGBA paints and stop alpha.
- Upstream shadow/glow filter builders mapped to native `effectLst`, including
  blur/offset/color/alpha-transfer semantics and upstream's shadow-alpha tuning.
- Editable text and inline styled spans: fill, size, bold/italic, letter spacing,
  font-family selection, text anchors, positioned span frames, rotation/reflection,
  gradient text fills and native text effects.
- Upstream `data-pptx-prst`, `data-pptx-frame`, and adjustment metadata; the full
  guide formula operator set and defaults for all 187 presets. The earlier
  `data-pptx-preset` rectangle alias remains compatible.
- Local picture clipping contours, rotated/reflected pictures and native source
  crop rectangles for `preserveAspectRatio` slice placement.
- HTTP(S)/mailto links and standard slideshow jump actions through native text
  hyperlink/shape relationship fields.
- Preserved `data-pptx-shape-style` DrawingML decoded directly to native style
  references and color modifiers, with relationship-bearing payloads rejected
  consistently with the upstream contract.
- Image description slots through `data-query` and `aria-label`, resolved by the
  existing Wikimedia/provider path. Failed generation retains a described native
  placeholder. Successful images keep provenance and a host attribution footer.
- Native scene previews, cloud review/repair, all-page preflight before insertion,
  and the normal native save/Undo path.
- Native chart/table/formula metadata replacement, including classic chart caches,
  seven ChartEx families and embedded Excel workbooks for Edit Data, weighted and
  merged table cells with rich text, and block/inline Office Math equations.
- All 203 upstream authored animation presets and 48 native transition records;
  native timing export, object-ID remapping, click targets and preset options.
- Union, intersection, subtraction, XOR/combine and fragment operations on curved
  contours through Paper.js. Boolean text uses actual font glyph paths, including
  document fonts and bundled Carlito; preview deferral never reaches insertion.
- Bundled upstream font metrics, Windows/script font fallback, exact rational
  baseline rounding, whitespace normalization, decorations and super/subscript.
  Explicit paragraph line metadata combines authored spans into native paragraphs.

Use viewBox `0 0 1280 720`; the compiler scales to the current document dimensions.
Keep the last 26 design pixels clear on image pages for licensed-image credits.

## Explicit gaps

This is the core SVG authoring/conversion port, not the entire upstream product.
The audit and [module/function inventory](ppt-master-audit.md) distinguish editor
capability from transport coverage. Remaining unconnected branches include CSS
stylesheets/classes, sheared-text outlining and preserved imported-object payloads.
The native metadata paths are now connected, but advanced chart options, the full
upstream LaTeX profile (including chemistry), animation scheduling/audio sidecars
and imported-source freshness/style/relationship contracts are not exhaustive.
These are port gaps, not unsupported
Desq/PPTX features. External image resources are resolved through the host's
asset pipeline rather than arbitrary model-authored file paths or URLs.

Arbitrary SVG masks are also explicitly rejected by upstream PPT Master's
`project_mask_errors`; native picture clipping is a separate supported path and
is now mapped. SVG filters follow upstream's native shadow/glow contract, not a
general-purpose SVG filter-compositing engine. Non-picture clipping requires
upstream contour/Boolean conversion, which is still separate.

Text width uses browser font measurements when available, otherwise an estimated
advance; baseline placement now uses the upstream font tables and rational
rounding, including the fixed unknown-font fallback. Font availability, fallback
and weight mapping can differ from upstream/PowerPoint. Pixel-identical text is
not claimed. SVG previews show actual converted paths and runs, but do not prove
the final Desq/PPTX renderer is pixel-identical.

Upstream research/intake, template reconstruction, advanced effects,
structured masters, narration, source-preserving roundtrips and
vision-based review remain separate unported branches. Python reference imports
are retained for provenance and further work, not as an executable fallback.

## Native transport

Use `<g id="data" data-pptx-replace-with="chart|table|formula"
data-pptx-native-authority="json"><metadata type="application/json">…</metadata></g>`.
The JSON requires `x,y,width,height`. SVG fallback children are replaced once.
Tables accept `columns,rows,column_widths,row_heights,header_rows,style`; cells may
hold `text`, rich `paragraphs`, `col_span` and `row_span`. Charts accept upstream
`type,categories,series` or ChartEx `values,levels`. Equations accept `latex` and
styling. Inline equations use `data-pptx-inline-formula` on a tspan.

`slide.booleans` holds ordered `{operation,source_ids,output_id}` commands. Every
operand must identify a closed contour or text with an available font. Results
stay in slide coordinates and replace operands at their original z-order.

`slide.motion` holds `{transition,animation,groups}`; groups map stable SVG or
Boolean output IDs to one effect or an `effects` list. Names come from the pinned
upstream registry (`entrance_*`, `emphasis_*`, `path_*`, `exit_*`). Common timing
and effect parameters are validated before insertion. Cloud previews can defer
font outlines; the adapter must resolve them and compile strictly before saving.

The glassmorphism fixture highlights an upstream approximation: Gaussian blur is
projected to a native glow, retaining a sharp source silhouette. It is not
pixel-identical to the original SVG blur. The paired proof makes this visible.

## Verification and operation

`npm run test:ppt-master-port` checks unmodified upstream editorial, Swiss,
Memphis, soft-rounded and glassmorphism pages plus transforms, paint, effects,
text, picture clips/crops, guide formulas, image manifests and rejection cases.
It also checks all 203 animation presets, all 48 transitions, native equation
serialization, chart workbook ZIP roundtrips, merged tables and actual-font
Boolean text. Shared tests cover affected XML persistence/import/export behavior.
`npm run test:editor-agent` includes native adapter insertion and rejects a bad
later SVG before any page is inserted.

`node scripts/preview-ppt-master-port.mjs [output-directory]` renders paired
upstream and compiled-native layout proofs and writes native page JSON. Left is
the original SVG; right is reconstructed from converted native objects.

Restart the editor server (`npm run dev` in development) and refresh the editor.
The authoring-version handshake requires `ppt-master-svg-v3`, preventing older servers from supplying
the previous preset-only instructions. Live model quality still requires an
authenticated provider run; compatibility tests use local fixtures/mocks.
