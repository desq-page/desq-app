export const NAMED_COLORS = Object.freeze({ red: 'FF0000', blue: '0000FF', green: '008000', yellow: 'FFFF00',
  orange: 'FFA500', purple: '800080', pink: 'FFC0CB', black: '000000', white: 'FFFFFF', gray: '808080', grey: '808080' });
export function editorColor(value) {
  if (typeof value !== 'string') throw new Error('Color must be a named color or #RRGGBB.');
  const color = NAMED_COLORS[value.trim().toLowerCase()] || value.trim().replace(/^#/, '');
  if (!/^[\da-f]{6}$/i.test(color)) throw new Error(`Unsupported color: ${value}. Use a basic named color or #RRGGBB.`);
  return { uniClr: { $_otag: 'srgbClr', $_val: color.toUpperCase() } };
}
