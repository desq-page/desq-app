export function templateRole(source) {
  if (['cover', 'closing', 'summary', 'points', 'photo', 'chart', 'text'].includes(source.layoutRole)) return source.layoutRole;
  if (source.index === 1) return 'cover';
  const description = [source.sourceClass, source.label].join(' ');
  if (/summary|recap|takeaways?|conclusions?/i.test(description)) return 'summary';
  if (/(?:^|[-_\s])(?:close|closing|colophon)(?:$|[-_\s])|thank\s*you|questions|q\s*&\s*a/i.test(description)) return 'closing';
  if (source.image) return source.visualKind === 'chart' ? 'chart' : 'photo';
  if (source.columns || /pillars|principles|bullets|compare|timeline|framework|steps/i.test(description)) return 'points';
  return 'text';
}

export function contentRole(content) {
  const title = content.title || (content.texts?.length === 1 ? content.texts[0].text : '') || '';
  if (/\b(summary|review|recap|takeaways?|conclusions?)\b/i.test(title)) return 'summary';
  if (/^(?:thank\s*you|thanks)(?:\s+for\b.*)?[.!?\s]*$/i.test(title.trim())) return 'closing';
  if (/^(?:thank\s*you|thanks|questions|q\s*&\s*a|the\s+end)[.!?\s]*$/i.test(title) &&
      !(content.texts || []).some(entry => entry.role !== 'title' && entry.text.trim() !== title.trim())) return 'closing';
  return content.listCards || (content.texts || []).filter(entry => entry.role !== 'title').length >= 2 ? 'points' : 'text';
}

export function needsClosingSlide(pages, content, closingLayout) {
  if (!closingLayout || !pages.length) return false;
  return !pages.at(-1).agentMetadata?.designIdeas?.automaticClosing &&
    contentRole(content.at(-1).item) !== 'closing';
}
