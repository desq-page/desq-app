export function buildAgentTask({ mode, topic, command, count, effort, slideAuthoring = 'svg', local = false }) {
  if (!['svg', 'html', 'markdown','pptx'].includes(slideAuthoring)) throw new Error('Choose SVG, HTML or Markdown authoring.');
  if (mode === 'edit') {
    const instruction = command.trim();
    if (!instruction) throw new Error('Enter a command to update the current slide.');
    return {
      label: `Edit current slide: ${instruction}`,
      prompt: `Create exactly ONE replacement for the CURRENT slide with this update: ${instruction}\n${local ? (slideAuthoring === 'markdown' ? 'Write the complete replacement slide in Markdown now, including its actual content. The application handles insertion and replacement; do not issue editor commands.' : 'Author exactly one complete replacement slide in the requested format now. The application handles insertion and replacement; do not issue editor commands.') : `Return one desq_create_deck call with exactly ONE layout=${slideAuthoring} slide.`} The editor will replace the current slide in place. Use the current slide context to preserve content and intent unless the update changes them. Do not add slides or use separate shape-editing calls.`,
    };
  }
  const auto = count === 'auto';
  if (!auto && (!Number.isInteger(count) || count < 1 || count > 10)) throw new Error('Choose a slide count from 1 to 10.');
  if (!['quick', 'detailed'].includes(effort)) throw new Error('Choose Quickly or Detailed.');
  const subject = topic.trim();
  if (!subject) throw new Error('Enter a topic for your slides.');
  if (auto) return {
    label: `Create slides · Auto · ${effort === 'quick' ? 'Quickly' : 'Detailed'}\n${subject}`,
    prompt: `Create an editable presentation about: ${subject}\nChoose an appropriate number of slides from 1 to 10 based on the topic, supplied content and audience. Honor an explicit count in the request within this range. Do not pad the deck. Effort: ${effort === 'quick' ? 'Quickly: choose one solution and author it in one pass.' : 'Detailed: plan, review and refine the complete draft.'}\n${local ? (slideAuthoring === 'markdown' ? 'Write complete Markdown content. Use one ## Slide N: Title heading per slide.' : 'Author complete slides in the requested format now.') + ' The application inserts the slides; do not issue editor commands.' : `Use one desq_create_deck call with layout=${slideAuthoring} slides. Insert after the current slide.`}`,
  };
  return {
    label: `Create ${count} slide${count === 1 ? '' : 's'} · ${effort === 'quick' ? 'Quickly' : 'Detailed'}\n${subject}`,
    prompt: `Create exactly ${count} editable slide${count === 1 ? '' : 's'} about this topic: ${subject}\nEffort: ${effort === 'quick' ? 'Quickly. Use the Quick Generate workflow: choose one solution directly and author it in one pass, retaining the requested content and visual quality.' : 'Detailed. Develop the explanation and visual narrative, then review and refine the complete draft within the requested slide count.'}\n${local ? (slideAuthoring === 'markdown' ? `Write complete Markdown content for exactly ${count} slides now. Use one ## Slide N: Title heading per slide. The application renders and inserts them; do not issue editor commands.` : `Author content for exactly ${count} slides in the requested format now. The application inserts the slides; do not issue editor commands.`) : `Use one desq_create_deck call with exactly ${count} layout=${slideAuthoring} slides. Insert after the current slide.`} The requested count is authoritative; do not infer a different count from the topic.`,
  };
}

// Enforce the selected tab before executing any document mutation.
export function validateAgentTaskPlan(plan, mode, count) {
  if (!plan.calls.length) return;
  if (plan.calls.length !== 1 || plan.calls[0].name !== 'desq_create_deck')
    throw new Error('Return one complete slide-generation plan for this tab. No edits applied.');
  if (mode !== 'edit' && count === 'auto') {
    const length = plan.calls[0].arguments.slides?.length;
    if (!Number.isInteger(length) || length < 1 || length > 10)
      throw new Error('Auto requires 1 to 10 slides. No edits applied.');
    return;
  }
  const expected = mode === 'edit' ? 1 : count;
  if (plan.calls[0].arguments.slides?.length !== expected)
    throw new Error(`Expected exactly ${expected} slide${expected === 1 ? '' : 's'}. No edits applied.`);
}
