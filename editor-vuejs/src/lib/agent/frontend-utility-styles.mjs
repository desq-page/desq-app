// Read literal presentation theme values without executing model-authored JavaScript.
export function readUtilityTheme(fragment) {
  const scripts = [...fragment.querySelectorAll('script:not([src])')].map(node => node.textContent).filter(text => /tailwind\s*\.\s*config\s*=/.test(text)).join('\n');
  const colors = { white: '#ffffff', black: '#000000' };
  for (const match of scripts.matchAll(/([\w-]+)\s*:\s*\{([^{}]*)\}/g)) {
    for (const entry of match[2].matchAll(/(?:['"]?([\w-]+)['"]?)\s*:\s*['"](#[\da-f]{3,8})['"]/gi)) colors[`${match[1]}-${entry[1]}`] = entry[2];
  }
  const fonts = {};
  for (const match of scripts.matchAll(/\b(sans|serif|mono)\s*:\s*\[\s*(['"])(.*?)\2/g)) {
    const family = match[3].replace(/^['"]|['"]$/g, '').trim();
    if (/^[\w -]{1,80}$/.test(family)) fonts[match[1]] = family;
  }
  return { colors, fonts };
}

// Apply a bounded subset of static utility classes; unsupported classes remain inert.
export function applyUtilityStyles(element, theme, viewportWidth = 1280) {
  const style = element.style;
  const classes = [...element.classList];
  const authored = new Set(Array.from(style));
  const set = (key, value) => { if (!authored.has(key)) style.setProperty(key, value); };
  const color = value => {
    const [name, alpha] = value.split('/');
    const raw = theme.colors[name];
    if (!raw || !/^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(raw)) return;
    if (alpha === undefined) return raw;
    if (!/^\d{1,3}$/.test(alpha) || Number(alpha) > 100) return;
    let hex = raw.slice(1); if (hex.length === 3) hex = [...hex].map(c => c+c).join('');
    const number = parseInt(hex, 16);
    return `rgba(${number >> 16},${number >> 8 & 255},${number & 255},${Number(alpha)/100})`;
  };
  const sizes = {xs:'12px',sm:'14px',base:'16px',lg:'18px',xl:'20px','2xl':'24px','3xl':'30px','4xl':'36px','5xl':'48px','6xl':'60px','7xl':'72px','8xl':'96px','9xl':'128px'};
  const weights = {thin:100,light:300,normal:400,medium:500,semibold:600,bold:700,extrabold:800,black:900};
  // Resolve responsive variants against the fixed slide viewport, in breakpoint order.
  const breakpoints = { sm:640, md:768, lg:1024, xl:1280, '2xl':1536 };
  const active = classes.flatMap(token => {
    const parts = token.split(':');
    if (parts.length === 1) return [{ cls: token, min: 0 }];
    if (parts.length !== 2 || !breakpoints[parts[0]] || viewportWidth < breakpoints[parts[0]]) return [];
    return [{ cls: parts[1], min: breakpoints[parts[0]] }];
  }).sort((a, b) => a.min - b.min);
  for (const {cls} of active) {
    if (cls.startsWith('!')) continue;
    let m;
    if ((m = cls.match(/^bg-([\w-]+(?:\/\d+)?)$/)) && color(m[1])) set('background-color', color(m[1]));
    else if ((m = cls.match(/^text-([\w-]+(?:\/\d+)?)$/)) && color(m[1])) set('color', color(m[1]));
    else if ((m = cls.match(/^from-([\w-]+(?:\/\d+)?)$/)) && color(m[1])) set('background-color', color(m[1]));
    else if ((m = cls.match(/^font-(sans|serif|mono)$/)) && theme.fonts[m[1]]) set('font-family', `"${theme.fonts[m[1]]}"`);
    else if ((m = cls.match(/^font-(\w+)$/)) && weights[m[1]]) set('font-weight', String(weights[m[1]]));
    else if ((m = cls.match(/^text-([\w-]+)$/)) && sizes[m[1]]) set('font-size', sizes[m[1]]);
    else if ((m = cls.match(/^text-(left|center|right)$/))) set('text-align', m[1]);
    else if (cls === 'flex' || cls === 'inline-flex' || cls === 'grid' || cls === 'block') set('display', cls);
    else if ((m = cls.match(/^grid-cols-(\d+)$/)) && Number(m[1]) > 0 && Number(m[1]) <= 12) set('grid-template-columns', `repeat(${m[1]}, minmax(0, 1fr))`);
    else if ((m = cls.match(/^col-span-(\d+)$/)) && Number(m[1]) > 0 && Number(m[1]) <= 12) set('grid-column', `span ${m[1]} / span ${m[1]}`);
    else if (cls === 'flex-col') set('flex-direction', 'column');
    else if (cls === 'flex-row') set('flex-direction', 'row');
    else if (cls === 'flex-1') set('flex', '1 1 0%');
    else if (cls === 'shrink-0') set('flex-shrink', '0');
    else if (cls === 'flex-wrap') set('flex-wrap', 'wrap');
    else if (cls === 'items-center') set('align-items', 'center');
    else if (cls === 'justify-center') set('justify-content', 'center');
    else if (cls === 'justify-between') set('justify-content', 'space-between');
    else if (cls === 'items-start') set('align-items', 'flex-start');
    else if (cls === 'items-end') set('align-items', 'flex-end');
    else if (cls === 'relative' || cls === 'absolute') set('position', cls);
    else if (cls === 'overflow-hidden') set('overflow', 'hidden');
    else if (cls === 'w-full') set('width', '100%');
    else if (cls === 'h-full') set('height', '100%');
    else if ((m = cls.match(/^(w|h)-(\d+(?:\.\d+)?)$/))) set(m[1] === 'w' ? 'width' : 'height', `${Number(m[2]) * 4}px`);
    else if ((m = cls.match(/^max-w-(sm|md|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl)$/))) set('max-width', ({sm:'384px',md:'448px',lg:'512px',xl:'576px','2xl':'672px','3xl':'768px','4xl':'896px','5xl':'1024px','6xl':'1152px','7xl':'1280px'})[m[1]]);
    else if (cls === 'mx-auto') { set('margin-left','auto'); set('margin-right','auto'); }
    else if (cls === 'leading-relaxed') set('line-height','1.625');
    else if (cls === 'leading-tight') set('line-height','1.25');
    else if (cls === 'uppercase') set('text-transform', 'uppercase');
    else if (cls === 'italic') set('font-style', 'italic');
    else if (cls === 'rounded-full') set('border-radius', '9999px');
    else if ((m = cls.match(/^rounded(?:-(sm|md|lg|xl|2xl|3xl))?$/))) set('border-radius', ({sm:'2px',md:'6px',lg:'8px',xl:'12px','2xl':'16px','3xl':'24px'})[m[1]] || '4px');
    else if ((m = cls.match(/^(p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap)-(\d+(?:\.\d+)?)$/))) {
      const value = `${Number(m[2]) * 4}px`;
      const props = {p:['padding'],px:['padding-left','padding-right'],py:['padding-top','padding-bottom'],pt:['padding-top'],pb:['padding-bottom'],pl:['padding-left'],pr:['padding-right'],m:['margin'],mx:['margin-left','margin-right'],my:['margin-top','margin-bottom'],mt:['margin-top'],mb:['margin-bottom'],ml:['margin-left'],mr:['margin-right'],gap:['gap']};
      for (const prop of props[m[1]]) set(prop,value);
    }
  }
  // Tailwind's space-y utilities apply margins to later children, not the container.
  let childSpacing;
  for (const {cls} of active) {
    const match = cls.match(/^space-y-(\d+(?:\.\d+)?)$/);
    if (match) childSpacing = `${Number(match[1]) * 4}px`;
  }
  if (childSpacing) [...element.children].slice(1).forEach(child => {
    if (!child.style.getPropertyValue('margin-top')) child.style.setProperty('margin-top', childSpacing);
  });
  // Text painted with a clipped gradient needs an editable solid fallback.
  if (classes.includes('text-transparent')) {
    const from = classes.find(cls => cls.startsWith('from-') && color(cls.slice(5)));
    if (from) set('color', color(from.slice(5)));
  }
}
