# Insert HTML Slide

Create one self-contained HTML slide using the deck dimensions, theme, and context in the prompt.

## Document and layout

Return a complete HTML document with inline CSS, inline JavaScript, and any required assets embedded. Fit the full slide in the viewport. Keep visible text in ordinary HTML elements so it stays editable.

## Images and illustrations

When a visual would clarify the topic or improve the composition, include an embedded picture, an inline SVG illustration, or a styled image placeholder. Use relevant visuals and embed raster pictures as data URLs.

For a visual the user may want to change, put the picture, SVG, or placeholder label inside a `div` with a unique `id` and a `data-desq-image-placeholder` attribute. Set the attribute value to a short description of the intended image. Give the container a width and height independent of its contents, set `position: relative` (or keep its existing absolute positioning), and use `overflow: hidden` to preserve rounded corners. Keep headings, captions, and interactive controls outside the container.

```html
<div id="wetland-photo" data-desq-image-placeholder="A wetland at sunrise"
     style="position:relative;width:420px;height:260px;overflow:hidden">
  <span>Wetland photo</span>
</div>
```

In the editor, double-click a marked visual or focus it and press Enter to choose a replacement image. DESQ embeds the image and fills the existing space.

## Interaction

Choose an interaction that helps explain the topic, such as tabs that switch information panels, a quiz with immediate feedback, or a slider that updates a chart. Include at least one visible, clearly labeled control that changes what the audience sees. Include a reset control when the interaction has multiple steps.

Write the initial view and controls directly in the HTML. Use native buttons or form controls with keyboard support. Keep all behavior inside this slide. For custom click targets, use a button or call `event.stopPropagation()` so the presentation stays on the slide. Use no external libraries, network requests, or parent-window APIs.

Return only the HTML so it can be pasted or uploaded in the Insert HTML Slide dialog.
