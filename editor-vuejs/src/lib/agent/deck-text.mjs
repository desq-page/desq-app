// Shared conservative word wrapping for native text-fit checks and layout proofs.
export function wrapDeckText(text, width, size, fontFamily = 'Arial', measureText) {
  const measure = value => measureText ? measureText(value, size, fontFamily) : [...value].length * size * 4 / 3 * .62;
  const lines = [];
  for (const logical of text.split('\n')) {
    let line = '';
    for (const word of logical.split(/\s+/u).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (measure(candidate) <= width) { line = candidate; continue; }
      if (line) { lines.push(line); line = ''; }
      // Long URLs, identifiers and languages without spaces still wrap safely.
      for (const char of word) {
        if (line && measure(line + char) > width) { lines.push(line); line = ''; }
        line += char;
      }
    }
    lines.push(line);
  }
  return lines;
}

// Canvas uses CSS font syntax. Families containing digits (Source Sans 3)
// require quoting; otherwise assignment fails and the previous font is reused.
export function canvasTextMeasurer(context) {
  return (text, size, family, weight = 'normal', style = 'normal') => {
    const safeWeight = /^(?:normal|bold|[1-9]\d{0,2}|1000)$/.test(String(weight)) ? String(weight) : 'normal';
    const safeStyle = /^(?:normal|italic|oblique)$/.test(String(style)) ? String(style) : 'normal';
    context.font = `${safeStyle === 'normal' ? '' : safeStyle + ' '}${safeWeight} ${size * 4 / 3}px ${JSON.stringify(String(family || 'Arial'))}`;
    return context.measureText(text).width;
  };
}

// Allow for canvas/editor/PowerPoint metric rounding on long authored lines.
export function authoredTextWidthPadding(width, fontSize) {
  return Math.max(2, fontSize * .25, width * .03);
}
