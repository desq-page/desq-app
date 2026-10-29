// Shared regression/visual-proof fixture. All numerical targets are explicitly illustrative.
export function designSample() {
  return { title: 'A practical solar pilot', audience: 'Business leaders', objective: 'Approve a measured pilot',
    strategy: { thesis: 'Start small and measure before expanding.', narrative: 'Decision, options, delivery, evidence and next action.', visualStyle: 'Forest palette, flat diagrams, generous whitespace.' },
    design: { palette: 'forest' }, slides: [
      { title: 'Start small. Learn before scaling.', purpose: 'Frame the decision', layout: 'cover', variant: 'standard', subtitle: 'A practical solar pilot for business leaders' },
      { title: 'Three questions guide the decision', purpose: 'Orient the audience', layout: 'agenda', items: [
        { title: 'Why now?', body: 'Assess resilience and site constraints.' }, { title: 'What should we test?', body: 'Compare two ways to run the pilot.' }, { title: 'How will we decide?', body: 'Agree on evidence before committing.' }] },
      { title: 'A pilot turns assumptions into evidence', purpose: 'Explain the rationale', takeaway: 'Learn before expanding', visualConcept: 'An editorial panel highlights the key conclusion.', layout: 'content', variant: 'split', bullets: ['Check site suitability before procurement.', 'Measure operating performance in real conditions.', 'Use results to decide the next investment.'] },
      { title: 'Choose the scope that answers the question', purpose: 'Compare alternatives', layout: 'comparison', items: [
        { title: 'Single-site pilot', body: 'A smaller commitment with a focused learning objective.' }, { title: 'Multi-site pilot', body: 'More coverage, with greater coordination and effort.' }] },
      { title: 'Agree on measurable pilot targets', purpose: 'Make success concrete', layout: 'metrics', subtitle: 'Illustrative planning targets; not forecast results', items: [
        { value: '3', title: 'Sites', body: 'Illustrative scope for initial screening.' }, { value: '90 days', title: 'Review window', body: 'Illustrative time to gather evidence.' }, { value: '1', title: 'Decision', body: 'Expand, adjust or stop after review.' }] },
      { title: 'Move from screening to a clear decision', purpose: 'Explain delivery', layout: 'process', items: [
        { title: 'Assess', body: 'Gather site and operational requirements.' }, { title: 'Test', body: 'Run a focused pilot and record results.' }, { title: 'Decide', body: 'Review evidence against agreed criteria.' }] },
      { title: 'A useful pilot balances four needs', purpose: 'Explain relationships', layout: 'hub-spoke', takeaway: 'A decision backed by evidence', items: [
        { title: 'Operations', body: 'Keep delivery practical.' }, { title: 'Finance', body: 'Clarify costs and assumptions.' }, { title: 'People', body: 'Assign owners and decision rights.' }, { title: 'Evidence', body: 'Measure what changes the decision.' }] },
      { title: 'Review progress at explicit milestones', purpose: 'Sequence the work', layout: 'timeline', items: [
        { title: 'Screen sites', body: 'Identify suitable locations.' }, { title: 'Prepare pilot', body: 'Agree scope and responsibilities.' }, { title: 'Measure', body: 'Gather operating evidence.' }, { title: 'Review', body: 'Choose the next step.' }] },
      { title: 'The goal is a better decision.', purpose: 'Reinforce the thesis', layout: 'statement', variant: 'band', subtitle: 'A successful pilot can support expansion, a revised approach, or a decision to stop.' },
      { title: 'Approve the discovery phase', purpose: 'Request a concrete action', layout: 'closing', variant: 'split', subtitle: 'Confirm the sponsor, select candidate sites, and agree on the evidence needed.' },
    ] };
}

export const HELLO_WORLD_PROMPT = 'Quickly generate a simple 3-page test PPT with a cover, one content page, and a closing page. Make it colorful with images. Topic: "Hello World". No need to confirm with me.';
export function helloWorldSample() {
  return { title: 'Hello World', audience: 'A general audience', objective: 'Test a concise, colorful editable presentation',
    design: { palette: 'ocean', background: '#FFFFFF', accent: '#087F8C', secondary: '#D07635' },
    strategy: { thesis: 'A simple greeting can start something new.', narrative: 'Welcome, three ideas, invitation.', visualStyle: 'A quiet white canvas with teal and orange accents; native rounded modules.' }, slides: [
      { title: 'Hello World', purpose: 'Welcome the audience', layout: 'cover', subtitle: 'A small greeting. A new beginning.', images: [{ query: 'colorful abstract hello world greeting illustration', alt: 'A colorful greeting illustration' }] },
      { title: 'A greeting opens possibilities', purpose: 'Explain three peer ideas', layout: 'three-column', relationship: 'membership', items: [
        { title: 'Say hello', body: 'Start a conversation with a simple greeting.' },
        { title: 'Connect ideas', body: 'Share a thought and discover a new perspective.' },
        { title: 'Create together', body: 'Turn that first connection into something useful.' }] },
      { title: 'Let’s begin', purpose: 'Invite the next step', layout: 'closing', subtitle: 'One hello can be the start of something good.', images: [{ query: 'warm colorful abstract new beginning illustration', alt: 'An illustration of a new beginning' }] },
    ] };
}
