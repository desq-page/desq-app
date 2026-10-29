import {officeColorScheme} from './office-color-schemes.mjs';
import { PRESENTON_TEMPLATES, PPTX_TEMPLATE_CHOICES, PRESENTON_AUTO } from './presenton-templates.mjs';
import { DECK_PALETTES, contrastRatio, legibleInk } from './deck-design.mjs';

export const HTML_LAYOUTS = Object.freeze({
  editorial: { template: 'title_slide', guide: 'A strong headline and concise explanation; one meaningful visual or highlighted takeaway. Leave generous whitespace.' },
  comparison: { template: 'title_list_of_cards_with_image', guide: 'Two aligned columns comparing the same criteria. One shared title; equal column widths and consistent rows.' },
  process: { template: 'title_description_bullet_points_list_with_icon', guide: 'Three to five clearly numbered steps with short labels and connectors; reserve a separate title band.' },
  statistics: { template: 'title_image_description_list_with_highlighted_text_heading_description', guide: 'One dominant factual metric with supporting context, or up to three aligned metrics. Never invent numbers.' },
  grid: { template: 'title_description_bullet_points_grid_with_icon', guide: 'Two to four equal modules with short descriptive headings; use consistent padding and a shared title band.' },
  image: { template: 'title_description_image', guide: 'A descriptive image slot beside a concise explanation; keep the title and text separate from the image.' },
  closing: { template: 'title_slide', guide: 'A clear conclusion or next action, one short supporting paragraph, and restrained visual emphasis.' },
});
export const LOCAL_DESIGN_BRIEF_PROMPT = `Choose a coherent presentation design and slide titles. Return ONLY short plain-text lines in this format:
Theme: a few words describing the content-specific mood
Template: choose the supplied template family ID (omit for freeform)
Palette: ocean|forest|ember|plum|graphite
Colors: #RRGGBB #RRGGBB #RRGGBB (optional background, foreground, accent; honor requested colors)
Slide 1: meaningful title | editorial|comparison|process|statistics|grid|image|closing
Continue for exactly the requested slide count. Choose layouts to suit each slide's information; vary them when justified. A single slide should explain the topic rather than merely introduce a deck. Titles convey the actual point, not generic labels. Do not invent facts. No prose, JSON, HTML or Markdown fences. Keep titles under 65 characters and the entire response concise. This is the only planning step.`;

export function localDesignBrief(text, command, count, { template = 'freeform' } = {}) {
  const topic = command.match(/about this topic:\s*([^\n]+)/i)?.[1] || command.split('\n')[0].replace(/^create\s+(?:exactly\s+)?\d+\s+(?:editable\s+)?slides?\s+(?:about|on)\s+/i, '').slice(0, 90);
  const palette = /\b(?:climate|nature|solar|sustainab|forest|agricultur)/i.test(command) ? 'forest' : /\b(?:food|cooking|energy|warm)\b/i.test(command) ? 'ember' : 'ocean';
  const requested = String(text).match(/^Palette:\s*(ocean|forest|ember|plum|graphite)\s*$/im)?.[1]?.toLowerCase();
  const chosen = String(text).match(/^Template:\s*((?:presenton|builtin)-[a-z]+)\s*$/im)?.[1]?.toLowerCase();
  const family = template === PRESENTON_AUTO ? PPTX_TEMPLATE_CHOICES.find(t=>t.id===chosen) || PPTX_TEMPLATE_CHOICES[0] : PRESENTON_TEMPLATES.find(t=>t.id===template);
  const design = { ...DECK_PALETTES[requested || palette], ...(family?.palette || {}), fontFamily: 'Arial' };
  const custom = String(text).match(/^Colors:\s*(#[\da-f]{6})\s+(#[\da-f]{6})\s+(#[\da-f]{6})\s*$/im);
  if (custom) [design.background, design.foreground, design.accent] = custom.slice(1);
  if (contrastRatio(design.background, design.foreground) < 4.5) design.foreground = legibleInk(design.background);
  if (contrastRatio(design.background, design.accent) < 3) design.accent = design.foreground;
  const titles = new Map();
  for (const match of String(text).matchAll(/^Slide\s+(\d+):\s*([^\n|]+)\|\s*([a-z]+)\s*$/gim)) {
    const index = Number(match[1]);
    if (index >= 1 && index <= count && !titles.has(index) && HTML_LAYOUTS[match[3].toLowerCase()]) {
      titles.set(index, { title: match[2].trim().slice(0, 100), layout: match[3].toLowerCase() });
    }
  }
  const slides = Array.from({ length: count }, (_, i) => titles.get(i + 1) || {
    title: count === 1 ? topic : `${topic.slice(0, 65)} — ${['Overview', 'Key ideas', 'How it works', 'Applications', 'Next steps'][Math.min(i, 4)]}`,
    layout: i === count - 1 && count > 1 ? 'closing' : ['editorial', 'grid', 'process'][i % 3],
  });
  return { officeColorScheme:officeColorScheme(String(text).match(/^OfficeColors:\s*([^\n]+)\s*$/im)?.[1]?.toLowerCase()).id, template: family?.id || 'freeform', templateFallback: template === PRESENTON_AUTO && chosen !== family.id, theme: String(text).match(/^Theme:\s*(.+)$/im)?.[1]?.slice(0, 180) || 'Clear, content-led presentation', design, slides,
    fallback: titles.size !== count };
}
