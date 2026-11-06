// Repair fraction divs before the browser's HTML parser implicitly closes
// paragraphs around them. Scan whole tags and raw-text elements so their
// attributes and literal examples are left intact.
const attributes = /(?:[^"'<>]|"[^"]*"|'[^']*')*/.source;
const stacked = '<div\\b(' + attributes + ')>(\\s*(?:<span\\b' + attributes + '>[^<]*</span\\s*>\\s*){2})</div\\s*>';
const tokens = new RegExp(
  '<!--[\\s\\S]*?(?:-->|$)|<(script|style|textarea|title|xmp)\\b' + attributes +
  '>[\\s\\S]*?(?:</\\1\\s*>|$)|' + stacked + '|<\\/?[a-z][\\w:-]*\\b' + attributes + '>',
  'gi',
);

export function normalizeHtmlFractionContainers(source) {
  let paragraph = false;
  return source.replace(tokens, (token, rawTextTag, attrs, contents) => {
    if (/^<p[\s>]/i.test(token)) paragraph = true;
    else if (attrs == null && /^<\/?(?:p|address|article|aside|blockquote|div|dl|fieldset|footer|form|h[1-6]|header|hr|main|nav|ol|pre|section|table|ul)[\s>]/i.test(token)) paragraph = false;
    if (!paragraph || attrs == null) return token;
    const className = /(?:^|\s)class\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
    if (!/(?:^|[\s_-])(?:fraction|frac)(?:$|[\s_-])/i.test(className?.slice(1).find(value => value != null) || '')) {
      paragraph = false;
      return token;
    }
    return '<span' + attrs + '>' + contents + '</span>';
  });
}
