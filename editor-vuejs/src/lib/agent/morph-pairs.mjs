export const MORPH_AUTHORING_GUIDE = `Morph continuity: a Morph flag alone is insufficient. Author two consecutive endpoint slides for the SAME objects, changing their position, size, rotation or appearance to tell one continuous action. Put motion.transition.effect="morph" on the destination slide, never the first slide of a generated deck. Use matching explicit ids beginning with !! on both slides, e.g. <rect id="!!product-card" .../> or <text id="!!product-label" ...>. Each key must identify exactly ONE native object per slide; do not put a !! id on an SVG group containing multiple objects. Use separate stable keys for the card, label and icon. Keep corresponding object types compatible. Reuse identical image subjects/assets for paired pictures. Unpaired new/removed content may fade; provide at least one shared pair and ensure every destination !! key exists on the preceding slide. For HTML put id="!!product-card" on the corresponding element on both slides; box, text and image parts receive separate stable names automatically. Do not rely on similar colors or independently drawn lookalikes. If editing a single slide without its preceding endpoint, use another transition rather than claiming a paired Morph. For repair return the complete corrected deck, including both endpoint slides.`;

export function validateMorphPairs(pages) {
  const keys = page => {
    const result = new Map();
    for (const shape of page.shapes) {
      if (!shape.name?.startsWith('!!')) continue;
      if (result.has(shape.name)) throw Error(`Morph key ${shape.name} identifies multiple objects. Give each native object a unique !! id.`);
      result.set(shape.name, shape);
    }
    return result;
  };
  for (const [index, page] of pages.entries()) {
    if (page.transition?.ef !== 'morph' && page.transition?.nativeKey !== 'morph') continue;
    if (!index) throw Error('Morph on slide 1 has no preceding endpoint. Author both consecutive endpoint slides.');
    const previous = keys(pages[index - 1]), current = keys(page);
    if (!current.size) throw Error(`Slide ${index + 1} requests Morph without explicit pairs. Reuse matching !! object ids on both endpoint slides.`);
    for (const [key, shape] of current) {
      const partner = previous.get(key);
      if (!partner) throw Error(`Slide ${index + 1} Morph object ${key} has no partner on slide ${index}. Return both endpoint slides with matching !! ids.`);
      const kind = value => value.txBody ? 'text' : value.blipFill ? 'image' : value.graphic ? 'graphic' : 'shape';
      if (kind(partner) !== kind(shape)) throw Error(`Slide ${index + 1} Morph pair ${key} has incompatible object types.`);
    }
  }
}
