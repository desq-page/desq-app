import { sourceLayouts, sourcePointsLayouts, sourceSummaryLayouts, sourceClosingLayouts } from './source-layouts.mjs';
import { generatedLayouts, builtinRoleLayouts } from './generated-layouts.mjs';
import { editorColor } from '../agent/colors.mjs';
import { wrapDeckText } from '../agent/deck-text.mjs';

// Native adaptation of beautiful-html-templates / neo-grid-bold (MIT).
// https://github.com/zarazhangrui/beautiful-html-templates/tree/main/templates/neo-grid-bold
const ink = '#0A0A0A', paper = '#F5F4EF', accent = '#E6FF3D';

const tile = (x, y, w, h, size, fill = paper, color = ink) => ({ x, y, w, h, size, fill, color });
const header = tile(40, 42, 1200, 142, 40);
const columns = count => Array.from({ length: count }, (_, i) =>
  tile(40 + i * 1212 / count, 196, 1212 / count - 12, 480, 22, i === 0 ? accent : paper));
const rows = count => Array.from({ length: count }, (_, i) =>
  tile(418, 42 + i * 646 / count, 822, 646 / count - 12, 22));
const left = tile(40, 42, 366, 634, 36, ink, paper);
const feature = tile(40, 196, 1200, 480, 24);
const builtinHeading = tile(64, 86, 1152, 110, 33);
const transparentTile = (...args) => ({ ...tile(...args), transparent: true });

function twoColumnListSlots(count, hasTitle, titleSlot = header) {
  const items = count - Number(hasTitle);
  if (items < 1 || items > 6) return [];
  const top = hasTitle ? 196 : 42;
  return [...(hasTitle ? [titleSlot] : []), ...grid(items, 40, top, 1212, 688 - top, 20, 2)];
}

export const layouts = [
  ...sourceLayouts,
  ...sourcePointsLayouts,
  ...sourceSummaryLayouts,
  ...sourceClosingLayouts,
  ...builtinRoleLayouts,
  ...generatedLayouts,
  { id: 'builtin-cover', description: 'Opening headline and optional subtitle beside an accent panel and circular motif.',
    requiresTitle: true,
    slots: n => n === 1 || n === 2 ? [
      transparentTile(64, 152, 720, 220, 45),
      ...(n === 2 ? [transparentTile(64, 410, 690, 180, 21)] : []),
    ] : [],
    artwork: [
      { name: 'Cover panel', x: 850, y: 0, w: 430, h: 720, color: 'accent' },
      { name: 'Cover circle', x: 930, y: 100, w: 230, h: 230, color: 'background', ellipse: true },
    ] },
  { id: 'builtin-photo-story', description: 'A substantial photo on the right with a headline and explanation on the left.',
    requiresTitle: true, singleImage: true,
    slots: n => n === 1 || n === 2 ? [
      transparentTile(64, 112, 554, 166, 33),
      ...(n === 2 ? [transparentTile(64, 320, 554, 270, 20.25)] : []),
    ] : [],
    image: { x: 682, y: 70, w: 534, h: 586 },
    artwork: [{ name: 'Photo accent', x: 0, y: 0, w: 16, h: 720, color: 'accent' }] },
  { id: 'builtin-photo-left', description: 'Photo on the left and oversized headline with optional explanation on the right.',
    requiresTitle: true, singleImage: true,
    slots: n => n === 1 || n === 2 ? [
      transparentTile(580, 180, 636, 200, 36),
      ...(n === 2 ? [transparentTile(580, 430, 636, 210, 20.25)] : []),
    ] : [],
    image: { x: 40, y: 40, w: 500, h: 640 },
    artwork: [{ name: 'Photo accent', x: 580, y: 70, w: 96, h: 8, color: 'accent' }] },
  { id: 'builtin-comparison', description: 'Two equal panels with contrasting top rules for comparing options.',
    requiresTitle: true, acceptsList: true,
    slots: n => n === 3 ? [builtinHeading, tile(64, 234, 560, 406, 20), tile(656, 234, 560, 406, 20)] : [],
    artwork: [64, 656].map(x => ({ name: 'Comparison rule', x, y: 226, w: 560, h: 8, color: 'accent' })) },
  { id: 'builtin-photo-list', description: 'Two-line headline and detailed list stacked beside one supporting picture.',
    requiresTitle: true, singleImage: true, acceptsList: true,
    slots: n => n >= 2 && n <= 4 ? [
      transparentTile(64, 40, 1152, 170, 34),
      ...grid(n - 1, 64, 230, 690, 458, 18, 1),
    ] : [],
    image: { x: 780, y: 230, w: 436, h: 446 },
    artwork: [{ name: 'Photo list rule', x: 64, y: 210, w: 1152, h: 4, color: 'accent' }] },
  { id: 'cover', description: 'Opening cover, presentation title, introduction and optional short subtitle or tagline.',
    slots: n => n === 1 ? [tile(40, 42, 1200, 634, 58, accent)] :
      n === 2 ? [tile(40, 42, 1200, 410, 52, accent), tile(40, 464, 1200, 212, 27, ink, paper)] : [] },
  { id: 'section', description: 'Section divider, chapter heading or short transition to a new topic.',
    slots: n => n === 1 ? [tile(236, 42, 1004, 634, 54, ink, paper)] : [] },
  { id: 'features', description: 'Independent benefits, product features, alternatives, categories or a side by side comparison.',
    slots: n => n >= 3 && n <= 5 ? [header, ...columns(n - 1)] : [] },
  { id: 'numbered-pillars', description: 'Parallel priorities, pillars or key points in columns with oversized item numbers.',
    slots: (n, hasTitle) => n - Number(hasTitle) >= 2 && n - Number(hasTitle) <= 4
      ? [...(hasTitle ? [header] : []), ...columns(n - Number(hasTitle))] : [] },
  { id: 'blue-agenda', description: 'Agenda, executive summary, or ordered discussion topics in a two-column grid with accent numbers.',
    slots: twoColumnListSlots, listMarker: 'accent-number' },
  { id: 'blue-detail', description: 'Detailed analysis, supporting findings or recommendations in two columns with accent dot bullets.',
    slots: twoColumnListSlots, listMarker: 'dot' },
  { id: 'poster-services', description: 'Service lines, capabilities and offerings in two columns with accent rules and dot bullets.',
    slots: (n, hasTitle) => twoColumnListSlots(n, hasTitle, { ...header, size: 50, align: 'ctr' }),
    listMarker: 'dot', listRule: true },
  { id: 'broadside-list', description: 'Framework, key rules or supporting points beside a bold headline with slash bullets.',
    slots: (n, hasTitle) => [...(hasTitle ? [left] : []),
      ...(hasTitle ? rows(n - 1) : grid(n, 40, 42, 1212, 646, 22, 1))], listMarker: 'slash' },
  { id: 'vellum-list', description: 'A centered heading over a narrow list of numbered principles, rules or methods.',
    slots: (n, hasTitle) => [...(hasTitle ? [{ ...header, align: 'ctr' }] : []),
      ...grid(n - Number(hasTitle), 256, hasTitle ? 196 : 42, 780, hasTitle ? 492 : 646, 22, 1)],
    listMarker: 'plain-number' },
  { id: 'timeline', description: 'Chronological milestones, dates, phases, roadmap or project timeline on a horizontal track.',
    slots: (n, hasTitle) => n - Number(hasTitle) >= 2 && n - Number(hasTitle) <= 4
      ? [...(hasTitle ? [header] : []), ...columns(n - Number(hasTitle))] : [] },
  { id: 'steps', description: 'Ordered steps, workflow, launch plan, next actions, agenda, or a chronological sequence of milestones.',
    slots: n => n >= 2 && n <= 5 ? [left, ...rows(n - 1)] : [] },
  { id: 'editorial', description: 'Detailed explanation or analysis with a heading and supporting paragraphs or bullets.',
    slots: n => n === 2 ? [header, feature] : [] },
  { id: 'quote', description: 'A short quotation, customer testimonial, customer voice or an attributed opinion.',
    slots: n => n === 2 ? [tile(40, 42, 366, 634, 34, accent), tile(418, 42, 822, 634, 34)] : [] },
  { id: 'cards', description: 'Dense summary, several short points, multiple editable text panels or a dashboard of findings.',
    slots: n => n >= 3 ? [header, ...grid(n - 1, 40, 196, 1200, 480, 17)] : [] },
  { id: 'visual', description: 'An image or screenshot illustrating a subject, example, or a product demonstration.',
    slots: n => n === 1 ? [left] : n === 2 ? [tile(40, 42, 366, 280, 34, ink, paper), tile(40, 334, 366, 342, 19)] : [],
    image: { x: 418, y: 42, w: 822, h: 634 } },
  { id: 'picture-rail', description: 'A wide heading and a multi-image panel to the right of explanatory text or parallel lists.',
    slots: (n, hasTitle) => [
      ...(hasTitle ? [tile(52, 50, 1176, 110, 46)] : []),
      ...grid(n - Number(hasTitle), 52, hasTitle ? 170 : 50, 635, hasTitle ? 474 : 594, 20, 2),
    ],
    image: { x: 712, y: 170, w: 516, h: 474 }, imageColumns: 2 },
  { id: 'picture-strip', description: 'A row of images beneath a headline, with descriptions, lists or captions in columns below.',
    slots: (n, hasTitle) => [
      ...(hasTitle ? [tile(52, 50, 1176, 105, 46)] : []),
      ...grid(n - Number(hasTitle), 52, 408, 1176, 236, 19, 3),
    ],
    image: { x: 52, y: 160, w: 1176, h: 234 }, imageColumns: 4 },
  { id: 'gallery', description: 'One or more images, charts, visual examples or screenshots with supporting editable text.',
    acceptsCharts: true,
    slots: n => n === 0 ? [] : grid(n, 40, 42, 366, 634, 26, 1),
    image: { x: 418, y: 42, w: 822, h: 634 } },
];

function grid(count, x, y, width, height, size, maxColumns = 4, fixedColumns = false) {
  const cols = Math.min(count, maxColumns, fixedColumns ? count : Math.ceil(Math.sqrt(count)));
  const rows = Math.ceil(count / cols);
  return Array.from({ length: count }, (_, i) =>
    tile(x + (i % cols) * width / cols, y + Math.floor(i / cols) * height / rows,
      width / cols - 12, height / rows - 12, size));
}

const fallbackAccentName = 'Reformat Slides theme accent';
const listMarkerName = 'Template list marker';
const artworkPrefix = 'Design Ideas artwork: ';
const list = value => Array.isArray(value) ? value : value ? [value] : [];
function paragraphText(paragraph) {
  return list(paragraph.r).map(run => run.$_otag === 'br' ? '\n' :
    String(run.t?.text ?? run.t?.['#text'] ?? run.t ?? '')).join('');
}

function textSize(entry) {
  const sizes = entry.paragraphs.flatMap(paragraph => {
    const defaults = Number(paragraph.pPr?.defRPr?.$_sz || paragraph.endParaRPr?.$_sz);
    return list(paragraph.r).map(run => Number(run.rPr?.$_sz) || defaults);
  }).filter(size => size > 0);
  return sizes.sort((a, b) => a - b)[Math.floor(sizes.length / 2)] || 0;
}

// Store content roles with the shape so they survive OOXML export and import.
const textRoleUri = 'urn:desq:design-text-role:v1';

function storedTextRole(shape) {
  return list(shape.cNvPrExtLst?.['a:ext']).find(extension =>
    extension.$_uri === textRoleUri)?.['desq:role'];
}

function withTextRole(shape, heading, number) {
  const existing = shape.cNvPrExtLst;
  const extensions = list(existing?.['a:ext']).filter(extension => extension.$_uri !== textRoleUri);
  if (heading || number != null) {
    extensions.push({
      $_uri: textRoleUri,
      'desq:role': {
        '$_xmlns:desq': 'https://desq.page/xml/design-text-role/1',
        $_kind: heading ? 'title' : 'bullet',
        ...(number != null ? { $_number: number } : {}),
      },
    });
  } else if (!storedTextRole(shape) && shape.reformatListNumber == null) return shape;
  return {
    ...shape,
    cNvPrExtLst: extensions.length ? { ...existing, 'a:ext': extensions } : undefined,
    reformatListNumber: number,
  };
}

function chooseTitle(entries, slideSize) {
  const explicit = entries.find(entry => ['title', 'ctrTitle'].includes(entry.shape.ph?.$_type));
  if (explicit) return explicit;
  const stored = entries.find(entry => entry.savedRole === 'title');
  if (stored) return stored;
  const candidates = entries.filter(entry => {
    const type = entry.shape.ph?.$_type;
    return entry.marker == null && !['subTitle', 'body', 'content', 'ftr', 'hdr', 'dt', 'sldNum'].includes(type) &&
      entry.text.length <= 140 && entry.paragraphs.filter(p => paragraphText(p).trim()).length <= 2 &&
      !entry.paragraphs.some(p => listParagraph(p, entry.shape).isItem);
  });
  const named = candidates.find(({ shape }) => /^(?:slide[ _-]+)?(?:title|heading)(?:[ _-]+\d+)?$/iu.test(shape.name || ''));
  if (named) return named;
  // A short standalone heading next to a list can survive an earlier layout
  // change with both its placeholder and visual prominence removed.
  const headings = candidates.filter(entry => entry.paragraphs.length === 1 &&
    entry.text.trim().split(/\s+/u).length <= 12 && !/[.!?]\s*$/u.test(entry.text.trim()));
  if (headings.length === 1) {
    const [heading] = headings;
    const others = entries.filter(entry => entry !== heading);
    const splitList = others.length >= 2 && others.every(entry =>
      entry.marker != null && entry.shape.y > heading.shape.y);
    if (splitList || others.some(entry =>
      entry.paragraphs.filter(p => listParagraph(p, entry.shape).isItem).length >= 2)) return heading;
  }
  if (!slideSize) return null;

  // Require typography and placement to agree before promoting ordinary text.
  const nearTop = slideSize.height * .28;
  const ranked = candidates.flatMap(entry => {
    const { y, h } = entry.shape;
    if (!Number.isFinite(y) || y < 0 || y > nearTop || h > slideSize.height * .35) return [];
    const size = textSize(entry);
    if (!size) return [];
    const peers = entries.filter(item => item !== entry && item.shape.y > y + slideSize.height * .03);
    const peerSizes = peers.map(textSize).filter(Boolean).sort((a, b) => a - b);
    const typical = peerSizes[Math.floor(peerSizes.length / 2)];
    const scaledMin = 2400 * Math.min(slideSize.width / 1280, slideSize.height / 720);
    if (typical ? size < typical * 1.2 || size < scaledMin : size < scaledMin * 1.4) return [];
    return [{ entry, score: size * (1 - y / slideSize.height) }];
  }).sort((a, b) => b.score - a.score);
  return ranked[0]?.entry || null;
}

export function isSolidBackdrop(shape, { width, height }) {
  return shape.solidFill && !shape.blipFill && !shape.blipPr && !shape.link && !shape.children?.length &&
    shape.prstGeom?.$_prst === 'rect' && !shapeText(shape) &&
    Math.abs(shape.x) < 1 && Math.abs(shape.y) < 1 &&
    Math.abs(shape.w - width) < 1 && Math.abs(shape.h - height) < 1;
}

export function isSinglePixelPicture(shape) {
  const blip = shape.blipFill?.blip;
  return (shape.$_otag === 'pic' || ['picture', 'image'].includes(shape.type)) &&
    Number(blip?.$_w) === 1 && Number(blip?.$_h) === 1;
}

export function readSlide(page, isProtected, slideSize) {
  const shapes = (page.shapes || []).filter(shape =>
    !isThemeAccent(shape) && !shape.name?.startsWith(artworkPrefix) && shape.name !== listMarkerName && !isCobaltRule(shape) && !isSinglePixelPicture(shape));
  if (page.timing?.m?.length || page.timing?.i?.length) return { reason: 'animation' };
  if (shapes.some(isProtected)) return { reason: 'locked or linked content' };
  const texts = [], images = [], pageNumbers = [];
  for (const [index, shape] of shapes.entries()) {
    const backdrop = index === 0 && slideSize && isSolidBackdrop(shape, slideSize);
    if (backdrop && shapes.length > 1) continue;
    if (shape.ph?.$_type === 'sldNum' || /^slide number(?: placeholder)?(?: \d+)?$/i.test(shape.name || '')) {
      pageNumbers.push(shape);
      continue;
    }
    if (shape.children?.length || Number(shape.rot) || shape.linkedTextbox)
      return { reason: 'complex objects' };
    if (shape.graphic?.graphicData?.['c:chart'] && shape.w > 0 && shape.h > 0) {
      images.push(shape);
      continue;
    }
    if ((shape.$_otag === 'pic' || ['picture', 'image'].includes(shape.type)) &&
        shape.blipFill && shape.w > 0 && shape.h > 0) {
      images.push(shape);
      continue;
    }
    if (shape.graphic) return { reason: 'complex objects' };
    if (shape.blipFill || shape.blipPr || !shape.txBody || (shape.$_otag && shape.$_otag !== 'sp' && !shape.ph))
      return { reason: 'unsupported objects' };
    const paragraphs = list(shape.txBody.p);
    if (paragraphs.some(p => p.fld || p.mathML || list(p.r).some(r => r.mathML || ['fld', 'm'].includes(r.$_otag))))
      return { reason: 'fields or equations' };
    const text = paragraphs.map(paragraphText).join('\n');
    if (!text.trim() && shape.ph) continue;
    if (!text.trim()) return { reason: 'decorative objects' };
    const role = storedTextRole(shape);
    const number = Number(role?.$_number);
    let marker = shape.reformatListNumber;
    if (role?.$_kind === 'bullet') marker = Number.isSafeInteger(number) && number >= 0 ? number : true;
    texts.push({ shape, paragraphs, text, marker, savedRole: role?.$_kind });
  }
  if (!texts.length && !images.length) return { reason: 'empty slide' };
  const title = chooseTitle(texts, slideSize);
  const body = texts.filter(entry => entry !== title).sort((a, b) =>
    (a.shape.y ?? 0) - (b.shape.y ?? 0) || (a.shape.x ?? 0) - (b.shape.x ?? 0));
  return {
    texts: [...(title ? [{ ...title, role: 'title' }] : []), ...body.map(entry => ({ ...entry, role: 'body' }))],
    images, pageNumbers,
    title: title?.text || '',
    body: body.map(entry => entry.text).join('\n'),
  };
}

const literalBullet = /^\s*(?:[•◦▪‣–—*-]|(\d+)[.)])\s+(?=\S)/u;

function stripListMarker(paragraph, style, prefix) {
  const { buChar, buAutoNum, buBlip, $_marL, $_indent, ...pPr } = style;
  let remaining = prefix.length;
  const r = list(paragraph.r).flatMap(run => {
    if (!remaining) return [run];
    const value = paragraphText({ r: [run] });
    const trimmed = value.slice(remaining);
    remaining = Math.max(0, remaining - value.length);
    if (!trimmed) return [];
    if (run.t && typeof run.t === 'object') {
      const key = run.t.text != null ? 'text' : '#text';
      return [{ ...run, t: { ...run.t, [key]: trimmed } }];
    }
    return [{ ...run, t: trimmed }];
  });
  return { ...paragraph, r, pPr: { ...pPr, buNone: {}, $_marL: 0, $_indent: 0 } };
}

function listParagraph(paragraph, shape, inheritedListStyle) {
  const own = paragraph.pPr || {};
  const level = Number(own.$_lvl) || 0;
  const key = `lvl${level + 1}pPr`;
  const local = shape.txBody?.lstStyle;
  const atLevel = defaults => defaults?.[key] || defaults?.[`a:${key}`];
  const style = { ...atLevel(inheritedListStyle), ...atLevel(local), ...own };
  if (own.buChar || own.buAutoNum || own.buBlip) delete style.buNone;
  const text = paragraphText(paragraph);
  const literal = literalBullet.test(text);
  const native = !style.buNone && (style.buChar || style.buAutoNum || style.buBlip || level > 0);
  return { level, style, literal, isItem: Boolean(native || literal) };
}

function expandLiteralBulletLines(paragraph, genId) {
  const runs = list(paragraph.r);
  if (!runs.some(run => run.$_otag === 'br')) return [paragraph];
  const lines = [[]];
  for (const run of runs) {
    if (run.$_otag === 'br') lines.push([]);
    else lines.at(-1).push(run);
  }
  if (lines.filter(r => literalBullet.test(paragraphText({ r }))).length < 2) return [paragraph];
  return lines.map((r, i) => ({ ...paragraph, id: i ? genId() : paragraph.id, r }));
}

// Split only when every paragraph can be accounted for. Leading prose stays
// together, and nested bullets and blank lines travel with their parent item.
function splitList(entry, genId) {
  const { shape, paragraphs } = entry;
  if (entry.role === 'title' || entry.marker != null || shape.link || shape.onClick || shape.linkedTextbox ||
      ['title', 'ctrTitle'].includes(shape.ph?.$_type)) return [entry];

  const leading = [], items = [];
  let lastNumber, lastType;
  for (const paragraph of paragraphs.flatMap(p => expandLiteralBulletLines(p, genId))) {
    const { level, style, literal, isItem } = listParagraph(paragraph, shape, entry.inheritedListStyle);
    if (!paragraphText(paragraph).trim() || !isItem || level > 0) {
      (items.at(-1)?.paragraphs || leading).push(level > 0 && isItem ? { ...paragraph, pPr: style } : paragraph);
      continue;
    }

    const prefix = literal ? paragraphText(paragraph).match(literalBullet) : null;
    let number = prefix?.[1] ? Number(prefix[1]) : undefined;
    if (style.buAutoNum && !style.buNone) {
      const numbering = style.buAutoNum;
      const ownNumbering = paragraph.pPr?.buAutoNum;
      const explicitStart = Number(ownNumbering?.$_startAt ?? ownNumbering?.$_start);
      const defaultStart = Number(numbering.$_startAt ?? numbering.$_start) || 1;
      lastNumber = explicitStart || (lastNumber != null && numbering.$_type === lastType ? lastNumber + 1 : defaultStart);
      lastType = numbering.$_type;
      number ??= lastNumber;
    } else {
      lastNumber = undefined;
      lastType = undefined;
    }
    items.push({ paragraphs: [stripListMarker(paragraph, style, prefix?.[0] || '')], marker: number ?? true });
  }
  if (!items.length) return [entry];

  const groups = leading.some(paragraph => paragraphText(paragraph).trim())
    ? [{ paragraphs: leading }, ...items]
    : items.map((item, i) => i === 0 ? { ...item, paragraphs: [...leading, ...item.paragraphs] } : item);
  if (groups.length === 1 && (typeof items[0].marker === 'number' || groups[0].paragraphs.length > 1)) return [entry];
  return groups.map(({ paragraphs, marker }, index) => ({
    shape: index === 0 ? shape : { ...shape, id: genId(), xmlNodeIndex: undefined },
    paragraphs,
    text: paragraphs.map(paragraphText).join('\n'),
    role: entry.role,
    marker,
  }));
}

export function splitBulletContent(content, genId) {
  let itemIndex = 0;
  const texts = content.texts.flatMap(entry => splitList(entry, genId)).map(entry => {
    if (entry.marker == null) return entry;
    itemIndex++;
    return entry.marker === true ? { ...entry, marker: itemIndex } : entry;
  });
  return texts.some(entry => entry.marker != null)
    ? { ...content, texts, listCards: true } : null;
}

export function mergePhotoText(content) {
  if (content.images.length !== 1 || content.images[0].graphic) return null;
  const blocks = content.texts.filter(entry => entry.role !== 'title');
  if (blocks.length !== 2 || blocks.some(({ shape }) =>
    shape.link || shape.onClick || shape.onHover || shape.hoverStyle || shape.hoverHighlight || shape.htmlField)) return null;

  const paragraphs = blocks.flatMap(({ shape, paragraphs, inheritedListStyle, marker }) =>
    paragraphs.map((paragraph, index) => {
      const { style } = listParagraph(paragraph, shape, inheritedListStyle);
      if (index === 0 && marker != null) {
        const { buNone, buChar, buAutoNum, buBlip, ...pPr } = style;
        return { ...paragraph, pPr: {
          ...pPr, $_marL: 22 * 9525, $_indent: -18 * 9525,
          ...(marker === true ? { buChar: { $_char: '•' } } :
            { buAutoNum: { $_type: 'arabicPeriod', $_startAt: marker } }),
        } };
      }
      return { ...paragraph, pPr: style };
    }));
  const joined = { ...blocks[0], marker: undefined, paragraphs,
    text: blocks.map(entry => entry.text).join('\n') };
  return {
    ...content,
    texts: [...content.texts.filter(entry => entry.role === 'title'), joined],
    body: joined.text,
    listCards: false,
  };
}

function isTimeline({ title, body }) {
  if (/\b(?:timeline|roadmap|milestones?|schedule|phases?)\b/i.test(title)) return true;
  const dates = body.match(/\b(?:20\d{2}|Q[1-4]|Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|June?|July?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b/gi);
  return new Set(dates?.map(date => date.toLowerCase())).size >= 2;
}

function slideGeometry({ x, y, w, h, uniform }, width, height) {
  const sx = width / 1280, sy = height / 720, scale = Math.min(sx, sy);
  return { x: x * sx, y: y * sy, w: w * (uniform ? scale : sx), h: h * (uniform ? scale : sy) };
}

function luminance(color) {
  return [0.2126, 0.7152, 0.0722].reduce((value, weight, index) => {
    const channel = parseInt(color.slice(1 + index * 2, 3 + index * 2), 16) / 255;
    return value + weight * (channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
  }, 0);
}

function sourcePaint(value, fallback, background) {
  const match = /^(rgba?\(|color\(srgb )(.+)\)$/.exec(value || '');
  if (!match) return fallback;
  const [, format, channels] = match;
  const [r, g, b, alpha = 1] = channels.split(/[\s,/]+/).map(Number);
  const channelScale = format === 'color(srgb ' ? 255 : 1;
  const rgb = '#' + [r, g, b].map(channel =>
    Math.round(channel * channelScale).toString(16).padStart(2, '0')).join('');
  if (alpha === 0) return undefined;
  return alpha === 1 ? rgb : blend(background, rgb, alpha);
}

function themedSlot(slot, theme, profile) {
  if (profile === 'cobalt-grid') return { ...slot, transparent: true, color: theme.foreground, regularHeading: true };
  if (slot.transparent && !slot.backdrop) return {
    ...slot, color: sourcePaint(slot.sourceColor, theme.foreground, theme.background),
  };

  const fill = slot.backdrop || (slot.fill === accent ? theme.accent : slot.fill === ink ? theme.foreground : theme.surface);
  const sourceColor = sourcePaint(slot.sourceColor, undefined, fill);
  if (sourceColor) return { ...slot, fill, color: sourceColor };
  const preferred = slot.color === paper ? theme.surface : theme.foreground;
  const levels = [luminance(fill), luminance(preferred)].sort((a, b) => a - b);
  const color = (levels[1] + .05) / (levels[0] + .05) >= 4.5 ? preferred :
    luminance(fill) > .179 ? '#000000' : '#FFFFFF';
  return { ...slot, fill, color };
}

function formatText({ shape, paragraphs, inheritedListStyle }, slot, geometry, font, scale, heading, measureText) {
  const inset = slot.inset != null ? slot.inset * scale : Math.min(24 * scale, geometry.w * .08, geometry.h * (heading ? .07 : .12));
  const available = (geometry.w - 2 * inset) * (slot.inset === 0 ? .98 : .94);
  if (available <= 0) return null;
  const fontSize = Math.round(slot.size * scale * 100);
  const size = fontSize / 100;
  const firstLine = paragraphText(paragraphs[0] || {}).trim();
  const cardHeading = slot.cardHeadingFont && paragraphs.length > 1 && firstLine.length > 0 &&
    firstLine.length <= 65 && !/[.!?]$/u.test(firstLine);
  const headingSize = Math.round(18 * scale * 100);
  const paragraphStyles = paragraphs.map(paragraph => {
    const { style } = listParagraph(paragraph, shape, inheritedListStyle);
    return !style.buNone && (style.buAutoNum || style.buChar || style.buBlip) ? style : paragraph.pPr || {};
  });
  const textHeight = paragraphs.reduce((height, paragraph, index) => {
    const style = paragraphStyles[index];
    const width = available - Math.max(0, Number(style.$_marL || 0) / 9525);
    if (width <= 0) return Infinity;
    const measure = (value, pt, family) => measureText(value, pt, family, 'bold', 'italic');
    const cardTitle = cardHeading && index === 0;
    const paragraphSize = cardTitle ? headingSize / 100 : size;
    const lines = wrapDeckText(paragraphText(paragraph), width, paragraphSize,
      cardTitle ? slot.cardHeadingFont : font, measure).length;
    const spacing = cardTitle ? 10 * scale : slot.inset === 0 ? 0 : 5 * scale;
    return height + lines * paragraphSize * (cardTitle ? 1.55 : slot.lineHeight || 1.85) + spacing;
  }, 0);
  // Source geometry and line metrics are independently rounded during capture.
  if (!heading && textHeight > geometry.h - 2 * inset + scale) return null;

  const textStyle = (original = {}, cardTitle) => {
    const { gradFill, blipFill, noFill, highlight, ln, effectLst, $_spc, spc, desqFontWeight, ...rest } = original;
    const weight = cardTitle ? 700 : slot.fontWeight;
    return { ...rest, $_sz: cardTitle ? headingSize : fontSize, latin: { $_typeface: cardTitle ? slot.cardHeadingFont : font },
      solidFill: editorColor(slot.color),
      ...(slot.textShadow ? { effectLst: { outerShdw: {
        ...editorColor(sourcePaint(slot.textShadow.sourceColor, slot.color, slot.color)),
        $_blurRad: Math.round(slot.textShadow.blur * scale * 9525),
        $_dist: Math.round(Math.hypot(slot.textShadow.x, slot.textShadow.y) * scale * 9525),
        $_dir: Math.round(Math.atan2(slot.textShadow.y, slot.textShadow.x) * 10800000 / Math.PI),
        $_algn: 'tl',
      } } } : {}),
      ...(heading || cardTitle ? { $_b: slot.regularHeading && !cardTitle ? 0 : 1 } : {}),
      ...(weight ? { desqFontWeight: weight, $_b: weight >= 600 ? 1 : 0 } : {}) };
  };
  const p = paragraphs.map((paragraph, index) => {
    const cardTitle = cardHeading && index === 0;
    const { lnSpc, spcBef, spcAft, tabLst, ...style } = paragraphStyles[index];
    return { ...paragraph, pPr: { ...style, $_algn: slot.align || 'l', defRPr: textStyle(style.defRPr, cardTitle),
        ...(cardTitle ? { spcAft: { spcPts: { $_val: Math.round(750 * scale) } } } : {}),
        ...(slot.lineHeight ? { lnSpc: slot.sourceSpacing
          ? { spcPct: { $_val: Math.round((cardTitle ? 1.55 : slot.lineHeight) / 1.6 * 100000) } }
          : { spcPts: { $_val: Math.round(slot.lineHeight * size * 100) } } } : {}) },
      r: list(paragraph.r).map(run => ({ ...run, rPr: textStyle(run.rPr, cardTitle) })) };
  });
  const { ph, style, gradFill, pattFill, blipFill, effectLst, dScale, grpFill, useBgFill, ...original } = shape;
  const pad = Math.round(inset * 9525);
  return { ...original, ...geometry,
    dirty: true, type: 'text', $_otag: 'sp', autosize: false,
    d: `R0,0,${geometry.w},${geometry.h}`, prstGeom: { $_prst: 'rect', avLst: {} },
    noFill: !!slot.transparent, solidFill: slot.transparent ? undefined : editorColor(slot.fill), ln: { noFill: true },
    txBody: { bodyPr: { $_wrap: 'square', $_anchor: slot.alignTop ? 't' : 'ctr',
      $_lIns: pad, $_rIns: pad, $_tIns: pad, $_bIns: pad }, p } };
}

export function fitLayouts(content, { width, height, headingFont, bodyFont, measureText, theme: defaultTheme, genId, profile = defaultTheme.slug, fontsForLayout, themeForLayout, layoutIds, flexible = false, slideNumber, slideCount }) {
  const scale = Math.min(width / 1280, height / 720);
  return layouts.flatMap(layout => {
    if (layoutIds && !layoutIds.has(layout.id)) return [];
    if ((layout.source || layout.generated || layout.id.startsWith('builtin-')) && profile === 'cobalt-grid') return [];
    if (Boolean(layout.image) !== Boolean(content.images.length)) return [];
    if ((layout.id === 'visual' || layout.singleImage) && content.images.length !== 1) return [];
    if (layout.visualKind === 'chart' && !content.images.every(image => image.graphic)) return [];
    if (layout.visualKind === 'photo' && content.images.some(image => image.graphic)) return [];
    if (content.images.some(image => image.graphic) && layout.visualKind !== 'chart' && !layout.acceptsCharts) return [];
    const family = layout.theme || themeForLayout?.(layout.id) || defaultTheme;
    const background = sourcePaint(layout.sourceBackground, undefined, family.background);
    const theme = background ? { ...family, background } : family;
    const typography = fontsForLayout?.(layout.id) || (layout.theme
      ? { headingFont: theme.headingFont, bodyFont: theme.bodyFont, markerFont: theme.markerFont } : { headingFont, bodyFont });
    const noHeading = !content.title;
    if (layout.requiresTitle && noHeading) return [];
    const { listMarker } = layout;
    if (listMarker && (profile === 'cobalt-grid' || !content.listCards)) return [];
    const designedList = ['numbered-pillars', 'timeline'].includes(layout.id);
    if (designedList && profile !== 'standard') return [];
    if (designedList && content.listCards && content.texts.some(entry => entry.role !== 'title' && entry.marker == null)) return [];
    if (layout.id === 'numbered-pillars' && !content.listCards) return [];
    if (layout.id === 'timeline' && !isTimeline(content)) return [];
    const listRoles = content.images.length ? ['gallery', 'picture-rail', 'picture-strip'] :
      ['features', 'steps', 'cards', 'numbered-pillars', 'timeline'];
    if (content.listCards && !listMarker && !layout.acceptsList && !listRoles.includes(layout.id)) return [];
    if (noHeading && ['cover', 'section', 'quote'].includes(layout.id)) return [];
    const columns = layout.columns?.(content.texts.length, !noHeading, content);
    if (layout.columns && !columns) return [];
    const artwork = columns?.artwork || layout.artwork || [];
    let slots = columns?.slots || (layout.source ? layout.slots(content.texts.length, !noHeading)
      : noHeading && !layout.image && !listMarker
      ? (layout.id === 'editorial' && content.texts.length === 1 ? [tile(40, 42, 1200, 634, 28)]
        : layout.id === 'steps' ? grid(content.texts.length, 40, 42, 1212, 646, 22, 1)
          : ['features', 'cards'].includes(layout.id) && content.texts.length > 1
            ? grid(content.texts.length, 40, 42, 1212, 646, 22, layout.id === 'features' ? 3 : 4)
            : [])
      : layout.slots(content.texts.length, !noHeading));
    const cobaltIndex = profile === 'cobalt-grid' && content.listCards && !layout.image;
    if (cobaltIndex) {
      if (layout.id !== 'steps') return [];
      const count = content.texts.length - (noHeading ? 0 : 1);
      const columns = count > 2 ? 2 : 1;
      const lines = Math.ceil(count / columns), w = columns === 2 ? 558 : 1168;
      const start = noHeading ? 62 : 184;
      const rowHeight = (648 - start) / lines;
      slots = [
        ...(noHeading ? [] : [tile(52, 51, 1176, 126, 52)]),
        ...Array.from({ length: count }, (_, i) => tile(52 + (i % columns) * 610,
          start + Math.floor(i / columns) * rowHeight, w, rowHeight - 4, 22)),
      ];
    } else if (profile === 'cobalt-grid' && !noHeading && !layout.image &&
        !['cover', 'section'].includes(layout.id) && slots.length > 1) {
      // Cobalt Grid uses a page-wide serif masthead above the content.
      const count = content.texts.length - 1;
      slots = [tile(52, 51, 1176, 126, 52),
        ...grid(count, 52, 184, 1176, 464, 22, count === 1 ? 1 : 2)];
    }
    if (slots.length !== content.texts.length) return [];
    const markers = [];
    const panels = [];
    const sourceMarkers = columns?.markers || layout.markers?.(content.texts.length, !noHeading) || layout.markerSlots;
    const shapes = slots.map((slot, i) => {
      const entry = content.texts[i];
      const heading = i === 0 && !noHeading;
      const number = entry.marker ?? (layout.id === 'timeline' && !heading ? i + Number(noHeading) : undefined);
      let textSlot = slot;
      const sourceMarker = sourceMarkers?.[i];
      const usesMarker = sourceMarker || slot.markerAbove || designedList || listMarker || cobaltIndex;
      if (usesMarker && (number != null || sourceMarker?.defaultNumber != null)) {
        if (layout.source && sourceMarker) {
          markers.push({ ...sourceMarker, number: number ?? sourceMarker.defaultNumber });
        } else if (slot.markerAbove) {
          markers.push({ x: slot.x, y: slot.y, w: slot.w, h: 14, number, size: 8, align: 'l' });
          textSlot = { ...slot, y: slot.y + 20, h: slot.h - 20 };
        } else if (designedList) {
          const height = layout.id === 'timeline' ? 78 : 114;
          markers.push({ x: slot.x, y: slot.y, w: slot.w, h: height, number, size: height === 78 ? 26 : 58 });
          textSlot = { ...slot, y: slot.y + height, h: slot.h - height, alignTop: true };
        } else {
          const width = Math.min(48, slot.w * .2);
          markers.push({ x: slot.x, y: slot.y, w: width, h: slot.h, number,
            size: listMarker === 'accent-number' || listMarker === 'slash' ? 25 : 16 });
          textSlot = { ...slot, x: slot.x + width, w: slot.w - width };
        }
      }
      if (layout.source) {
        const x = slot.x + slot.w / 2, y = slot.y + slot.h / 2;
        const backdrop = artwork.reduce((fill, art) =>
          art.sourceFill && x >= art.x && x <= art.x + art.w && y >= art.y && y <= art.y + art.h
            ? sourcePaint(art.sourceFill, fill, fill) || fill
            : fill, theme.background);
        textSlot = { ...textSlot, size: heading ? Math.max(36, textSlot.size) : textSlot.size,
          sourceSpacing: true, backdrop,
          ...(slot.cardHeading ? { cardHeadingFont: typography.headingFont } : {}) };
      }
      if (flexible && theme.flexiblePanels?.length) {
        const fill = heading ? theme.background : theme.flexiblePanels[(i - Number(!noHeading)) % theme.flexiblePanels.length];
        if (!heading) panels.push({ ...slot, name: 'Flexible panel', fill,
          border: 4, offsetShadow: { x: 8, y: 8 } });
        textSlot = { ...textSlot, transparent: true, backdrop: fill };
      }
      const paint = themedSlot(textSlot, theme, profile);
      if (sourceMarker?.useTextColor && markers.length) markers.at(-1).color = paint.color;
      const headingFont = slot.fontRole === 'marker' ? typography.markerFont || typography.headingFont : typography.headingFont;
      const font = heading && slot.fontRole !== 'body' ? headingFont : typography.bodyFont;
      const shape = formatText(entry, paint, slideGeometry(textSlot, width, height), font, scale, heading, measureText);
      return shape && withTextRole(shape, heading, number);
    });
    if (shapes.some(shape => !shape)) return [];
    if (genId) {
      const activeArtwork = artwork.filter(art =>
        !art.optionalSlot || slots.some(slot => slot.artworkSlot === art.optionalSlot));
      shapes.unshift(...[...activeArtwork, ...panels].map(art => {
        const box = slideGeometry(art, width, height);
        if (art.text) {
          const color = sourcePaint(art.sourceColor, theme.foreground, theme.background);
          const text = art.pageCounter && slideNumber && slideCount
            ? `${String(slideNumber).padStart(2, '0')} / ${String(slideCount).padStart(2, '0')}` : art.text;
          const rPr = {
            $_sz: Math.round(art.size * scale * 100),
            latin: { $_typeface: art.fontFamily || typography.bodyFont },
            solidFill: editorColor(color), desqFontWeight: art.fontWeight || 400,
            $_b: art.fontWeight >= 600 ? 1 : 0,
            $_spc: Math.round((art.letterSpacing || 0) * scale * 75),
            ...(art.textShadow ? { effectLst: { outerShdw: {
              ...editorColor(sourcePaint(art.textShadow.sourceColor, color, theme.background)),
              $_blurRad: Math.round(art.textShadow.blur * scale * 9525),
              $_dist: Math.round(Math.hypot(art.textShadow.x, art.textShadow.y) * scale * 9525),
              $_dir: Math.round(Math.atan2(art.textShadow.y, art.textShadow.x) * 10800000 / Math.PI),
              $_algn: 'tl',
            } } } : {}),
          };
          return {
            ...rectangle(artworkPrefix + art.name, box, theme.background, genId),
            type: 'text', noFill: true, solidFill: undefined, autosize: false,
            txBody: { bodyPr: { $_lIns: 0, $_rIns: 0, $_tIns: 0, $_bIns: 0, $_anchor: 't' },
              p: [{ pPr: { $_algn: art.align || 'l', defRPr: rPr,
                ...(art.lineHeight ? { lnSpc: { spcPts: { $_val: Math.round(art.lineHeight * scale * 75) } } } : {}) },
              r: [{ t: text, rPr }] }] },
          };
        }
        const fill = sourcePaint(art.sourceFill, art.fill || theme[art.color] || theme.surface, theme.background);
        const border = sourcePaint(art.sourceBorder, theme.foreground, fill || theme.background);
        const shape = rectangle(artworkPrefix + art.name, box, fill || theme.surface, genId);
        if (art.d) {
          shape.type = 'freeform';
          shape.d = art.d;
          shape.prstGeom = undefined;
          shape.dScale = [box.w / art.pathWidth, box.h / art.pathHeight];
          shape.noFill = !fill;
          shape.solidFill = fill ? editorColor(fill) : undefined;
          if (art.opacity != null && shape.solidFill) shape.solidFill.uniClr.alpha = { $_val: Math.round(art.opacity * 100000) };
        }
        if (art.rot) shape.rot = art.rot;
        if (art.paths) {
          const d = art.paths.map(path => path.map(([x, y], index) =>
            `${index ? 'L' : 'M'}${(x * box.w / art.w).toFixed(3)},${(y * box.h / art.h).toFixed(3)}`).join('')).join('');
          return { ...shape, type: 'freeform', d, prstGeom: undefined, noFill: true, solidFill: undefined,
            ln: { solidFill: editorColor(theme.foreground), $_w: Math.round(Math.max(1.25, art.stroke) * scale * 9525), $_cap: 'rnd', round: {} } };
        }
        if (!fill) { shape.noFill = true; delete shape.solidFill; }
        if (art.border && border) shape.ln = { solidFill: editorColor(border), $_w: Math.round(art.border * scale * 9525) };
        if (art.offsetShadow) {
          const { x, y, color = theme.foreground, opacity, sourceColor } = art.offsetShadow;
          const shadow = editorColor(sourcePaint(sourceColor, color, theme.background) || color);
          if (opacity != null) shadow.uniClr.alpha = { $_val: Math.round(opacity * 100000) };
          shape.effectLst = { outerShdw: { ...shadow, $_blurRad: 0,
            $_dist: Math.round(Math.hypot(x, y) * scale * 9525),
            $_dir: Math.round(Math.atan2(y, x) * 10800000 / Math.PI), $_algn: 'tl' } };
        }
        if (art.radius) {
          const r = Math.min(art.radius * scale, box.w / 2, box.h / 2);
          const adjustment = Math.round(r / Math.min(box.w, box.h) * 100000);
          shape.prstGeom = { $_prst: 'roundRect',
            avLst: { gd: [{ $_name: 'adj', $_fmla: 'val ' + adjustment }] } };
          shape.d = `M${r},0L${box.w-r},0Q${box.w},0,${box.w},${r}L${box.w},${box.h-r}Q${box.w},${box.h},${box.w-r},${box.h}L${r},${box.h}Q0,${box.h},0,${box.h-r}L0,${r}Q0,0,${r},0Z`;
        }
        if (art.arrow) return { ...shape, prstGeom: { $_prst: 'rightArrow', avLst: {} },
          d: `M0,${box.h*.3}L${box.w*.6},${box.h*.3}L${box.w*.6},0L${box.w},${box.h/2}L${box.w*.6},${box.h}L${box.w*.6},${box.h*.7}L0,${box.h*.7}Z` };
        return art.ellipse ? { ...shape, type: 'ellipse', d: `FE0,0,${box.w},${box.h}`,
          prstGeom: { $_prst: 'ellipse', avLst: {} } } : shape;
      }));
    }
    if (genId && markers.length) {
      if (layout.id === 'timeline') {
        const first = markers[0], last = markers.at(-1);
        shapes.push(rectangle(listMarkerName, slideGeometry({
          x: first.x + first.w / 2, y: first.y + 12, w: last.x - first.x, h: 3,
        }, width, height), theme.accent, genId));
      }
      for (const marker of markers) {
        if (layout.listRule) {
          shapes.push(rectangle(listMarkerName, slideGeometry({
            x: marker.x, y: marker.y, w: 4, h: marker.h,
          }, width, height), theme.accent, genId));
        }
        if (listMarker === 'dot') {
          const box = slideGeometry({
            x: marker.x + marker.w / 2 - 4, y: marker.y + marker.h / 2 - 4, w: 8, h: 8,
          }, width, height);
          shapes.push({ ...rectangle(listMarkerName, box, theme.accent, genId),
            type: 'ellipse', d: `FE0,0,${box.w},${box.h}`,
            prstGeom: { $_prst: 'ellipse', avLst: {} } });
          continue;
        }
        const timeline = layout.id === 'timeline';
        if (timeline) {
          shapes.push(rectangle(listMarkerName, slideGeometry({
            x: marker.x + marker.w / 2 - 7, y: marker.y + 7, w: 14, h: 14,
          }, width, height), theme.accent, genId));
        }
        const box = slideGeometry(timeline ? { ...marker, y: marker.y + 20, h: marker.h - 20 } : marker, width, height);
        const shape = rectangle(listMarkerName, box, theme.background, genId);
        const rPr = { $_sz: Math.round(marker.size * scale * 100), latin: { $_typeface: marker.fontFamily || (marker.plain ? typography.markerFont || typography.headingFont : typography.headingFont) },
          solidFill: editorColor(sourcePaint(marker.sourceColor, marker.color || (listMarker ? theme.accent : theme.foreground), theme.background)),
          ...(marker.fontWeight ? { desqFontWeight: marker.fontWeight, $_b: marker.fontWeight >= 600 ? 1 : 0 }
            : marker.bold ? { $_b: 1 } : {}) };
        const label = marker.wordNumber ? (['One', 'Two', 'Three', 'Four', 'Five', 'Six'][marker.number - 1] || String(marker.number)) :
          marker.alphabetic ? String.fromCharCode(64 + Number(marker.number)) :
          marker.prefix ? marker.prefix + ' ' + String(marker.number).padStart(marker.digits || 1, '0') :
          listMarker === 'slash' ? '/' : listMarker === 'plain-number' || marker.plain ?
          String(marker.number) : marker.roman ? (['I', 'II', 'III', 'IV', 'V', 'VI'][marker.number - 1] || String(marker.number))
            : String(marker.number).padStart(marker.digits || 2, '0');
        shapes.push({ ...shape, type: 'text', noFill: true, solidFill: undefined, autosize: false,
          txBody: { bodyPr: { $_anchor: 'ctr', $_lIns: 0, $_rIns: 0, $_tIns: 0, $_bIns: 0 },
            p: [{ pPr: { $_algn: marker.align || (designedList && !timeline ? 'l' : 'ctr'), defRPr: rPr },
              r: [{ t: marker.uppercase ? label.toUpperCase() : label, rPr }] }] } });
      }
    }
    if (layout.image) {
      const { x, y, w, h } = content.texts.length ? layout.image : { x: 40, y: 42, w: 1200, h: 634 };
      const imageSlots = content.images.length === 1 ? [{ x, y, w, h }] :
        grid(content.images.length, x, y, w, h, 0, layout.imageColumns, layout.id === 'picture-strip');
      if (imageSlots.some(slot => slot.w <= 0 || slot.h <= 0)) return [];
      content.images.forEach((image, i) => {
        const box = slideGeometry(imageSlots[i], width, height);
        const ratio = Math.min(box.w / image.w, box.h / image.h);
        const w = image.w * ratio, h = image.h * ratio;
        shapes.push({ ...image, ph: undefined, dirty: true, x: box.x + (box.w - w) / 2,
          y: box.y + (box.h - h) / 2, w, h, ...(image.graphic ? {} : { d: `R0,0,${w},${h}`, dScale: undefined }) });
      });
    }
    if (cobaltIndex && genId) {
      const lines = slots.slice(noHeading ? 0 : 1).map(slot =>
        rectangle('Cobalt index rule', slideGeometry({ x: slot.x, y: slot.y, w: slot.w, h: 1 }, width, height),
          blend(theme.background, theme.foreground, .18), genId));
      if (!noHeading) lines.push(rectangle('Cobalt headline rule',
        slideGeometry({ x: 52, y: 173, w: 1176, h: 1.5 }, width, height), theme.foreground, genId));
      shapes.push(...lines);
    }
    for (const shape of content.pageNumbers || []) {
      const box = slideGeometry({ x: 1130, y: 660, w: 100, h: 31 }, width, height);
      const numberStyle = { $_sz: Math.round(1100 * scale), latin: { $_typeface: typography.bodyFont },
        solidFill: editorColor(theme.foreground) };
      const styleField = field => ({ ...field, rPr: { ...field.rPr, ...numberStyle } });
      const paragraphs = list(shape.txBody?.p).map(p => ({ ...p, pPr: { ...p.pPr, $_algn: 'r', defRPr: numberStyle },
        r: list(p.r).map(styleField),
        ...(p.fld ? { fld: Array.isArray(p.fld) ? p.fld.map(styleField) : styleField(p.fld) } : {}),
      }));
      shapes.push({ ...shape, ...box, dirty: true, ph: undefined, noFill: true, solidFill: undefined,
        ln: { noFill: true }, d: `R0,0,${box.w},${box.h}`,
        name: shape.name || 'Slide Number',
        txBody: { ...shape.txBody, p: paragraphs, bodyPr: { $_anchor: 'ctr', $_lIns: 0, $_rIns: 0, $_tIns: 0, $_bIns: 0 } } });
    }
    return [{ id: layout.id, shapes, theme, topology: artwork.some(art => /connector|arrow/i.test(art.name)) ? 'connected' : 'plain', styledList: !!listMarker || (Boolean(columns) && content.listCards) || layout.id === 'numbered-pillars' }];
  });
}

export function applyTextTheme(shape, { theme, headingFont, bodyFont, preserveFonts }) {
  const children = shape.children?.map(child => applyTextTheme(child, { theme, headingFont, bodyFont, preserveFonts }));
  const base = children ? { ...shape, children } : shape;
  if (!shape.txBody || shape.locked || shape.blipFill || shape.blipPr || !shapeText(shape)) return base;

  const heading = ['title', 'ctrTitle'].includes(shape.ph?.$_type) || /^(?:slide )?title$/i.test(shape.name || '');
  const paint = themedSlot(tile(0, 0, 0, 0, 0), theme, 'standard');
  const style = (props = {}) => {
    const { gradFill, blipFill, noFill, ...rest } = props;
    return { ...rest, ...(preserveFonts ? {} : { latin: { $_typeface: heading ? headingFont : bodyFont } }),
      solidFill: editorColor(paint.color) };
  };
  const paragraphs = list(shape.txBody.p).map(p => ({
    ...p, pPr: { ...p.pPr, defRPr: style(p.pPr?.defRPr) },
    r: list(p.r).map(run => ({ ...run, rPr: style(run.rPr) })),
  }));
  return { ...base, dirty: true, ...(shape.solidFill ? { solidFill: editorColor(paint.fill) } : {}),
    txBody: { ...shape.txBody, p: paragraphs } };
}

function blend(background, foreground, weight) {
  return '#' + [1, 3, 5].map(offset => {
    const base = parseInt(background.slice(offset, offset + 2), 16);
    const ink = parseInt(foreground.slice(offset, offset + 2), 16);
    return Math.round(base + (ink - base) * weight).toString(16).padStart(2, '0');
  }).join('');
}

// Copy visible picture objects into the slide tree before replacing its layout.
// Keep group transforms and media targets so the copies render and export independently.
export function copyInheritedPictures({ page, layout, master, recoverMaster = false, genId }) {
  if (String(page.showMaster) === '0') return [];
  const copied = new Set((page.shapes || []).map(shape => shape.reformatPictureSource));
  const clonePicture = shape => {
    if (isSinglePixelPicture(shape)) return null;
    const children = (shape.children || []).map(clonePicture).filter(Boolean);
    const picture = shape.blipFill?.blip || shape.blipPr?.blip;
    const hasMedia = picture?.$_target || picture?.dataUrl;
    if (!children.length && (!hasMedia || shape.ph || shapeText(shape))) return null;
    const { xmlNodeIndex, parentid, ...copy } = structuredClone(shape);
    return { ...copy, id: genId(), dirty: true, ...(shape.children ? { children } : {}) };
  };
  const visibleLayers = String(layout?.showMaster) === '0' && !recoverMaster ? [layout] : [master, layout];
  return visibleLayers.flatMap(layer => (layer?.shapes || []).flatMap((shape, index) => {
    const source = `${layer.id}/${shape.id ?? index}`;
    if (copied.has(source) || shape.hidden === true) return [];
    const picture = clonePicture(shape);
    return picture ? [{ ...picture, reformatPictureSource: source }] : [];
  }));
}

function rectangle(name, box, fill, genId) {
  return { ...box, id: genId(), name, type: 'rectangle', $_otag: 'sp', dirty: true,
    d: `R0,0,${box.w},${box.h}`, prstGeom: { $_prst: 'rect', avLst: {} },
    solidFill: editorColor(fill), ln: { noFill: true } };
}

export function sharedArtwork(width, height, genId, theme) {
  const rect = (name, x, y, w, h, fill) => rectangle(name, slideGeometry({ x, y, w, h }, width, height), fill, genId);
  if (theme.slug === 'cobalt-grid') {
    const grid = [];
    for (let x = 28; x < 1280; x += 28) grid.push(rect('Cobalt grid line', x, 0, .7, 720, '#DBD8DE'));
    for (let y = 28; y < 720; y += 28) grid.push(rect('Cobalt grid line', 0, y, 1280, .7, '#DBD8DE'));
    return [
      ...grid,
      rect('Cobalt top hairline', 47, 19, 1186, 1.5, theme.foreground),
      rect('Cobalt bottom hairline', 47, 705, 1186, 1.5, theme.foreground),
    ];
  }
  // Decorative artwork belongs to each composition; the shared layout owns
  // only the deck-wide background (and Cobalt's optional graph-paper theme).
  return [];
}

export function sharedDesignLayout(width, height, genId, theme) {
  return {
    bg: { bgPr: { solidFill: editorColor(theme.background) } },
    shapes: sharedArtwork(width, height, genId, theme),
  };
}

function isCobaltRule(shape) {
  return ['Cobalt index rule', 'Cobalt headline rule'].includes(shape.name) && !shape.txBody;
}

export function isThemeAccent(shape) {
  return shape.name === fallbackAccentName;
}

export function shapeText(shape) {
  return [...list(shape.txBody?.p).map(paragraphText), ...(shape.children || []).map(shapeText)]
    .filter(text => text.trim()).join('\n');
}
