# Design Ideas layout catalogue

The Design Ideas gallery shows two static previews per family. Selecting a
family ranks its compositions against each slide and applies the best fitting
layouts across the deck. When a source composition cannot fit the slide,
DESQ tries a flexible composition with the selected family’s colors and
fonts. Slides whose contents still cannot fit are skipped.
Preview WebPs live in `public/templates/design-families/`. The upstream
families use two of their gallery screenshots. Built-in and original families
use rendered examples of their opening and content layouts.

## Catalogue coverage

- 351 actual slide sections from all 34 `beautiful-html-templates` families.
- 60 original compositions (10 families × 6 content types).
- Five supported adapters from the Built-in family.
- Total: 416 indexed entries.

The upstream README shows 102 gallery previews. Its index claims 358 slides,
but Broadside contains 16 rather than 20, Monochrome 16 rather than 18, and
Neo-Grid Bold 12 rather than 13. Use actual HTML sections as the source of truth.

`source-layout-geometry.json` records per-slide measured geometry, source file
SHA-256, source labels, marker locations, and rejection reasons. It is generated
from the real HTML/CSS, not from keyword-to-generic-role assignments.
`source-layouts.mjs` exposes those source-specific compositions to the fitter.
Content-only slides can omit the title slot in non-cover compositions; bullet
items remain body content and keep the measured body-slot geometry.
The original generic role metadata remains in `template-catalog.json` for theme
metadata/backward compatibility; `withSourceLayouts()` replaces its variants
before ranking. Original generic roles are not offered under source family names.

To regenerate from an upstream checkout (Chrome required):

```sh
node scripts/build-source-design-layouts.mjs /path/to/beautiful-html-templates
```

The measurement tool disables source JavaScript, retains styles/fonts, and records
native content slots and basic panels. It is an adaptation, not a full HTML/CSS
renderer: SVG illustrations, textures, shadows, and arbitrary interactions are
not reproduced. Layouts that need unsupported structured bindings stay indexed
with an explicit reason and cannot be applied directly. Chart regions require existing native charts. Photo regions
require actual pictures. No source sample copy or numeric data is inserted.

## Original layouts

The 60 additions retain their ten names, but now use explicit spatial arrangements
rather than a repeated six-layout loop with minor spacing changes. Openings,
explanations, cards, photographs, charts, and connected process diagrams have
separate compositions. The same geometry may support different asset types;
only the compatible type is eligible for a slide.

Colors and background remain shared across the deck. Each template family
uses its own heading and body typefaces, with consistent roles within that family.
Measured source font sizes and panel geometry are preserved, with an 18 pt body
minimum for Pin & Paper on a 1280 × 720 slide. Existing chart series formatting
and chart data are retained. Full-slide rectangles are not inserted as content;
the shared native slide layout owns the background.

## Validation

```sh
node --test scripts/source-design-layouts.test.mjs scripts/generated-design-templates.test.mjs scripts/reformat-cobalt-grid.test.mjs
node --test scripts/source-design-layouts.browser.test.mjs
```

Set `DESIGN_PREVIEW_DIR` for the browser test to save actual editor-rendered PNGs
and markup for visual review. These tests verify source identity, geometry,
content preservation, duplicate suppression, materially different additions,
and visible, decodable thumbnails. They do not verify every PowerPoint export.
