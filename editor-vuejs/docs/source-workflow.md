# Shared source workflow

Source documents can be attached in the agent pane for either cloud or local
providers. Supported inputs: PDF, DOCX, PPTX, HTML, Markdown and plain text. A topic
is optional after attaching a source. Each source offers **Inspect extracted
source**, downloading its full content/design manifest for review.

Intake is read-only and does not open the source as the current editor document.
Every bundle has a unique ID, stable block IDs, factual text blocks, design
metadata, original source bytes, asset metadata and warnings. The original bytes
and embedded Office media remain available separately from prompt data.

- PDF: existing PDF.js runtime, page sizes/rotation, text spans with transforms,
  dimensions and font identity, page font metrics and image operator references.
  All pages are visited. Pages with no extractable text are explicitly flagged as
  needing OCR; no OCR is currently bundled. Image/vector content stays in the
  preserved original PDF; PDF images are not currently decoded into photo slots.
- DOCX: existing `parseDocumentXml` parser, including styles, numbering, theme,
  relationships and chart parts. Paragraph content, parsed objects, tables/chart
  data, page dimensions/margins and embedded media are retained.
- PPTX: the existing ordered XML codec, preserving slide XML as evidence. Logical
  slide order comes from presentation relationships. Canvas size, palette/fonts,
  master/layout/theme/relationship parts, chart series caches (including typed
  X/Y/bubble size points), SmartArt XML, notes and embedded media are retained.
- HTML and Wikipedia: inert HTML parsing into section blocks with image-reference
  metadata and heading/style evidence. Scripts, navigation and edit controls are
  excluded. HTML is never mounted or executed, and arbitrary image URLs are not
  downloaded. URL sources, including Wikipedia article URLs, use this same HTML adapter.
  Enter a URL and click **Add URL** before generating with any provider. The host
  retrieves public HTML with a 20-second timeout, a 5 MB limit and validated
  redirects. Pages requiring login or client-side rendering may lack readable text.

Cloud agents receive a bounded source context and a source-first planning
instruction: source evidence → narrative/content → compatible layouts → slide
objects. Local generation receives bounded source windows and design evidence
alongside its existing planning/filling requests. Context omissions are reported
in the source context; this does not guarantee every fact appears in the deck.
Manual preservation requests take priority over source styling as a reference.

Generated image slots can use an exact source asset ID as their image query.
Supported supplied raster assets bypass web search and receive source attribution.
Office vectors and other unsupported raster formats retain original bytes and
produce described placeholders when requested as images.

At insertion, canonical manifests, originals and asset bytes are saved under the
document's local OPFS `_internal/agent-sources` directory. Slide metadata points to
those manifests. This is local project storage;
portability of those internal sources through every external export format is not
promised. Ordinary deck save, undo, fitting and export checks still apply.

Current limits: 50 MB per input, 100 MB per decompressed Office entry and 250 MB
per Office archive. Cloud source text context defaults to 50,000 characters;
per-block evidence/design prompt excerpts are bounded separately. Local prompts
use smaller windows. Full extracted manifests remain inspectable. Native PDF
reading order can differ from visual order, and scanned PDF OCR remains a separate
future capability; LiteParse is not installed.

built-in design templates use the same PPTX intake. Their 16 packaged decks and
383 layouts load separately from factual sources; parsed geometry and editable
field metadata guide layout selection. See [the template library](native-pptx-templates.md).
