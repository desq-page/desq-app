export const AUTHORING_GUIDE_URL = 'https://desq.page/AGENTS.html';
export const INTERACTION_GUIDE_URL = 'https://desq.page/docs/html-slide-interactions.html';

// The public URLs keep prompts short and point agents at the published contract.
export function buildHtmlAuthoringPrompt(description) {
  const request = description.trim();
  if (!request) return '';
  return `Build the app, game, lesson or presentation described below as a complete standalone HTML slide experience for DESQ.

Before authoring, read and follow the DESQ authoring guide: ${AUTHORING_GUIDE_URL}
For interactive apps and games, also read: ${INTERACTION_GUIDE_URL}
If you cannot access these guides, ask me to provide them; do not claim you have read them.

For a business presentation, use https://github.com/zarazhangrui/frontend-slides as a design baseline with the DESQ requirements layered on top. For an app or game, plan every screen and branch, include appropriate animations and morph-style transitions, and make buttons, feedback, restart paths and other interactions work in the downloaded HTML.

Deliver a downloadable UTF-8 .html file, not JSON, a screenshot, a preview-only link or a partial snippet. Use explicit slide markers and stable IDs. Follow the referenced interaction guidance without claiming proposed native APIs are already implemented. Verify the result in a browser before delivering it.

USER'S REQUEST
${request}`;
}
