import { canvasTextMeasurer } from './deck-text.mjs';
import { generatedFontFamilies, loadGeneratedGoogleFonts } from './generated-fonts.mjs';
import { pageImageCount, promoteSlideBackground } from './slide-background.mjs';
import { getFileInfo, getSlideInfo, getSlidesSlideId, getSelectSelShps, getSlidesMasterView,
  getInfoUseGrid, getSelectedTextTarget, getShapeDeep, updateShape, updateFile, updateSlide } from 'shared-vuejs/editor';
import { selectSlide, pasteSlide } from 'shared-vuejs/api/slide';
import { addShapeRaw } from 'shared-vuejs/api/draw';
import { deleteShape } from 'shared-vuejs/api/shape';
import { saveDexie, saveThumb, loadSlideFromDexie } from 'shared-vuejs/api/dbutils';
import { processImage } from 'shared-vuejs/api/upload';
import { getPrstInfo } from 'shared-vuejs/api/shapeImportUtils';
import { hideEditor, flushPendingTextSave, captureTextCursor } from 'shared-vuejs/api/updateText';
import { displayFileTitle } from 'shared-vuejs/api/utils';
import { linkedSlides } from 'shared-vuejs/api/linked-slides';
import { deselectAll } from 'shared-vuejs/api/handle';
import { genId } from 'shared-vuejs/api/utility';
import { editorColor } from './colors.mjs';
import { buildGeneratedSlide, resolveSlideImage, validateSlideContent } from './generated-slide.mjs';
import { resolveAutoshape } from './autoshape-catalog.mjs';
import { compileDeck, deckImageRequests } from './deck-compiler.mjs';
import { reviewDeck } from './deck-design.mjs';
import { deckSchema } from './deck-schema.mjs';
import { validateArguments } from './editor-tools.mjs';
import {loadOutlineFonts,outlineNativeText} from './ppt-master-outlines.mjs';

function protectedShape(shape: any) {
  return !!(shape.locked || shape.mainDoc || shape.linkedTextbox ||
    linkedSlides.previous(shape.id, getSlidesSlideId()) || shape.docAnchor || shape.docAnchorParagraphId ||
    shape.children?.some(protectedShape));
}

function current(args: any, checkPage = true) {
  if (getFileInfo()?.id !== args.fileId) throw new Error('The open document changed. Read it again before editing.');
  if (getSlidesMasterView()) throw new Error('Switch from master/layout view to a document page first.');
  if (checkPage && getSlidesSlideId() !== args.pageId) throw new Error('The current page changed. Read it again before editing.');
  if (getInfoUseGrid()) throw new Error('Switch out of responsive grid editing before using agent edits.');
}

function topShape(shapeId: string) {
  const shape = getSlideInfo()?.shapes?.find(shape => shape.id === shapeId);
  if (!shape) throw new Error('Shape is not a top-level shape on the current page. Read the page again.');
  if (protectedShape(shape))
    throw new Error('Locked, anchored, or linked document frames must be edited using the editor UI.');
  return getShapeDeep(shapeId);
}

function textShape(shapeId: string) {
  if (!shapeId.startsWith('tbl:')) return topShape(shapeId);
  const match = /^tbl:([^:]+):(\d+):(\d+)$/.exec(shapeId);
  if (!match) throw new Error('Invalid table cell ID.');
  const table = topShape(match[1]);
  const cell = table.graphic?.graphicData?.tbl?.tr?.[Number(match[2])]?.tc?.[Number(match[3])];
  if (!cell?.txBody || cell.$_hMerge || cell.$_vMerge || protectedShape(cell)) throw new Error('Choose an editable table cell.');
  return { ...getShapeDeep(shapeId), id: shapeId };
}

function canInitializeText(shape: any) {
  return !shape.children?.length && !shape.graphic &&
    !['line', 'polygon', 'audio', 'html', 'video', 'table', 'svg', 'chart', 'iframe'].includes(shape.type) &&
    (shape.$_otag === 'sp' || shape.prstGeom || ['ellipse', 'oval', 'rectangle', 'rect', 'triangle'].includes(shape.type));
}

function plainText(shape: any) {
  // Imported XML can retain a singleton paragraph/run as an object instead of
  // an array. Reading agent context must accept both without rewriting the file.
  const list = (value: any) => Array.isArray(value) ? value : value && typeof value === 'object' ? [value] : [];
  return list(shape.txBody?.p).map(p => list(p?.r).map(run => {
    const text = run?.t;
    return typeof text === 'string' || typeof text === 'number' ? String(text)
      : typeof text?.['#text'] === 'string' ? text['#text'] : '';
  }).join('')).join('\n');
}

function paragraphs(text: string, template?: any) {
  const first = template?.p?.[0];
  const rPr = first?.r?.[0]?.rPr || { $_sz: 2400 };
  return text.split('\n').map(line => ({
    id: genId(),
    ...(first?.pPr ? { pPr: structuredClone(first.pPr) } : {}),
    r: [{ t: line, rPr: structuredClone(rPr) }],
  }));
}

async function prepare(args: any, signal?: AbortSignal, checkPage = true) {
  current(args, checkPage);
  await flushPendingTextSave();
  hideEditor();
  await flushPendingTextSave();
  signal?.throwIfAborted();
  current(args, checkPage);
}

async function prepareTarget(args, signal?: AbortSignal) {
  const selected = args.shapeId ? null : getSelectSelShps();
  if (selected && selected.length !== 1) throw new Error('Select exactly one shape, or provide a target shape ID.');
  const shapeId = args.shapeId || selected[0];
  await prepare(args, signal);
  if (selected && (getSelectSelShps().length !== 1 || getSelectSelShps()[0] !== shapeId))
    throw new Error('The selection changed. Try the command again.');
  return topShape(shapeId);
}

let textCursor: any;
let cursorSequence = 0;
function emptyStarterSlide(file: any, slide: any) {
  return file.slides?.length === 1 && file.slides[0].id === slide?.id &&
    Array.isArray(slide.shapes) && !slide.shapes.length &&
    !slide.bg?.bgPr?.blipFill && !slide.bg?.blipFill &&
    !Object.keys(slide.notes || {}).length;
}

async function removeEmptyStarter(fileId: string, starterId: string | undefined, insertedIds: string[], warnings: string[], onProgress?: (message: string) => void) {
  if (!starterId || !insertedIds.length || getFileInfo()?.id !== fileId) return;
  try {
    // Re-read the persisted original so content added during generation survives.
    const original = await loadSlideFromDexie(fileId, starterId, 'slides');
    const file = getFileInfo();
    if (file?.id !== fileId || getSlidesSlideId() === starterId ||
      !file.slides.some(slide => slide.id === starterId) ||
      !insertedIds.every(id => file.slides.some(slide => slide.id === id)) ||
      !emptyStarterSlide({ slides: [{ id: starterId }] }, original)) return;
    onProgress?.('Removing the empty starter slide…');
    // Like native page deletion, retain its stored asset for normal file Undo.
    updateFile({ slides: file.slides.filter(slide => slide.id !== starterId) });
    await saveDexie({ skipGenerateThumb: true });
  } catch {
    warnings.push('The generated slides were saved, but the empty starter slide could not be removed.');
  }
}

// Run after page persistence, using explicit IDs so preview work never changes
// selection and cannot render a newly selected document by accident.
async function prepareGeneratedFonts(fileId: string, pages: any[], onProgress?: (message: string) => void) {
  const { googleFonts } = await import('shared-vuejs/api/googleFonts');
  const catalog = new Map(googleFonts.map(font => [font[0].toLowerCase(), font[0]]));
  const file = getFileInfo();
  if (file?.id !== fileId) throw new Error('The open document changed while loading fonts.');
  const registered = file.fonts || [];
  const families = [...new Set(generatedFontFamilies(pages).map(family => catalog.get(family.toLowerCase())).filter(Boolean))] as string[];
  // Preserve embedded/local fonts with the same family name.
  const google = families.filter(family => !registered.some(font => font.type === 'local' && font.family?.toLowerCase() === family.toLowerCase()));
  if (!google.length) return [];
  onProgress?.(`Loading Google Fonts: ${google.join(', ')}…`);
  const failed = await loadGeneratedGoogleFonts(google);
  if (getFileInfo()?.id !== fileId) throw new Error('The open document changed while loading fonts.');
  const fonts = [...(getFileInfo().fonts || [])];
  for (const family of google) if (!fonts.some(font => font.family?.toLowerCase() === family.toLowerCase())) fonts.push({ family, type: 'google' });
  updateFile({ fonts });
  return failed.map(family => `Google Font “${family}” could not be loaded; fallback text may be shown.`);
}

async function rebuildAgentThumbnails(fileId: string, pageIds: string[], warnings: string[], onProgress?: (message: string) => void) {
  let pending = [...pageIds];
  for (let attempt = 0; attempt < 2 && pending.length; attempt++) {
    const failed: string[] = [];
    for (const id of pending) {
      if (getFileInfo()?.id !== fileId) {
        warnings.push('Thumbnail rebuilding stopped because the open document changed.');
        return;
      }
      const index = pageIds.indexOf(id);
      onProgress?.(`${attempt ? 'Retrying' : 'Refreshing'} preview ${index + 1} of ${pageIds.length}…`);
      try { await saveThumb(id, { timeoutMs: 60_000 }); }
      catch { failed.push(id); }
    }
    pending = failed;
  }
  for (const id of pending) warnings.push(`Thumbnail not refreshed for slide ${pageIds.indexOf(id) + 1} after two attempts.`);
}

export const editorAdapter = {
  rememberTextCursor() {
    const bookmark = captureTextCursor();
    if (bookmark?.unavailable) { textCursor = undefined; return; }
    if (bookmark) textCursor = { ...bookmark, cursorId: String(++cursorSequence), fileId: getFileInfo()?.id, pageId: getSlidesSlideId() };
  },
  clearTextCursor() { textCursor = undefined; },

  getDocument({ offset = 0, limit = 50 }) {
    const file = getFileInfo();
    return { fileId: file.id, name: file.name || file.title, sourceFormat: file.sourceFormat,
      width: file.width, height: file.height, pageCount: file.slides?.length || 0,
      textCursor: textCursor && (!textCursor.isValid || textCursor.isValid()) && textCursor.fileId === file.id && textCursor.pageId === getSlidesSlideId() && (getSelectedTextTarget()?.shapeId === textCursor.shapeId || getSelectSelShps().includes(textCursor.shapeId)) ? { shapeId: textCursor.shapeId, cursorId: textCursor.cursorId, paragraph: textCursor.paragraph, offset: textCursor.offset, hasSelection: !!textCursor.hasSelection } : null,
      selectedTextTarget: getSelectedTextTarget(),
      pageId: getSlidesSlideId(), selectedShapeIds: getSelectSelShps(),
      pages: (file.slides || []).slice(offset, offset + limit).map((page, i) => ({ id: page.id, index: offset + i + 1, name: page.name || page.title })),
    };
  },
  getPage({ offset = 0, limit = 50 }) {
    const slide = getSlideInfo();
    const shapes = slide?.shapes || [];
    return { fileId: getFileInfo().id, pageId: getSlidesSlideId(), shapeCount: shapes.length,
      shapes: shapes.slice(offset, offset + limit).map(shape => ({
        id: shape.id, name: shape.name, type: shape.type,
        x: shape.x, y: shape.y, width: shape.w, height: shape.h,
        text: plainText(shape).slice(0, 2000), textTruncated: plainText(shape).length > 2000,
        editable: !protectedShape(shape),
      })),
    };
  },
  async selectPage(args, signal?: AbortSignal) {
    await prepare(args, signal, false);
    if (!getFileInfo().slides?.some(page => page.id === args.pageId)) throw new Error('Unknown page ID.');
    await selectSlide(args.pageId);
    if (getSlidesSlideId() !== args.pageId || getSlideInfo()?.id !== args.pageId) throw new Error('Page did not finish loading. Try again.');
    return this.getPage({});
  },
  async renameDocument(args, signal?: AbortSignal) {
    await prepare(args, signal, false);
    if (!args.name.trim()) throw new Error('Document name cannot be blank.');
    updateFile({ name: args.name });
    await saveDexie();
    displayFileTitle(args.name);
    return { fileId: args.fileId, name: args.name };
  },
  async setShapeText(args, signal?: AbortSignal) {
    await prepare(args, signal);
    const shape = topShape(args.shapeId);
    if (['line', 'polygon'].includes(shape.type) || (!shape.txBody && !canInitializeText(shape)) || shape.children?.length || shape.graphic) throw new Error('The selected object has no editable text body. Choose a text shape or a single table cell.');
    const txBody = { ...shape.txBody, p: paragraphs(args.text, shape.txBody) };
    updateShape({ id: args.shapeId, txBody });
    await saveDexie();
    return { shapeId: args.shapeId, text: args.text };
  },
  async insertTextAtCursor(args, signal?: AbortSignal) {
    current(args);
    signal?.throwIfAborted();
    const cursor = textCursor;
    if (!cursor || cursor.cursorId !== args.cursorId || cursor.fileId !== args.fileId || cursor.pageId !== args.pageId || !(getSelectedTextTarget()?.shapeId === cursor.shapeId || getSelectSelShps().includes(cursor.shapeId)))
      throw new Error('The text cursor changed. Place the cursor in the textbox and try again.');
    const shape = textShape(cursor.shapeId);
    if (!shape.txBody || shape.children?.length || shape.graphic) throw new Error('The selected object has no editable text body. Choose a text shape or a single table cell.');
    if (!args.text.trim()) throw new Error('Inserted text cannot be blank.');
    // Do not hide/rebuild the text editor before applying its saved caret.
    cursor.insert(args.text);
    textCursor = undefined;
    await flushPendingTextSave();
    await saveDexie();
    return { shapeId: cursor.shapeId, insertedText: args.text, paragraph: cursor.paragraph, offset: cursor.offset };
  },
  async insertText(args, signal?: AbortSignal) {
    if (!args.text.trim()) throw new Error('Inserted text cannot be blank.');
    const before = getSelectedTextTarget();
    const shapeId = args.shapeId || before?.shapeId;
    if (!shapeId || before?.ambiguous) throw new Error('Select one textbox or table cell to insert text.');
    await prepare(args, signal);
    const afterTarget = getSelectedTextTarget();
    const stillSelectedCell = shapeId.startsWith('tbl:') && !afterTarget?.ambiguous && !afterTarget?.shapeId && getSelectSelShps().includes(shapeId.split(':')[1]);
    if (before?.shapeId === shapeId && afterTarget?.shapeId !== shapeId && !stillSelectedCell) throw new Error('The selection changed. Try again.');
    const shape = textShape(shapeId);
    if (['line', 'polygon'].includes(shape.type) || (!shape.txBody && !canInitializeText(shape)) || shape.children?.length || shape.graphic) throw new Error('The selected object has no editable text body. Choose a text shape or a single table cell.');
    const txBody = structuredClone(shape.txBody || { bodyPr: {}, p: [] });
    const existing = txBody.p || [];
    const after = args.afterParagraph ?? existing.length;
    if (after > existing.length) throw new Error('That paragraph does not exist in the textbox.');
    // Inherit the insertion paragraph style without rewriting any existing runs.
    const preceding = existing[after - 1];
    const template = preceding ? { p: [{ ...preceding, r: preceding.r?.length ? [preceding.r.at(-1)] : [{ rPr: preceding.endParaRPr || preceding.pPr?.defRPr || txBody.bodyPr?.defRPr || { $_sz: 2400 } }] }] } : txBody;
    const added = paragraphs(args.text.replace(/\r\n?/g, '\n'), template);
    txBody.p = [...existing.slice(0, after), ...added, ...existing.slice(after)];
    if (shape.id.startsWith('tbl:')) updateShape({ txBody }, shape.id);
    else updateShape({ id: shape.id, txBody });
    await saveDexie();
    return { shapeId: shape.id, insertedParagraphs: added.length, afterParagraph: after };
  },
  async formatText(args, signal?: AbortSignal) {
    const style: any = {};
    if (args.fontSize !== undefined) style.$_sz = Math.round(args.fontSize * 100);
    if (args.fontFamily !== undefined) {
      if (!args.fontFamily.trim()) throw new Error('Font family cannot be blank.');
      style.latin = { $_typeface: args.fontFamily.trim() };
    }
    for (const [arg, key] of [['bold', '$_b'], ['italic', '$_i']])
      if (args[arg] !== undefined) style[key] = args[arg] ? 1 : 0;
    if (args.underline !== undefined) style.$_u = args.underline ? 'sng' : 'none';
    if (args.textColor !== undefined) style.solidFill = editorColor(args.textColor);
    const shape = await prepareTarget(args, signal);
    if (!shape.txBody || shape.children?.length || shape.graphic) throw new Error('The selected object has no editable text body. Choose a text shape or a single table cell.');
    const txBody = structuredClone(shape.txBody);
    const patch = previous => ({ ...previous, ...structuredClone(style) });
    txBody.bodyPr = { ...txBody.bodyPr, defRPr: patch(txBody.bodyPr?.defRPr) };
    for (const p of txBody.p || []) {
      p.pPr = { ...p.pPr, defRPr: patch(p.pPr?.defRPr) };
      p.endParaRPr = patch(p.endParaRPr);
      for (const run of [...(p.r || []), ...(Array.isArray(p.fld) ? p.fld : p.fld ? [p.fld] : [])]) run.rPr = patch(run.rPr);
    }
    updateShape({ id: shape.id, txBody });
    await saveDexie();
    return { shapeId: shape.id, formatting: Object.fromEntries(['fontSize', 'fontFamily', 'bold', 'italic', 'underline', 'textColor'].filter(key => args[key] !== undefined).map(key => [key, args[key]])) };
  },
  async addText(args, signal?: AbortSignal) {
    // Validate styles before any document mutation.
    const fill = args.fillColor ? editorColor(args.fillColor) : null;
    const color = args.textColor ? editorColor(args.textColor) : null;
    await prepare(args, signal);
    const p = paragraphs(args.text ?? 'Text');
    if (color) for (const para of p) for (const run of para.r) run.rPr.solidFill = color;
    const shape = addShapeRaw({ type: 'text', $_otag: 'sp', x: args.x ?? 100, y: args.y ?? 100, w: args.width ?? 300, h: args.height ?? 100,
      txBody: { bodyPr: {}, p }, solidFill: fill, noFill: !fill, ln: { noFill: true } });
    await saveDexie();
    return { shapeId: shape.id };
  },
  async createDeck(args, signal?: AbortSignal, onProgress?: (message: string) => void, generateImage?: any, execution: { builtinTheme?: string; rewriteText?: any; replaceCurrent?: boolean; imageKeywords?: any; imageMatches?: any; research?: any; researchImages?: any[]; sourceBundles?: any[] } = {}) {
    const { fileId, pageId, ...spec } = args;
    validateArguments(deckSchema, spec);
    const checkTarget = () => {
      current(args, !execution.replaceCurrent);
      if (execution.replaceCurrent && !getFileInfo().slides?.some(slide => slide.id === pageId))
        throw new Error('The submitted slide no longer exists. No edits applied.');
    };
    checkTarget();
    await prepare(args, signal, !execution.replaceCurrent);
    const file = getFileInfo();
    const starterId = !execution.replaceCurrent && emptyStarterSlide(file, getSlideInfo()) ? pageId : undefined;
    if (['docx', 'xlsx', 'pdf'].includes(file.sourceFormat)) throw new Error('Deck generation requires a presentation document.');
    if (execution.replaceCurrent) {
      if (spec.slides.length !== 1) throw new Error('Replacing the current slide requires exactly one generated slide.');
      if (getSlidesSlideId() === pageId && getSlideInfo().shapes?.some(protectedShape)) throw new Error('The current slide contains locked or linked content and cannot be replaced by the agent.');
    }
    if (spec.slides.some(slide => slide.layout === 'pptx')) {
      const {createNativeTemplateDeck} = await import('./native-template-insert.mjs');
      const used = new Set();
      return createNativeTemplateDeck(spec,{fileId,pageId,file,signal,onProgress,genId,starterId,replaceCurrent:execution.replaceCurrent,sourceBundles:execution.sourceBundles,prepareFonts:prepareGeneratedFonts,rewriteText:execution.rewriteText,builtinTheme:execution.builtinTheme,
        prepare:()=>prepare(args,signal,!execution.replaceCurrent),checkTarget,pasteSlide,selectSlide,saveDexie,updateFile,updateSlide,getFileInfo,getSlideInfo,
        rebuildThumbnails:rebuildAgentThumbnails,removeStarter:removeEmptyStarter,
        resolveImage:async(image)=>{
          checkTarget();signal?.throwIfAborted();
          try {
          const asset=await resolveSlideImage(image,{signal,used,generateImage,language:spec.language,sourceAssets:execution.sourceBundles?.flatMap(source=>source.assets),imageKeywords:execution.imageKeywords,onProgress,placeholderOnFailure:true});
          if(asset.placeholder)return asset;
          const media=await processImage(asset.blob,{name:`${genId()}.${asset.blob.type.split('/')[1]}`,fileId});
          checkTarget();signal?.throwIfAborted();return {...asset,media};
          } catch(error) { checkTarget();signal?.throwIfAborted();return {placeholder:true,description:image.query,alt:image.alt,warning:error instanceof Error?error.message:String(error)}; }
        }});
    }
    const layoutid = (execution.replaceCurrent ? file.slides.find(slide => slide.id === pageId)?.layoutid : getSlideInfo().layoutid) || file.layouts?.[0]?.id;
    if (!layoutid) throw new Error('The presentation has no usable layout.');
    const canvas = typeof document === 'undefined' ? undefined : document.createElement('canvas').getContext('2d');
    const options = { width: file.width, height: file.height, genId, geometry: getPrstInfo,
      ...(canvas ? { measureText: canvasTextMeasurer(canvas) } : {}) };
    const draft=compileDeck(spec,{...options,deferTextOutlines:true});
    const fontWarnings = await prepareGeneratedFonts(fileId, draft.pages, onProgress);
    checkTarget(); signal?.throwIfAborted();
    if(draft.pages.some(page=>page.shapes.some(shape=>shape.pendingNative))){
      onProgress?.('Loading document font contours for Boolean text…');
      const {getFontRecordsFromOPFS}=await import('shared-vuejs/api/opfs');
      const fonts=await loadOutlineFonts(file,{readFonts:getFontRecordsFromOPFS,signal,fetchFont:async(url,signal)=>{const response=await fetch(url,{signal});if(!response.ok)throw Error('Cannot load a required outline font.');return response.arrayBuffer();}});
      Object.assign(options,{outlineText:shape=>outlineNativeText(shape,fonts)});
      checkTarget();signal?.throwIfAborted();
    }
    onProgress?.('Checking deck structure and text layout…');
    compileDeck(spec, options); // Reject all layout/data failures before downloading images or changing slides.
    const assets = new Map(), used = new Set();
    for (const { key, image } of deckImageRequests(spec)) {
      onProgress?.(`Finding image ${assets.size + 1}…`);
      let searchQueries: string[] = [];
      try{
        const asset = await resolveSlideImage(image, { signal, used, generateImage, language: spec.language, sourceAssets: execution.sourceBundles?.flatMap(source => source.assets), researchImages: execution.researchImages, imageMatches: execution.imageMatches, imageKeywords: execution.imageKeywords, onProgress, placeholderOnFailure: true });
        searchQueries = asset.searchQueries || [];
        checkTarget(); signal?.throwIfAborted();
        const media = asset.placeholder ? undefined : await processImage(asset.blob, { name: `${genId()}.${asset.blob.type.split('/')[1]}`, fileId });
        if(!asset.placeholder&&(!media?.name||![media.w,media.h].every(v=>Number.isFinite(v)&&v>0)))throw new Error('The stored image has invalid dimensions or no media file.');
        checkTarget(); signal?.throwIfAborted();
        assets.set(key, { ...asset, media });
      }catch(error){
        checkTarget();signal?.throwIfAborted();
        onProgress?.('Image unavailable. Keeping the slide with a described placeholder…');
        assets.set(key,{placeholder:true,description:image.query,alt:image.alt,searchQueries,warning:`Image placeholder for “${image.query}”: ${error instanceof Error?error.message:'Image preparation failed.'}`});
      }
    }
    const compiled = compileDeck(spec, { ...options, assets });
    if (execution.sourceBundles?.length) {
      const {saveToOPFS} = await import('shared-vuejs/api/opfs');
      const references = [];
      for (const source of execution.sourceBundles) {
        signal?.throwIfAborted(); checkTarget();
        const base = `pptx/${encodeURIComponent(fileId)}/_internal/agent-sources/${encodeURIComponent(source.id)}`;
        for (const asset of source.assets) if (asset.data) await saveToOPFS(`${base}/${encodeURIComponent(asset.id)}.bin`, asset.data);
        const manifest = {...source,assets:source.assets.map(({data,blob,...asset})=>asset)};
        await saveToOPFS(`${base}/manifest.json`,new TextEncoder().encode(JSON.stringify(manifest)));
        references.push({id:source.id,name:source.name,kind:source.kind,manifest:`${base}/manifest.json`,warnings:source.warnings});
      }
      for (const page of compiled.pages) page.agentMetadata.sourceBundles = references;
    }
    if (execution.research?.sources?.length) for (const page of compiled.pages)
      page.agentMetadata.researchSources = execution.research.sources;
    if (spec.slides.some(slide => ['html','markdown'].includes(slide.layout)))
      for (const warning of new Set(compiled.warnings)) console.warn('[Desq slide conversion]', warning);
    await prepare(args, signal, !execution.replaceCurrent);
    const pageIds: string[] = [], warnings = [...new Set([...fontWarnings, ...compiled.warnings, ...reviewDeck(spec, compiled).findings])];
    if (execution.replaceCurrent) {
      const page = compiled.pages[0];
      checkTarget(); signal?.throwIfAborted();
      const viewedPageId = getSlidesSlideId();
      if (viewedPageId !== pageId) {
        onProgress?.('Opening the submitted slide to apply its update…');
        await selectSlide(pageId);
      }
      await prepare(args, signal);
      checkTarget(); signal?.throwIfAborted();
      // Selection is checked strictly at the commit boundary, even though
      // navigation during generation and asset preparation is allowed.
      current(args);
      if (getSlideInfo().shapes?.some(protectedShape)) throw new Error('The current slide contains locked or linked content and cannot be replaced by the agent.');
      onProgress?.('Replacing the current slide…');
      deselectAll();
      updateSlide({ ...getSlideInfo(), ...page, id: pageId, fileId, layoutid,
        timing: page.timing, transition: page.transition });
      updateFile({ slides: getFileInfo().slides.map(slide => slide.id === pageId ? { ...slide, name: page.name } : slide) });
      await saveDexie({ skipGenerateThumb: true });
      await rebuildAgentThumbnails(fileId, [pageId], warnings, onProgress);
      textCursor = undefined;
      if (viewedPageId !== pageId && getFileInfo()?.id === fileId && getSlidesSlideId() === pageId &&
        getFileInfo().slides.some(slide => slide.id === viewedPageId)) {
        try { await selectSlide(viewedPageId); } catch { warnings.push('The edit was saved, but the previously viewed slide could not be reopened.'); }
      }
      return { title: spec.title, pageIds: [pageId], slideCount: 1, replaced: true,
        imageCount: pageImageCount(page),
        placeholderCount: page.shapes.filter(shape => shape.imagePlaceholder).length, shapeCount: page.shapes.length, warnings };
    }
    // pasteSlide inserts after the selected page. Advance it after each persisted page,
    // preserving model order and existing slides. Each page is one native Undo operation.
    try {
      for (const [index, page] of compiled.pages.entries()) {
        current({ fileId, pageId: pageIds.at(-1) || pageId }); signal?.throwIfAborted();
        onProgress?.(`Inserting slide ${index + 1} of ${compiled.pages.length}: ${page.name}`);
        const id = await pasteSlide({ ...page, id: pageId, fileId, layoutid }, fileId);
        pageIds.push(id);
        if (getFileInfo()?.id !== fileId) throw new Error('The open document changed.');
        onProgress?.(`Saving slide ${index + 1} of ${compiled.pages.length}…`);
        await saveDexie({ skipGenerateThumb: true });
        onProgress?.(`Opening slide ${index + 1} of ${compiled.pages.length}…`);
        await selectSlide(id);
      }
      await removeEmptyStarter(fileId, starterId, pageIds, warnings, onProgress);
    } catch (error) {
      throw new Error(`Deck insertion stopped after ${pageIds.length}/${compiled.pages.length} slides. Inserted pages remain editable; use Undo to remove them. ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      // Even a partially inserted deck needs previews for its committed pages.
      await rebuildAgentThumbnails(fileId, pageIds, warnings, onProgress);
    }
    textCursor = undefined;
    return { title: spec.title, pageIds, slideCount: pageIds.length, imageCount: compiled.pages.reduce((count,page)=>count+pageImageCount(page),0), placeholderCount: compiled.pages.reduce((count,page)=>count+page.shapes.filter(s=>s.imagePlaceholder).length,0),
      shapeCount: compiled.pages.reduce((total, page) => total + page.shapes.length, 0), warnings };
  },
  async createSlide(args, signal?: AbortSignal, onProgress?: (message: string) => void, generateImage?: any, execution: { imageKeywords?: any; imageMatches?: any; researchImages?: any[]; sourceBundles?: any[] } = {}) {
    validateSlideContent(args);
    await prepare(args, signal);
    const file = getFileInfo();
    const starterId = emptyStarterSlide(file, getSlideInfo()) ? args.pageId : undefined;
    if (['docx', 'xlsx', 'pdf'].includes(file.sourceFormat)) throw new Error('Slide generation requires a presentation document.');
    const layoutid = getSlideInfo().layoutid || file.layouts?.[0]?.id;
    if (!layoutid) throw new Error('The presentation has no usable slide layout.');
    // Reject oversized content before image requests or any slide mutation.
    buildGeneratedSlide(args, { width: file.width, height: file.height, genId: () => 'preview',
      assets: (args.images || []).map(() => ({ media: { name: 'preview', w: 1000, h: 700 }, title: 'Photo', author: 'Author', license: 'CC BY 4.0', sourceUrl: 'https://commons.wikimedia.org' })) });
    const assets: any[] = [], used = new Set();
    for (const image of args.images || []) {
      let searchQueries: string[] = [];
      try{
      const asset = await resolveSlideImage(image, { signal, used, generateImage, sourceAssets: execution.sourceBundles?.flatMap(source => source.assets), researchImages: execution.researchImages, imageMatches: execution.imageMatches, imageKeywords: execution.imageKeywords, onProgress, placeholderOnFailure: true });
      searchQueries = asset.searchQueries || [];
      current(args); signal?.throwIfAborted();
      const media = asset.placeholder ? undefined : await processImage(asset.blob, { name: `${genId()}.${asset.blob.type.split('/')[1]}`, fileId: args.fileId });
      if(!asset.placeholder&&(!media?.name||![media.w,media.h].every(v=>Number.isFinite(v)&&v>0)))throw new Error('The stored image has invalid dimensions or no media file.');
      current(args); signal?.throwIfAborted();
      assets.push({ ...asset, media });
      }catch(error){
        current(args);signal?.throwIfAborted();
        onProgress?.('Image unavailable. Keeping the slide with a described placeholder…');
        assets.push({placeholder:true,description:image.query,alt:image.alt,searchQueries,warning:`Image placeholder for “${image.query}”: ${error instanceof Error?error.message:'Image preparation failed.'}`});
      }
    }
    const shapes = buildGeneratedSlide(args, { width: file.width, height: file.height, genId, assets });
    const fontWarnings = await prepareGeneratedFonts(args.fileId, [{ shapes }], onProgress);
    await prepare(args, signal);
    // The fully populated page is persisted before selection, like Duplicate Page.
    // Its file-level insertion is one normal Undo entry; no placeholder slide is exposed.
    const page = promoteSlideBackground({ id: args.pageId, fileId: args.fileId, layoutid, name: args.title,
      showMaster: '0', shapes, transition: { advClick: 1 } }, { width: file.width, height: file.height });
    const pageId = await pasteSlide(page, args.fileId);
    if (getFileInfo()?.id !== args.fileId) throw new Error('The document changed while inserting the slide. Return to the presentation to inspect the inserted page.');
    await saveDexie({ skipGenerateThumb: true });
    await selectSlide(pageId);
    const warnings: string[] = [...fontWarnings, ...assets.filter(a => a.placeholder).map(a => a.warning)];
    await removeEmptyStarter(args.fileId, starterId, [pageId], warnings, onProgress);
    await rebuildAgentThumbnails(args.fileId, [pageId], warnings, onProgress);
    textCursor = undefined;
    return { pageId, title: args.title, shapeCount: shapes.length, imageCount: assets.filter(a => !a.placeholder).length, placeholderCount: assets.filter(a => a.placeholder).length,
      imageSources: assets.filter(a => !a.placeholder).map(({ title, author, license, sourceUrl }) => ({ title, author, license, sourceUrl })), warnings };
  },
  async addAutoshape(args, signal?: AbortSignal) {
    const fill = editorColor(args.fillColor || 'blue');
    const preset = resolveAutoshape(args.shape);
    const w = args.width ?? (args.shape === 'circle' ? args.height ?? 160 : 200);
    const h = args.height ?? (args.shape === 'circle' ? w : 120);
    if (args.shape === 'circle' && w !== h) throw new Error('A circle requires equal width and height.');
    const prstGeom = { avLst: {}, $_prst: preset.id };
    const geometry = getPrstInfo(prstGeom, w, h);
    if (!geometry?.d || /NaN|Infinity|undefined|null/.test(geometry.d)) throw new Error(`The editor could not generate geometry for ${preset.name}.`);
    await prepare(args, signal);
    // Geometry may expose adjustment callbacks. Store only serializable shape data.
    const shape = addShapeRaw({ type: preset.id === 'ellipse' ? 'ellipse' : preset.name.toLowerCase(),
      $_otag: /Connector/.test(preset.id) ? 'cxnSp' : 'sp',
      name: preset.name, x: args.x ?? 100, y: args.y ?? 100, w, h, d: geometry.d,
      ...(geometry.pathTransform ? { pathTransform: geometry.pathTransform } : {}),
      ...(geometry.prstTxMargin ? { prstTxMargin: geometry.prstTxMargin } : {}),
      prstGeom, solidFill: preset.noFill ? null : fill, noFill: preset.noFill,
      ln: { solidFill: preset.noFill ? fill : editorColor('black') } });
    await saveDexie();
    return { shapeId: shape.id, shape: args.shape };
  },
  async moveShapeBy(args, signal?: AbortSignal) {
    const shape = await prepareTarget(args, signal);
    const shapeId = shape.id;
    const dx = args.dx ?? 0, dy = args.dy ?? 0;
    if (!dx && !dy) throw new Error('Specify a nonzero dx or dy to move the shape.');
    const x = shape.x + dx, y = shape.y + dy;
    if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 10000 || Math.abs(y) > 10000)
      throw new Error('The destination is outside the allowed coordinate range.');
    updateShape({ id: shapeId, x, y });
    await saveDexie();
    return { shapeId, x, y, dx, dy };
  },
  async moveShape(args, signal?: AbortSignal) {
    await prepare(args, signal);
    topShape(args.shapeId);
    updateShape({ id: args.shapeId, x: args.x, y: args.y });
    await saveDexie();
    return { shapeId: args.shapeId, x: args.x, y: args.y };
  },
  async deleteShape(args, signal?: AbortSignal) {
    await prepare(args, signal);
    topShape(args.shapeId);
    deselectAll();
    deleteShape({ delshp: args.shapeId, evt: null });
    await saveDexie();
    return { deletedShapeId: args.shapeId };
  },
};
