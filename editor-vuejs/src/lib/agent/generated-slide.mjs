import { imagePlaceholderCaption } from './image-search-caption.mjs';
import { imageKeywords, compactImageQuery } from './image-keywords.mjs';
import { editorColor } from './colors.mjs';

// Content is declarative data. No model-authored HTML, scripts or arbitrary URLs.
export function validateSlideContent(args) {
  if (!args.title.trim()) throw new Error('The generated slide needs a title.');
  if ((args.bullets || []).some(text => !text.trim()) || (args.images || []).some(image => !image.query.trim() || !image.alt.trim()))
    throw new Error('Slide bullets and image descriptions cannot be blank.');
}

function wrappedLines(text, width, size) {
  // Conservative fallback for server tests and unavailable canvas measurement.
  const capacity = Math.max(1, Math.floor(width / (size * 4 / 3 * 0.58)));
  return text.split('\n').reduce((lines, line) => lines + Math.max(1, Math.ceil([...line].length / capacity)), 0);
}

export function buildGeneratedSlide(args, { width, height, genId, assets = [] }) {
  validateSlideContent(args);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 300 || height < 200 || width > 10000 || height > 10000)
    throw new Error('The presentation has an unsupported slide size.');
  if (assets.length !== (args.images || []).length) throw new Error('Resolve every image before inserting the slide.');
  const scale = Math.min(width / 1280, height / 720), margin = 54 * scale;
  const dark = args.theme === 'dark', ink = dark ? '#F3F6FA' : '#142D43', muted = dark ? '#CDD9E5' : '#465B6C';
  const shapes = [];
  const box = (name, x, y, w, h, texts, size, color = ink, bold = false, bullet = false) => {
    const paragraphs = texts.map(text => ({ id: genId(),
      pPr: { $_algn: 'l', ...(bullet ? { buChar: { $_char: '•' }, $_marL: Math.round(size * 1.3 * 12700), $_indent: -Math.round(size * 0.8 * 12700) } : {}) },
      r: [{ t: text, rPr: { $_sz: Math.round(size * 100), ...(bold ? { $_b: 1 } : {}), latin: { $_typeface: 'Arial' }, solidFill: editorColor(color) } }],
    }));
    const shape = { id: genId(), name, type: 'text', autosize: true, $_otag: 'sp', x, y, w, h, d: `R0,0,${w},${h}`,
      noFill: true, ln: { noFill: true }, txBody: { bodyPr: { $_wrap: 'square', $_anchor: 't', $_lIns: 0, $_rIns: 0, $_tIns: 0, $_bIns: 0 }, p: paragraphs } };
    shapes.push(shape); return shape;
  };
  shapes.push({ id: genId(), name: 'Slide background', type: 'rectangle', $_otag: 'sp', x: 0, y: 0, w: width, h: height,
    d: `R0,0,${width},${height}`, solidFill: editorColor(dark ? '#142536' : '#FFFFFF'), ln: { noFill: true },
    prstGeom: { $_prst: 'rect', avLst: {} } });
  const usableW = width - 2 * margin;
  let titleSize = 34 * scale;
  while (wrappedLines(args.title, usableW, titleSize) > 2 && titleSize > 24 * scale) titleSize -= scale;
  if (wrappedLines(args.title, usableW, titleSize) > 2) throw new Error('The slide title is too long for this slide size. Shorten it.');
  const titleH = Math.max(60 * scale, wrappedLines(args.title, usableW, titleSize) * titleSize * 1.65);
  box('Slide title', margin, 36 * scale, usableW, titleH, [args.title], titleSize, ink, true);
  let top = 36 * scale + titleH + 14 * scale;
  if (args.subtitle?.trim()) {
    const size = 16 * scale, h = wrappedLines(args.subtitle, usableW, size) * size * 1.7;
    box('Slide subtitle', margin, top, usableW, h, [args.subtitle], size, muted); top += h + 20 * scale;
  }
  const footerH = assets.length ? 56 * scale : 0;
  const availableH = height - margin - footerH - top;
  const imageW = assets.length ? usableW * 0.41 : 0;
  const textW = usableW - (assets.length ? imageW + 38 * scale : 0);
  const content = [...(args.body?.trim() ? [args.body] : []), ...(args.bullets || [])];
  let size = 22 * scale;
  const textHeight = s => content.reduce((total, text) => total + wrappedLines(text, textW - 30 * scale, s) * s * 1.75 + 12 * scale, 0);
  while (textHeight(size) > availableH && size > 13 * scale) size -= scale;
  if (availableH < 60 * scale || textHeight(size) > availableH) throw new Error('The generated content does not fit one slide. Ask for fewer or shorter bullet points.');
  let y = top;
  if (args.body?.trim()) {
    const h = wrappedLines(args.body, textW - 30 * scale, size) * size * 1.75 + 12 * scale;
    box('Slide body', margin, y, textW, h, args.body.split('\n'), size); y += h;
  }
  if (args.bullets?.length) {
    const h = args.bullets.reduce((total, bullet) => total + wrappedLines(bullet, textW - 30 * scale, size) * size * 1.75 + 12 * scale, 0);
    const bullets = box('Slide bullets', margin, y, textW, h, args.bullets, size, ink, false, true);
    for (const paragraph of bullets.txBody.p) paragraph.pPr.spcAft = { spcPts: { $_val: Math.round(9 * scale * 100) } };
  }
  const imageX = width - margin - imageW;
  const slotH = (availableH - (assets.length - 1) * 18 * scale) / Math.max(1, assets.length);
  for (const [index, asset] of assets.entries()) {
    if (asset.placeholder) {
      const y = top + index * (slotH + 18 * scale);
      const frame = box('Image placeholder', imageX, y, imageW, slotH, [], 16 * scale);
      frame.noFill = false; frame.solidFill = editorColor(dark ? '#243D50' : '#EDF2F6');
      frame.imagePlaceholder = { description: args.images[index].query, alt: args.images[index].alt, searchQueries: asset.searchQueries || [] };
      const caption = imagePlaceholderCaption(args.images[index].query, asset);
      let size = 18 * scale;
      while (wrappedLines(caption, imageW - 32 * scale, size) * size * 1.7 > slotH - 32 * scale && size > 8 * scale) size -= scale;
      box('Image description', imageX + 16 * scale, y + 16 * scale, imageW - 32 * scale, slotH - 32 * scale, caption.split('\n'), size, muted);
      continue;
    }
    if (!asset.media?.name || !asset.media.w || !asset.media.h) throw new Error('An image could not be stored in the document.');
    const ratio = Math.min(imageW / asset.media.w, slotH / asset.media.h);
    const w = asset.media.w * ratio, h = asset.media.h * ratio;
    shapes.push({ id: genId(), name: args.images[index].alt, type: 'image', $_otag: 'pic',
      x: imageX + (imageW - w) / 2, y: top + index * (slotH + 18 * scale) + (slotH - h) / 2, w, h,
      d: `R0,0,${w},${h}`, blipFill: { blip: { $_target: asset.media.name, $_w: asset.media.w, $_h: asset.media.h } },
      imageSource: { title: asset.title, author: asset.author, license: asset.license, url: asset.sourceUrl, ...(asset.generation ? { generation: asset.generation } : {}) } });
  }
  if (assets.some(asset => !asset.placeholder)) {
    const credits = assets.filter(asset => !asset.placeholder).map(asset => `${asset.title} — ${asset.author} — ${asset.license} — ${asset.sourceUrl}`);
    const creditText = credits.join('\n'); let size = 9 * scale;
    while (wrappedLines(creditText, usableW, size) * size * 1.55 > footerH && size > 5 * scale) size -= 0.5 * scale;
    if (wrappedLines(creditText, usableW, size) * size * 1.55 > footerH) throw new Error('Image attribution does not fit. Use fewer images.');
    box('Image credits', margin, height - margin - footerH, usableW, footerH, credits, size, muted);
  }
  return shapes;
}

const plain = value => String(value || '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
const safeCommons = (url, origin) => { try { const parsed = new URL(url); return parsed.protocol === 'https:' && parsed.origin === origin && !parsed.username && !parsed.password; } catch { return false; } };

export async function resolveSlideImage(image, options = {}) {
  const sourceAsset = options.sourceAssets?.find(asset => [asset.id,asset.name,asset.path].includes(image.query));
  if (sourceAsset) {
    const extension=sourceAsset.name?.split('.').pop()?.toLowerCase();
    const mime={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif'}[extension];
    if (!mime || !sourceAsset.data) return {placeholder:true,description:image.query,alt:image.alt,searchQueries:[],warning:'The source asset is not a browser-supported raster image; original data is preserved.'};
    return {blob:new Blob([sourceAsset.data],{type:mime}),title:sourceAsset.name,author:'Supplied source',license:'User-provided source',sourceUrl:undefined,searchQueries:[]};
  }
  const searchQueries = [];
  try { return { ...await resolveImage(image, { ...options, searchQueries, requestedImage: image, relevance: { checks: 0, rejected: new Set() } }), searchQueries }; }
  catch (error) {
    options.signal?.throwIfAborted();
    if (!options.placeholderOnFailure) throw error;
    options.onProgress?.('Image unavailable. Adding a placeholder with its description…');
    return { placeholder: true, description: image.query, alt: image.alt, searchQueries,
      warning: `Image placeholder for “${image.query}”: ${String(error.message || 'Image unavailable.').replace(/No slide was inserted\.?/g, '').trim()}` };
  }
}

async function resolveImage(image, options) {
  try { return await searchSlideImage(image, options); }
  catch (error) {
    options.signal?.throwIfAborted();
    if (error.code === 'NO_WIKIMEDIA_IMAGE' && typeof options.imageKeywords === 'function') {
      options.onProgress?.('Wikimedia found no usable image. Asking the model for shorter native-language keywords…');
      try {
        const keywords = imageKeywords(await options.imageKeywords(image, { signal: options.signal, onProgress: options.onProgress, language: options.language }));
        options.signal?.throwIfAborted();
        if (compactImageQuery(keywords).toLocaleLowerCase() !== compactImageQuery(image.query).toLocaleLowerCase()) {
          options.onProgress?.(`Searching Wikimedia with keywords: ${keywords}…`);
          return await searchSlideImage({ ...image, query: keywords }, options);
        }
      } catch {
        options.signal?.throwIfAborted();
        // Rewriting is a bounded fallback. Preserve the original description for
        // generation/placeholders if the rewrite or second search fails.
      }
    }
    if (typeof options.generateImage !== 'function') throw error;
    options.onProgress?.('No usable Wikimedia image found. Generating an image…');
    const generated = await options.generateImage({ query: image.query, alt: image.alt }, { signal: options.signal });
    options.signal?.throwIfAborted();
    if (!(generated?.blob instanceof Blob) || !generated.blob.size || generated.blob.size > 8_000_000 ||
        !['image/png', 'image/jpeg', 'image/webp'].includes(generated.blob.type)) throw new Error('Image generation returned no usable raster image. No slide was inserted.');
    return generated;
  }
}

async function searchSlideImage(image, { signal, fetchImpl = fetch, used = new Set(), searchQueries = [], onProgress, random = Math.random, researchImages = [], imageMatches, requestedImage = image, relevance = { checks: 0, rejected: new Set() } } = {}) {
  const timeout = AbortSignal.timeout(30_000);
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const keywords = compactImageQuery(image.query);
  if (!keywords) throw new Error('Provide image-search subject keywords.');
  onProgress?.(`Searching Wikimedia with keywords: ${keywords}…`);
  const query = new URLSearchParams({ action: 'query', format: 'json', origin: '*', generator: 'search',
    gsrsearch: keywords, gsrnamespace: '6', gsrlimit: '20',
    prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: '960' });
  searchQueries.push(query.get('gsrsearch'));
  const researched = researchImages.filter(item => item.query === image.query).map(item => item.page);
  const response = researched.length ? { ok: true, json: async () => ({ query: { pages: researched } }) }
    : await fetchImpl(`https://commons.wikimedia.org/w/api.php?${query}`, { signal: requestSignal, credentials: 'omit' });
  if (!response.ok) throw new Error('Image search failed. No slide was inserted. Try again or request a text-only slide.');
  const data = await response.json();
  const candidates = Object.values(data.query?.pages || {}).sort((a, b) => (a.index || 0) - (b.index || 0));
  // Try results in a random order, retaining fallbacks for unusable files.
  for (let index = candidates.length - 1; index > 0; index--) {
    const picked = Math.floor(random() * (index + 1));
    [candidates[index], candidates[picked]] = [candidates[picked], candidates[index]];
  }
  onProgress?.(`Wikimedia returned ${candidates.length} file result(s); checking image format and attribution…`);
  let eligible = 0;
  for (const candidate of candidates) {
    const info = candidate.imageinfo?.[0], meta = info?.extmetadata;
    const url = info?.thumburl || info?.url;
    const license = plain(meta?.LicenseShortName?.value);
    const author = plain(meta?.Artist?.value);
    if (!info || used.has(info.url) || relevance.rejected.has(info.url) || !['image/jpeg', 'image/png', 'image/webp'].includes(info.mime) ||
      !(safeCommons(url, 'https://upload.wikimedia.org') || safeCommons(url, 'https://thumb.wikimedia.org')) || !safeCommons(info.descriptionurl, 'https://commons.wikimedia.org') ||
      !/^(CC0|Public domain|CC BY(?:-SA)? [0-9.]+)$/i.test(license) || !author || author.length > 180) continue;
    if (imageMatches && relevance.checks >= 4) break;
    let imageMatch;
    if (typeof imageMatches === 'function') {
      relevance.checks++;
      const metadata = Object.fromEntries(['ObjectName', 'ImageDescription', 'Categories'].map(key => [key, plain(meta?.[key]?.value).slice(0,1800)]).filter(([,value]) => value));
      const title = plain(candidate.title).slice(0,200);
      onProgress?.(`Checking image ${relevance.checks} of 4 metadata against “${requestedImage.query}”…`);
      try {
        imageMatch = await imageMatches({ ...requestedImage, title, metadata }, { signal, onProgress });
        if (typeof imageMatch?.matches !== 'boolean') imageMatch = undefined;
        else imageMatch = { ...imageMatch, source: 'metadata' };
      } catch { signal?.throwIfAborted(); } // Inconclusive metadata falls back to pixels.
      signal?.throwIfAborted();
      if (imageMatch?.matches === false) {
        relevance.rejected.add(info.url);
        onProgress?.(`Skipping image from metadata: ${String(imageMatch.reason || 'Subject mismatch').slice(0,400)}`);
        continue;
      }
    }
    eligible++;
    let download;
    const downloadTimeout = AbortSignal.timeout(30_000);
    const downloadSignal = signal ? AbortSignal.any([signal, downloadTimeout]) : downloadTimeout;
    try { download = await fetchImpl(url, { signal: downloadSignal, credentials: 'omit' }); }
    catch { signal?.throwIfAborted(); continue; }
    if (!download.ok || !/^image\/(jpeg|png|webp)(;|$)/i.test(download.headers.get('content-type') || '')) continue;
    const reader = download.body.getReader(), chunks = []; let bytes = 0;
    try {
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        bytes += value.byteLength;
        if (bytes > 8_000_000) throw new Error('The image is too large. No slide was inserted.');
        chunks.push(value);
      }
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
    const blob = new Blob(chunks, { type: download.headers.get('content-type').split(';')[0] });
    if (!blob.size) continue;
    if (typeof imageMatches === 'function' && !imageMatch) {
      onProgress?.(`Visually checking image ${relevance.checks} of 4 against “${requestedImage.query}”…`);
      try { imageMatch = await imageMatches({ ...requestedImage, blob, title: plain(candidate.title) }, { signal, onProgress }); }
      catch (error) { signal?.throwIfAborted(); throw new Error(`Image relevance could not be verified: ${error.message}`); }
      signal?.throwIfAborted();
      if (typeof imageMatch?.matches !== 'boolean') throw new Error('Image relevance could not be verified.');
      imageMatch = { ...imageMatch, source: 'visual' };
      if (!imageMatch.matches) {
        relevance.rejected.add(info.url);
        onProgress?.(`Skipping image: ${String(imageMatch.reason || 'The visible subject does not match.').slice(0,400)}`);
        continue;
      }
    }
    used.add(info.url);
    return { blob, ...(imageMatch ? { imageMatch } : {}), title: plain(candidate.title).replace(/^File:/, ''), author, license, sourceUrl: info.descriptionurl };
  }
  onProgress?.(`Wikimedia: ${candidates.length} file result(s), ${eligible} passed format/attribution checks, no usable image downloaded.`);
  const error = new Error(`No usable licensed image was found for “${image.query}”. Try a more specific image description or request a text-only slide. No slide was inserted.`);
  error.code = 'NO_WIKIMEDIA_IMAGE';
  throw error;
}
