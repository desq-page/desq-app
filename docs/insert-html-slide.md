# Insert HTML Slide

Create one self-contained HTML slide using the deck dimensions, theme, and context in the prompt.

## Document and layout

Return a complete HTML document with inline CSS, inline JavaScript, and any required assets embedded. Fit the full slide in the viewport. Keep visible text in ordinary HTML elements so it stays editable.

## Interaction

Choose an interaction that helps explain the topic, such as tabs that switch information panels, a quiz with immediate feedback, or a slider that updates a chart. Include at least one visible, clearly labeled control that changes what the audience sees. Include a reset control when the interaction has multiple steps.

Write the initial view and controls directly in the HTML. Use native buttons or form controls with keyboard support. Keep all behavior inside this slide. For custom click targets, use a button or call `event.stopPropagation()` so the presentation stays on the slide. Use no external libraries, network requests, or parent-window APIs.

Return only the HTML so it can be pasted or uploaded in the Insert HTML Slide dialog.
