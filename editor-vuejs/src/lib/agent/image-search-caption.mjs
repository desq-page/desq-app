export function imagePlaceholderCaption(description, asset, label = 'Image placeholder') {
  return [`${label}${label === 'Image' ? ': ' : '\n'}${description}`, ...(asset?.searchQueries || []).map((query, index) =>
    `${index ? 'Retry keywords' : 'Search keywords'}: ${query}`)].join('\n');
}
