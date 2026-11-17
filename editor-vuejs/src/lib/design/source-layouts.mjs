import catalog from './template-catalog.json' with { type: 'json' };
import geometry from './source-layout-geometry.json' with { type: 'json' };
import { createPointsLayout, builtinRoleLayouts } from './generated-layouts.mjs';
import { templateRole } from './design-roles.mjs';

export const sourceLayouts = geometry.flatMap(family => family.layouts.map(record => {
  let source = record;
  if (family.slug === 'editorial-forest' && record.index === 1) {
    source = { ...record, slots: record.slots.map((slot, index) => ({
      ...slot, optional: index !== 0,
    })), preferOptionalSlots: true, optionalSlotOrder: [0, 3, 4, 2, 1] };
  }
  if (family.slug === 'capsule' && record.index === 3) source = capsulePillars(record);
  if (family.slug === 'pin-and-paper' && record.index === 3) {
    source = { ...source, slots: source.slots.map((slot, index) => ({
      ...slot, alignTop: true,
      ...(index === 0 ? { fontRole: 'body' } : {}),
      ...(index === 1 ? { size: 15, lineHeight: 1.65, h: 64 } : {}),
      ...(index >= 2 ? { size: 18, lineHeight: 1.65, markerAbove: true } : {}),
    })) };
  }
  if (family.slug === 'stencil-tablet' && record.index === 1) {
    const [title, label, footer] = record.slots;
    source = { ...record, slots: [
      { ...title, fontRole: 'marker' },
      { ...label, optional: true },
      { ...footer, optional: true },
    ], preferOptionalSlots: true };
  }
  const retained = (record.layoutElements || []).filter(art => !art.text ||
    !(source.markerSlots || []).some(marker => marker && marker.defaultNumber != null &&
      art.x + art.w / 2 >= marker.x && art.x + art.w / 2 <= marker.x + marker.w &&
      art.y + art.h / 2 >= marker.y && art.y + art.h / 2 <= marker.y + marker.h));
  source = { ...source, artwork: [...source.artwork, ...retained] };
  const role = templateRole(source);
  return {
    id: `source/${family.slug}/${source.index}`,
    family: family.slug,
    theme: catalog.find(theme => theme.slug === family.slug),
    sourceIndex: source.index,
    fontFamilies: [...new Set([
      ...source.artwork.map(art => art.fontFamily),
      ...(source.markerSlots || []).map(marker => marker?.fontFamily),
    ].filter(Boolean))],
    templateRole: role,
    isClosing: role === 'closing',
    defaultTitle: source.defaultTitle || 'Thank you',
    preferredContent: source.preferredContent,
    sourceBackground: source.sourceBackground,
    label: source.label,
    source: true,
    isCover: role === 'cover',
    description: `${source.label}. ${source.sourceClass.replace(/[-_]/g, ' ')}. ` +
      `${source.slots.length - 1} text areas${source.image ? ' and one picture' : ''}.`,
    ...(source.columns && !['cover', 'closing'].includes(role)
      ? { columns: (count, hasTitle, content) => adaptiveColumns(source, count, hasTitle, content) } : {}),
    ...(family.slug === 'stencil-tablet' && source.index === 3 ? {
      description: 'Our Principles. Three to five numbered columns for parallel principles, priorities or bullet points.',
      columns: (count, hasTitle) => stencilPrinciples(source, count, hasTitle),
    } : {}),
    requiresTitle: source.requiresTitle || ['cover', 'closing'].includes(role),
    unavailableReason: source.unavailableReason,
    acceptsList: true,
    singleImage: !!source.image,
    ...(source.image ? { image: source.image, visualKind: source.visualKind || 'photo' } : {}),
    // Keep the source composition while allowing for editable text of different lengths.
    slots: (count, hasTitle = true) => selectedSlots(source,count,hasTitle).map(index => {
      const slot = source.slots[index];
      if (family.slug === 'block-frame' && source.index === 1 && index === 1) {
        return { ...slot, artworkSlot: 'cover-label' };
      }
      if (family.slug === 'pin-and-paper' && source.index === 3) {
        return { ...slot, alignTop: true,
          ...(index === 0 ? { fontRole: 'body' } : {}),
          ...(index === 1 ? { size: 15, lineHeight: 1.65, h: 64 } : {}),
          ...(index >= 2 ? { size: 18, lineHeight: 1.65, markerAbove: true } : {}),
        };
      }
      return family.slug === 'pin-and-paper' && index > 0 && slot.size < 18
        ? { ...slot, size: 18 }
        : slot;
    }),
    markers: (count, hasTitle = true) => selectedSlots(source,count,hasTitle).map(index=>source.markerSlots?.[index]),
    artwork: family.slug === 'pin-and-paper' && source.index === 3
      ? source.artwork.map(art => art.name === 'Source panel' ? { ...art, offsetShadow: { x: 3.7, y: 3.7 } } : art)
      : source.artwork,
  };
}));

export const sourcePointsLayouts = catalog.filter(theme => theme.slug !== 'builtin-ocean')
  .map(theme => createPointsLayout(theme.slug, theme));

export const sourceSummaryLayouts = catalog.filter(theme => theme.slug !== 'builtin-ocean' &&
  !sourceLayouts.some(layout => layout.family === theme.slug && layout.templateRole === 'summary' && !layout.unavailableReason))
  .map(theme => {
    const points = sourceLayouts.find(layout => layout.family === theme.slug &&
      layout.templateRole === 'points' && layout.columns && !layout.unavailableReason) ||
      sourcePointsLayouts.find(layout => layout.family === theme.slug);
    return { ...points, id: `source/${theme.slug}/summary`, sourceIndex: undefined,
      label: 'Summary', templateRole: 'summary', requiresTitle: true, generic: true };
  });

export const sourceClosingLayouts = catalog.filter(theme => theme.slug !== 'builtin-ocean' &&
  !sourceLayouts.some(layout => layout.family === theme.slug && layout.isClosing && !layout.image && !layout.unavailableReason))
  .map(theme => {
    const cover = sourceLayouts.find(layout => layout.family === theme.slug && layout.isCover);
    const base = cover && !cover.unavailableReason && !cover.image ? cover : {
      ...builtinRoleLayouts.find(layout => layout.isClosing), family: theme.slug, theme, generated: true,
    };
    return { ...base, id: `source/${theme.slug}/closing`, sourceIndex: undefined,
      label: 'Thank you', templateRole: 'closing', isCover: false, isClosing: true,
      image: undefined, singleImage: false, visualKind: undefined,
      defaultTitle: 'Thank you', generic: true, description: 'A dedicated closing in the family’s typography and palette.' };
  });

function adaptiveColumns(source, count, hasTitle, content) {
  const cells = source.columns.cells;
  const columnIndexes = new Set(cells.flatMap(cell => cell.slotIndexes));
  const prefix = hasTitle ? [0] : [];
  const secondary = source.slots.flatMap((_, index) => index > 0 && !columnIndexes.has(index) ? [index] : []);
  const explicitSecondary = content?.texts?.slice(1, secondary.length + 1).every(entry => entry.marker == null) &&
    content?.texts?.slice(secondary.length + 1).some(entry => entry.marker != null);
  if ((!content?.listCards || explicitSecondary) && count === source.slots.length) {
    prefix.push(...secondary);
  }
  const points = count - prefix.length;
  if (points < 2 || points > 6) return null;
  const first = cells[0], last = cells.at(-1);
  const gap = cells[1].x - first.x - first.w;
  const width = (last.x + last.w - first.x - gap * (points - 1)) / points;
  if (width < 90) return null;
  const inside = (item, cell) => item.x >= cell.x - 2 && item.y >= cell.y - 2 &&
    item.x + item.w <= cell.x + cell.w + 2 && item.y + item.h <= cell.y + cell.h + 2;
  const move = (item, cell, x) => {
    const ratio = width / cell.w;
    const fixedWidth = item.uniform || item.ellipse || Math.abs(item.w - item.h) < .1;
    return { ...item, x: x + (item.x - cell.x) * ratio, w: fixedWidth ? item.w : item.w * ratio };
  };
  const artwork = source.artwork.filter(art => !cells.some(cell => inside(art, cell)));
  const slots = prefix.map(index => source.slots[index]);
  const markers = prefix.map(() => null);
  for (let index = 0; index < points; index++) {
    const cell = cells[index % cells.length];
    const x = first.x + index * (width + gap);
    const fields = cell.slotIndexes.map(i => source.slots[i]);
    const left = Math.min(...fields.map(s => s.x)), top = Math.min(...fields.map(s => s.y));
    const right = Math.max(...fields.map(s => s.x + s.w));
    const bottom = Math.max(cell.y + cell.h, ...fields.map(s => s.y + s.h));
    slots.push(move({ ...fields.at(-1), x: left, y: top, w: right - left, h: bottom - top,
      alignTop: true }, cell, x));
    const marker = cell.slotIndexes.map(i => source.markerSlots?.[i]).find(Boolean);
    markers.push(marker ? { ...move(marker, cell, x), defaultNumber: index + 1 } : null);
    artwork.push(...source.artwork.filter(art => inside(art, cell)).map(art => move(art, cell, x)));
  }
  return { slots, markers, artwork };
}

function stencilPrinciples(source, count, hasTitle) {
  const columns = count - Number(hasTitle);
  if (columns < 3 || columns > 5) return null;

  const panels = source.artwork.filter(art => art.name === 'Source panel');
  const first = panels[0];
  const last = panels.at(-1);
  const gap = panels[1].x - first.x - first.w;
  const rowWidth = last.x + last.w - first.x;
  const width = (rowWidth - (columns - 1) * gap) / columns;
  const artwork = Array.from({ length: columns }, (_, index) => ({
    ...(panels[index] || { ...last, sourceFill: 'rgb(63, 115, 183)' }),
    x: first.x + index * (width + gap),
    w: width,
  }));
  const heading = { ...source.slots[1], w: rowWidth, h: 62 };
  const body = source.slots[2];
  return {
    artwork: [...artwork, ...source.artwork.filter(art => !panels.includes(art))],
    slots: [
      ...(hasTitle ? [heading] : []),
      ...artwork.map(panel => ({
        ...body, x: panel.x + 20, y: panel.y + 230, w: panel.w - 40,
        h: panel.h - 253, size: 16, alignTop: true, cardHeading: true,
      })),
    ],
    markers: [
      ...(hasTitle ? [null] : []),
      ...artwork.map((panel, index) => ({
        x: panel.x + 20, y: panel.y + 24, w: panel.w - 40, h: 170,
        size: columns === 5 ? 92 : 112, align: 'l', bold: true,
        plain: true, defaultNumber: index + 1, useTextColor: true,
      })),
    ],
  };
}

function capsulePillars(source) {
  const [pill, ...artwork] = source.artwork;
  const cards = artwork.filter(art => art.w > 300);
  const badges = artwork.filter(art => art.w === art.h);
  return {
    ...source,
    requiresTitle: true,
    ...(source.columns ? { columns: { cells: source.columns.cells.map(cell => ({
      ...cell, slotIndexes: cell.slotIndexes.map(index => index + 1),
    })) } } : {}),
    slots: [
      source.slots[0],
      { ...pill, size: 8.4, inset: 0, transparent: true, align: 'ctr', optional: true, artworkSlot: 'subtitle' },
      ...source.slots.slice(1).map((slot, index) => {
        const badge = badges[index], card = cards[index];
        const y = badge.y + badge.h + 20;
        return { ...slot, y, h: card.y + card.h - 40 - y, size: 14, lineHeight: 1.85,
          alignTop: true, cardHeading: true };
      }),
    ],
    markerSlots: [null, null, ...badges.map((badge, index) => ({
      ...badge, size: 18, bold: true, roman: true, defaultNumber: index + 1, uniform: true,
    }))],
    artwork: [
      { ...pill, optionalSlot: 'subtitle' },
      ...artwork.map(art => badges.includes(art)
        ? { ...art, ellipse: true, uniform: true }
        : { ...art, offsetShadow: { x: 8, y: 8, color: '#1A1A1A', opacity: .08 } }),
    ],
  };
}

export function withSourceLayouts(catalog) {
  return catalog.map(family => family.slug === 'builtin-ocean' ? {
    ...family, variants: [...family.variants, ...builtinRoleLayouts.map(layout => ({
      label: layout.label, role: layout.id,
    }))],
  } : {
    ...family,
    variants: [...sourceLayouts, ...sourcePointsLayouts, ...sourceSummaryLayouts, ...sourceClosingLayouts].filter(layout => layout.family === family.slug).map(layout => ({
      label: layout.sourceIndex ? `${layout.label} (slide ${layout.sourceIndex})` : layout.label, role: layout.id,
    })),
  });
}

function selectedSlots(source, count, hasTitle = true) {
  const indexes = source.slots.map((_,index)=>index).filter(index => hasTitle || index !== 0);
  if (count === indexes.length) return indexes;
  if (source.artwork.some(art => art.optionalSlot === 'cover-label')) {
    if (count === 1) return [0];
    if (count === 2) return [0, 2];
  }
  // The title and explicitly required fields carry meaning. Other source text
  // areas are capacity, so missing labels or captions do not reject a layout.
  const required = indexes.filter(index => index === 0 || source.slots[index].required);
  if (count < required.length || count > indexes.length || count < 1) return [];
  const preferred = source.optionalSlotOrder || [
    ...indexes.filter(index => !source.slots[index].optional),
    ...indexes.filter(index => source.slots[index].optional),
  ];
  const selected = new Set([...required, ...preferred.filter(index => !required.includes(index))
    .slice(0, count - required.length)]);
  return indexes.filter(index => selected.has(index));
}
