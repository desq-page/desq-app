import { editorColor } from './colors.mjs';

export const DECK_PALETTES = Object.freeze({
  ocean: { background: '#F7FAFC', foreground: '#142D43', accent: '#087F8C', secondary: '#C46B32', muted: '#4C6374', surface: '#E6EFF3', dark: '#142D43' },
  forest: { background: '#FAFBF7', foreground: '#203C31', accent: '#287453', secondary: '#A56826', muted: '#52675A', surface: '#E7EFE5', dark: '#173B30' },
  ember: { background: '#FFFAF5', foreground: '#352923', accent: '#B74E2E', secondary: '#376F82', muted: '#715E53', surface: '#F4E8DD', dark: '#38281F' },
  plum: { background: '#FCF9FD', foreground: '#362C48', accent: '#74529B', secondary: '#277D78', muted: '#665D75', surface: '#EDE6F3', dark: '#30243F' },
  graphite: { background: '#FAFAFA', foreground: '#252A30', accent: '#4A607A', secondary: '#A45D36', muted: '#58616C', surface: '#E8ECF0', dark: '#242A32' },
});

const hex = color => editorColor(color).uniClr.$_val;
export function contrastRatio(a, b) {
  const luminance = color => {
    const value = hex(color), channels = [0, 2, 4].map(i => parseInt(value.slice(i, i + 2), 16) / 255)
      .map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
    return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
  };
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
export const legibleInk = background => contrastRatio(background, '#FFFFFF') >= contrastRatio(background, '#14202C') ? '#FFFFFF' : '#14202C';
export function tint(color, amount = .88) {
  const value = hex(color);
  return '#' + [0, 2, 4].map(i => Math.round(parseInt(value.slice(i, i + 2), 16) * (1 - amount) + 255 * amount).toString(16).padStart(2, '0')).join('');
}

export function deckDesign(design = {}) {
  const palette = DECK_PALETTES[design.palette || 'ocean'];
  if (!palette) throw new Error('Unknown deck palette.');
  const dark = design.style === 'dark';
  const result = { ...palette, fontFamily: 'Arial', ...(dark ? { background: palette.dark, foreground: '#FFFFFF', muted: '#D0DAE3', surface: '#314555' } : {}), ...design };
  for (const key of ['background', 'foreground', 'accent', 'secondary', 'muted', 'surface', 'dark']) editorColor(result[key]);
  return result;
}

export function slideDesign(shared, slide, index) {
  const tone = slide.tone || 'base';
  const background = tone === 'dark' ? shared.dark : tone === 'accent' ? shared.accent : shared.background;
  const foreground = tone === 'base' ? shared.foreground : legibleInk(background);
  const accent = slide.accent || (tone === 'accent' ? foreground : tone === 'dark' ? '#FFFFFF' : shared.accent);
  return { ...shared, background, foreground, accent,
    muted: tone === 'base' ? shared.muted : foreground,
    surface: tone === 'base' ? shared.surface : shared.dark,
    tone, variant: slide.variant || ['standard', 'split', 'band'][index % 3] };
}

// Inspect the compiled scene, not just layout names: custom slides can be diverse too.
export function reviewDeck(deck, compiled) {
  const findings = [], storyboard = [], compositionErrors = [];
  const signatures = [];
  for (const [index, page] of compiled.pages.entries()) {
    const slide = deck.slides[index], shapes = page.shapes;
    const text = shapes.filter(s => s.txBody && !['Page number', 'Sources', 'Image description'].includes(s.name));
    const signature = text.map(s => [Math.round(s.x / 40), Math.round(s.y / 40), Math.round(s.w / 40), Math.round(s.h / 40)].join(':')).join('|');
    signatures.push(signature);
    const fontSizes = text.flatMap(s => s.txBody.p.flatMap(p => p.r.map(r => r.rPr?.$_sz / 100)));
    if (fontSizes.some(size => size < 14 * compiled.scale)) findings.push(`Slide ${index + 1}: small body text; shorten or rearrange rather than shrinking.`);
    const colors = shapes.flatMap(s => s.txBody?.p.flatMap(p => p.r.flatMap(r => r.rPr?.solidFill?.uniClr?.$_val?[r.rPr?.solidFill.uniClr.$_val]:r.rPr?.gradFill?.gsLst?.gs?.map(gs=>gs.uniClr?.$_val).filter(Boolean)||[])) || []);
    const nativeBg = page.bg?.bgPr;
    const bg = nativeBg?.solidFill?.uniClr?.$_val || shapes[0]?.solidFill?.uniClr?.$_val || compiled.design.background;
    // Explicit text over colored panels is checked against those panels separately below.
    for (const shape of text) {
      const panel = [...shapes].reverse().find(s => s !== shape && s.solidFill && s.x <= shape.x && s.y <= shape.y && s.x + s.w >= shape.x + shape.w && s.y + s.h >= shape.y + shape.h);
      const background = panel?.solidFill.uniClr.$_val || bg;
      if (!(nativeBg?.gradFill || (!nativeBg && shapes[0]?.gradFill)) && (!nativeBg?.blipFill || panel) && shape.txBody.p.some(p => p.r.some(r => r.rPr?.solidFill?.uniClr?.$_val&&contrastRatio(r.rPr?.solidFill.uniClr.$_val, background) < 3)))
        findings.push(`Slide ${index + 1}: improve text contrast in ${shape.name}.`);
    }
    const carriers = shapes.filter(s => s.type === 'chart' || s.type === 'table' ||
      (s.prstGeom && s.txBody) || /^(Process arrow|Timeline rail|Spoke|Hub|Comparison field|Content column)$/.test(s.name));
    storyboard.push({ slide: index + 1, title: slide.title, purpose: slide.purpose, takeaway: slide.takeaway || '',
      layout: slide.layout, tone: page.agentMetadata.tone, visualConcept: slide.visualConcept || '',
      carriers: carriers.map(s => ({ name: s.name, preset: s.prstGeom?.$_prst || s.type })),
      objectCount: shapes.length, textGroups: text.length, colors: [...new Set(colors)],
      scene: text.map(s => ({ name: s.name, x: Math.round(s.x), y: Math.round(s.y), width: Math.round(s.w), height: Math.round(s.h),
        text: s.txBody.p.map(p => p.r.map(r => r.t).join('')).join('\n').slice(0, 240) })) });
  }
  for (let i = 2; i < signatures.length; i++) if (signatures[i] === signatures[i - 1] && signatures[i] === signatures[i - 2])
    findings.push(`Slides ${i - 1}–${i + 1}: three repeated compositions. Use a content-appropriate diagram, process, statement or comparison unless the user requested repetition.`);
  const families = new Set(deck.slides.map(s => ['cover', 'section', 'closing'].includes(s.layout) ? 'hero' : s.layout));
  if (deck.slides.length >= 5 && families.size < 3) findings.push('The deck needs more composition variety unless a uniform template was requested.');
  if (deck.slides.length >= 3 && new Set(signatures).size < Math.min(3, deck.slides.length))
    compositionErrors.push('The deck repeats the same basic text/image geometry. Background colors and different titles do not count as different compositions.');
  if (deck.slides.length >= 3 && !storyboard.some(page => page.carriers.length))
    compositionErrors.push('There are no informational native shapes, diagrams, multi-column modules, tables or charts. Add a content-appropriate three-column, process, comparison or custom labeled-shape composition; do not add decorative shapes just to pass.');
  // Freeform SVG authoring follows upstream's page-job review; no preset/card/shape quotas.
  if(deck.slides.every(s=>['svg','html','markdown'].includes(s.layout))) compositionErrors.length=0;
  return { findings: [...new Set(findings)], compositionErrors, storyboard };
}

export function compositionRequirements(command = '') {
  return {
    uniform: /\b(?:same|identical|uniform|consistent)\s+(?:slide\s+)?(?:layout|template|composition)s?\b/i.test(command),
    textOnly: /\b(?:text[- ]only|only text|no (?:shapes|diagrams)|bullet[- ]only)\b/i.test(command),
  };
}

export function deckCompositionErrors(review, requirements) {
  if (requirements.uniform) return [];
  return review.compositionErrors.filter(error => !requirements.textOnly || !error.startsWith('There are no informational'));
}
