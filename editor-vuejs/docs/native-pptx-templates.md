# Native built-in template generation

Choosing the built-in family now uses its PPTX package as the base for new slides.
The model fills placeholders; it does not recreate the design in HTML or SVG.
Built-in templates share this native workflow. Freeform HTML remains available.


## Schema-first content generation

After reading a PPTX family, the app builds a JSON content schema for each native
layout from its parsed placeholder descriptors, names, kinds and text geometry.
Unique fields use readable names. Repeated cards, metrics and timeline steps are
arrays whose members bind to distinct native placeholder IDs. Text lists, image
requests, table rows and chart data retain their own types. Decorations are not
part of the content schema. Character targets guide concise writing; they do not
cause truncation or change template styles.

Cloud generation first selects a single family and one layout per slide from the
outline. It then sends only each selected layout's exact content schema, slide
brief and source evidence to the active provider. Gemini receives the JSON schema
as its structured response configuration as well. Local generation receives a
bounded shortlist of layout schemas and returns its chosen layout plus content.
Neither path asks the model to construct editor tool arguments or native IDs.

Generated content is checked against the schema, with one correction attempt for
invalid content. The host maps named values and repeated array members to exact
PPTX placeholders and constructs the editor call. Missing content clears sample
fields. Original master, layout, theme and placeholder identities are retained.
The low-level `templateFields` transport remains for compatibility; it is built
by the host rather than being the default model-facing content format.

## What is preserved

The selector offers one Built-in template with 12 layouts and automatic Office color selection, plus Freeform. The source is `public/templates/builtin/builtin.pptx`; its catalogue and asset integrity metadata live in `src/lib/agent/templates/`. Only the project-authored built-in family is shipped.

The generator assigns stable placeholder role ranges: title `0`, body `1…`, picture `1001…`, chart `2001…`, table `3001…`. Generation preserves these packaged IDs unchanged. OOXML shape IDs remain
separate and retain their source identities.

Generation copies the chosen family's native master/layout/theme parts and their
relationships into the current presentation, with unique package filenames to
avoid collisions. All slides in that generated deck share the imported family
master. A slide points to its chosen native layout and keeps each placeholder's
`p:ph` type and `idx`; its OOXML shape ID is retained too. Text/picture placeholders
inherit their geometry and text style from the layout instead of receiving local
coordinate/style overrides. The app's internal editing IDs are separate.

Users can edit the imported master/layouts or apply another layout using the
existing editor controls. Core master/layout relationships and placeholder
indices remain standard PPTX data on export and reimport. Changing a layout that
has incompatible placeholder IDs may move or omit content according to normal
PowerPoint placeholder matching; the app does not invent ID correspondences.

Native import registers the parts in OPFS and parses them with the shared PPTX
importer into normal editable master/layout/slide records. The existing insertion,
save, undo, thumbnail and export paths remain in use. Slide duplication preserves
agent metadata and placeholder index zero, including explicit title indices.

## Model output

Both cloud and local creation use `desq_create_deck` with `layout: "pptx"`:

```json
{
  "title": "Solar energy",
  "purpose": "Explain the supplied facts",
  "layout": "pptx",
  "templateSelection": {
    "family": "builtin-ocean",
    "layout": "title_slide",
    "modelSelectedLayout": true,
    "hostReflowed": false
  },
  "templateFields": [
    {"id": "0", "text": "Solar energy"}
  ]
}
```

IDs come from the selected layout's supplied field list. Image fields use
`{id, query, alt}`, table fields use `{id, rows}`, and chart fields use
`{id, categories, series}`. Table data must fit the native grid. Native chart
caches and Edit Data workbooks are updated together. Unfilled text/image fields
become blank, and unused chart/table placeholders are omitted. Sample template
claims are not used as factual evidence. Supplied image credits and factual source
manifests remain attached to the generated deck.

The native preflight rejects redrawn HTML/SVG for a built-in creation request,
unknown or duplicate placeholder IDs, unusable content and mixed families.

## Limits

The template base retains the previous conversion limitations: original missing
photos, icons, textures and font binaries are not recovered; specialized diagrams
can be approximations of the upstream JSON design. Standard font substitution can
occur if the original font is unavailable. Normal PPTX inheritance applies:
explicit layout overrides take priority over master formatting.

Creation scales the native parts to the current presentation size. Different aspect ratios use a uniform, centred fit, preserving proportions rather than stretching the design. Existing flat generated
slides are not retrofitted automatically; regenerate them to obtain native links.
Whole-slide agent replacement remains the existing editing workflow; manual
placeholder/master/layout editing uses the native structures directly.

## Validation

The library tests inspect all 395 layouts, relationship links and placeholder
identities. The browser test fills a template as a native PPTX base and exports a
fixture for rendering. Serializer tests cover explicit title indices and `idx=0`.
A master-only background edit has been rendered without editing slide/layout XML
as a check that generated slides actually inherit their master.

## Built-in layouts

The twelve original fixed layouts use one native PPTX base (`builtin-ocean`), shown as **Built-in**. The model chooses one scheme from the 24-entry Office color collection supplied during planning. That palette is applied to `theme.xml`, while layout objects use native theme references. There is no manual palette selector.
Generation uses the same native placeholder planner for cloud and local models.
These layouts are project-authored; they are maintained in this repository.

Text character limits are advisory writing targets. Before insertion, text is
measured in its native placeholder geometry and typography. Text that fits keeps
its full wording even when it exceeds the catalogue character target. Actual overflow triggers one concise rephrasing attempt using the active cloud or local model. If that fails or still does not fit, the entire original text is inserted, even if it overflows. Text is never cut to an ellipsis. Original slide text is retained in `agentMetadata.overflowContent`. Overflow does not reject the deck.

Native slide responses can contain Markdown fences, surrounding commentary or
model stop markers. The parser extracts a complete JSON slide object and then
validates its layout and placeholder IDs. Identical repeated objects are accepted;
conflicting objects or incomplete JSON still trigger the bounded repair attempt.

Image budgets are non-blocking: requests beyond the remaining allowance keep
described native placeholders. The importer resolves at most eight image
requests per deck; reaching that cap does not discard later slides.

Model-returned unique field names (for example `top_date_marker`) and full native
shape names are canonicalised to the layout’s exact placeholder IDs. Repeated
field names require an exact ID or full shape name, preventing content from being
assigned to the wrong repeated item. Original native placeholder IDs are retained.

Creation plans accept model spelling aliases before strict tool validation:
deck/slide `name` becomes `title`, and template-field `name` becomes its field
identifier when no explicit `id` is present. A field label accompanying an
explicit ID is removed from tool arguments. Conflicting deck/slide titles are
reported rather than silently overwritten.

Image request aliases are normalised before tool validation: a template field
may wrap its `query` and `alt` in `image`, or supply an image description string.
A slide-level `image` request targets its explicit placeholder ID or a single
unambiguous image slot. Conflicting requests and ambiguous slots are reported.

Office color data lives in `office-color-schemes.json`. It contains names and
twelve RGB values per scheme, extracted from PowerPoint for Mac 16.112.4 theme
color resources and its current Office theme. It does not bundle Microsoft font,
image or full theme assets. Planning returns `colorScheme` (cloud) or
`OfficeColors` (local); an omitted/unrecognised choice falls back to Office.

The Design toolbar provides Variants, Colors, Fonts, and Background dropdowns. Choices combine on the master used by the selected slide, so all slides sharing that master update together. Colors offers the Office palette collection; Fonts sets heading and body faces. Background can follow the light, dark, or accent variant, or use an explicit theme color. Changes preserve native layouts and placeholder IDs and support Undo/Redo.
