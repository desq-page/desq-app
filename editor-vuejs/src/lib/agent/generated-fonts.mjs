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
      WebFont.load({ google: { families: families.map(family => `${family}:400,400i,500,600,700,700i`) },
        timeout: 15000, fontinactive: family => failed.add(family), active: finish,
        inactive: () => { families.forEach(family => failed.add(family)); finish(); } });
    } catch { families.forEach(family => failed.add(family)); finish(); }
  });
}
