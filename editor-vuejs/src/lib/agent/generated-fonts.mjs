// Collect native run, table and chart typefaces, including nested groups.
export function generatedFontFamilies(pages) {
  const families = new Set();
  const visit = value => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (['$_typeface', 'fontFamily', 'font_family'].includes(key) && typeof child === 'string') {
        const family = child.split(',')[0].trim().replace(/^['"]|['"]$/g, '');
        if (family && !family.startsWith('+')) families.add(family);
      } else if (child && typeof child === 'object') visit(child);
    }
  };
  visit(pages);
  return [...families];
}

export async function loadGeneratedGoogleFonts(families) {
  if (typeof document === 'undefined' || !families.length) return [];
  const module = await import('webfontloader');
  const WebFont = module.default || module;
  return new Promise(resolve => {
    const failed = new Set();
    let settled = false;
    const finish = () => { if (!settled) { settled = true; clearTimeout(timer); resolve([...failed]); } };
    const timer = setTimeout(() => { families.forEach(family => failed.add(family)); finish(); }, 20000);
    try {
      WebFont.load({ google: { families: families.map(family => `${family}:100,200,300,400,400i,500,600,700,700i,800,900`) },
        timeout: 15000, fontinactive: family => failed.add(family), active: finish,
        inactive: () => { families.forEach(family => failed.add(family)); finish(); } });
    } catch { families.forEach(family => failed.add(family)); finish(); }
  });
}

// The sandbox supplies only CSS family names; URLs and scripts are never used.
export function renderedHtmlFontFamilies(deck, document = globalThis.document) {
  if (!document?.createElement) return [];
  const families = new Set();
  for (const slide of deck.slides || []) {
    if (slide.layout !== 'html') continue;
    const template = document.createElement('template');
    template.innerHTML = slide.html;
    for (const el of template.content.querySelectorAll('[style]')) {
      const family = el.style.fontFamily?.split(',')[0].trim().replace(/^[\"']|[\"']$/g, '');
      if (family && /^[\w -]{1,80}$/.test(family)) families.add(family);
    }
  }
  return [...families];
}
