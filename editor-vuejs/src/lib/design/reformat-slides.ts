import {
  getFileInfo, getSlideInfo, getSlidesSlideId, getSlidesMasterView, getInfoUseGrid, updateFile, updateSlide,
} from 'shared-vuejs/editor';
import { loadAllAssetsFromDexie, loadSlideFromDexie, saveDexie, saveThumb } from 'shared-vuejs/api/dbutils';
import { selectSlide, pasteSlide } from 'shared-vuejs/api/slide';
import { flushPendingTextSave, hideEditor } from 'shared-vuejs/api/updateText';
import { linkedSlides } from 'shared-vuejs/api/linked-slides';
import { installModelLayout } from 'shared-vuejs/api/installModelLayout';
import { getFullShape } from 'shared-vuejs/renderer';
import { genId } from 'shared-vuejs/api/utility';
import { generatedFontFamilies, loadGeneratedGoogleFonts } from '../agent/generated-fonts.mjs';
import { canvasTextMeasurer } from '../agent/deck-text.mjs';
import { editorColor } from '../agent/colors.mjs';
import existingTemplateCatalog from './template-catalog.json';
import generatedTemplateCatalog from './generated-template-catalog.json';
import { withSourceLayouts } from './source-layouts.mjs';
import { contentRole, needsClosingSlide } from './design-roles.mjs';
const templateCatalog = [...withSourceLayouts(existingTemplateCatalog), ...generatedTemplateCatalog];
import { fitLayouts, layouts, readSlide, sharedDesignLayout, isThemeAccent, splitBulletContent, mergePhotoText, copyInheritedPictures, isSinglePixelPicture } from './reformat-layouts.mjs';

const catalogVariants = templateCatalog.flatMap(theme => theme.variants.map(variant => ({
  family: theme.name,
  familySlug: theme.slug,
  label: variant.label,
  role: variant.role,
  roleIndex: layouts.findIndex(layout => layout.id === variant.role),
}))).filter(variant => variant.roleIndex >= 0);

const flexibleTextLayouts = new Set(['section', 'editorial', 'cards']);
const flexibleVisualLayouts = new Set(['picture-rail', 'picture-strip', 'gallery']);
const systemFonts = new Set(['Arial', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana', 'Tahoma']);

let rankingWorker: Worker | undefined;
let rankingQueue = Promise.resolve();
let rankingIdle: ReturnType<typeof setTimeout>;

function rankLayouts(slides: string[], variants: typeof catalogVariants, onProgress: Progress) {
  const request = rankingQueue.then(() => {
    clearTimeout(rankingIdle);
    const worker = rankingWorker ||= new Worker(new URL('./layout-embeddings.worker.mjs', import.meta.url), { type: 'module' });
    return new Promise<number[][]>((resolve, reject) => {
      const fail = (cause: unknown) => {
        worker.terminate();
        rankingWorker = undefined;
        reject(cause);
      };
      worker.onerror = () => fail(new Error('Unable to start the local layout model.'));
      worker.onmessageerror = () => fail(new Error('Unable to read the local layout model results.'));
      worker.onmessage = ({ data }) => {
        if (data.error) fail(new Error(data.error));
        else if (data.scores) {
          rankingIdle = setTimeout(() => {
            worker.terminate();
            rankingWorker = undefined;
          }, 90_000);
            resolve(data.scores);
        } else {
          onProgress(data.indexing ? 'Indexing layout descriptions…' :
            `Ranking layouts for slide ${data.done} of ${slides.length}…`);
        }
      };
      worker.postMessage({
        variants: variants.map(variant => ({
          label: variant.label,
          description: layouts[variant.roleIndex].description,
        })),
        slides,
      });
    });
  });
  rankingQueue = request.then(() => {}, () => {});
  return request;
}

function shapeSnapshot(shapes: any[] = []) {
  return JSON.stringify(shapes || [], (key, value) => key === 'xmlNodeIndex' || key === 'dirty' ? undefined : value);
}

function canEditDeck(file: any) {
  return file?.slides?.length && file.sourceFormat !== 'docx' && !file.docPageGeometry &&
    !getSlidesMasterView() && !getInfoUseGrid();
}

type Progress = (message: string) => void;
type ReformatResult = { reformatted: number; skipped: number; added: number };
export async function reformatSlides(onProgress: Progress, family: string): Promise<ReformatResult> {
  const selectedTheme = templateCatalog.find(entry => entry.slug === family);
  const variants = catalogVariants.filter(variant => variant.familySlug === family);
  if (!selectedTheme || !variants.length) throw new Error('The selected family has no available layouts.');
  const theme = selectedTheme;
  const layoutIds = new Set(variants.map(variant => variant.role));
  const file = getFileInfo();
  if (!canEditDeck(file)) throw new Error('Open a presentation in slide view to reformat it.');
  const { id: fileId, width, height } = file;
  const slideIds = file.slides.map(slide => slide.id);
  const originalSlideIds = new Set(slideIds);
  if (![width, height].every(value => Number.isFinite(value) && value > 0))
    throw new Error('The presentation has an invalid slide size.');

  function checkDeck() {
    const current = getFileInfo();
    if (current?.id !== fileId || !canEditDeck(current) || current.width !== width || current.height !== height ||
        current.slides.length !== slideIds.length || current.slides.some((slide, i) => slide.id !== slideIds[i])) {
      throw new Error('The presentation changed. Choose a family again.');
    }
  }

  onProgress('Reading slide content…');
  await flushPendingTextSave();
  hideEditor();
  await flushPendingTextSave();
  await saveDexie({ skipGenerateThumb: true });
  checkDeck();
  const pages = await Promise.all(slideIds.map(id => loadSlideFromDexie(fileId, id, 'slides')));
  const content = await Promise.all(pages.map(async page => {
    const isProtected = shape => shape.locked || shape.mainDoc || shape.linkedTextbox ||
      shape.docAnchor || shape.docAnchorParagraphId || shape.ocrRegion ||
      linkedSlides.previous(shape.id, page.id) || shape.children?.some(isProtected);
    const assets = await loadAllAssetsFromDexie(file, page.id);
    const layout = file.layouts?.find(layout => layout.id === assets.layoutInfo?.id);
    const shapes = (page.shapes || []).filter(shape =>
      !isThemeAccent(shape) && (isProtected(shape) || !isSinglePixelPicture(shape)));
    const inheritedPictures = [...shapes.filter(shape => shape.reformatPictureSource), ...copyInheritedPictures({
      page: { ...page, shapes }, layout: assets.layoutInfo, master: assets.masterInfo,
      recoverMaster: !!layout?.sharedHtmlLayout, genId,
    })];
    const contentShapes = shapes.filter(shape => !shape.reformatPictureSource);
    return { page, assets, inheritedPictures, protected: shapes.some(isProtected),
      item: readSlide({ ...page, shapes: contentShapes }, isProtected, { width, height }) };
  }));

  const context = document.createElement('canvas').getContext('2d');
  if (!context) throw new Error('Unable to measure slide text.');
  const readable = content.filter(entry => !entry.protected && !('reason' in entry.item));
  if (readable.length) onProgress('Ranking layouts for each slide…');
  const scores = readable.length
    ? await rankLayouts(readable.map(({ item }) =>
      [item.title && `Title: ${item.title}`, item.body].filter(Boolean).join('\n') || 'A slide with visual objects.'
    ), variants, onProgress).catch(error => {
      console.warn('Using layout fit to rank Design Ideas.', error);
      return [];
    })
    : [];
  checkDeck();
  onProgress('Measuring text for each layout…');
  const defaultFont = 'Arial';
  const markerFont = 'markerFont' in theme ? theme.markerFont : undefined;
  const layoutFonts = layouts.filter(layout => layoutIds.has(layout.id))
    .flatMap(layout => [
      ...('fontFamilies' in layout ? layout.fontFamilies : []),
      ...(layout.artwork || []).map(art => art.fontFamily).filter(Boolean),
    ]);
  const requestedFonts = [...new Set([theme.headingFont, theme.bodyFont, ...(markerFont ? [markerFont] : []), ...layoutFonts])]
    .filter(font => !systemFonts.has(font));
  const localFonts = new Set((file.fonts || []).filter(font => font.type === 'local').map(font => font.family));
  const failed = readable.length
    ? await loadGeneratedGoogleFonts(requestedFonts.filter(font => !localFonts.has(font))) : [];
  checkDeck();
  const fontFor = (font: string) => failed.includes(font) ? defaultFont : font;
  const options = {
    width, height, genId, theme, layoutIds, headingFont: fontFor(theme.headingFont), bodyFont: fontFor(theme.bodyFont),
    measureText: canvasTextMeasurer(context),
    profile: 'standard',
    fontsForLayout: () => ({
      headingFont: fontFor(theme.headingFont),
      bodyFont: fontFor(theme.bodyFont),
      markerFont: markerFont ? fontFor(markerFont) : undefined,
    }),
  };
  const fontsForShapes = (shapes: any[], existing: any[]) => [
    ...existing,
    ...generatedFontFamilies(shapes)
      .filter(family => requestedFonts.includes(family) && !failed.includes(family) &&
        !existing.some(font => font.family === family))
      .map(family => ({ type: 'google', family })),
  ];
  const closingLayouts = layouts.filter(layout => layoutIds.has(layout.id) && layout.isClosing && !layout.image && !layout.unavailableReason);
  const closingLayout = closingLayouts.find(layout => !layout.generic) || closingLayouts[0];
  let closingCandidate;
  if (needsClosingSlide(pages, content, closingLayout)) {
    const closingTitle = { id: genId(), ph: { $_type: 'title' },
      txBody: { p: [{ r: [{ t: closingLayout.defaultTitle || 'Thank you' }] }] } };
    const closingContent = readSlide({ shapes: [closingTitle] }, () => false, { width, height });
    closingCandidate = fitLayouts(closingContent, { ...options,
      layoutIds: new Set([closingLayout.id]), slideNumber: slideIds.length + 1, slideCount: slideIds.length + 1 })[0];
  }
  const targetSlideCount = slideIds.length + Number(!!closingCandidate);
  const scoresByPage = new Map(readable.map(({ page }, index) => [page.id, scores[index]]));
  type Plan = { page: any; shapes: any[]; layout: string; source: string; background: string };
  const plans: Plan[] = [];
  const skippedSlides: { slide: number; reason: string }[] = [];
  for (const { page, assets, item, inheritedPictures, protected: protectedObjects } of content) {
    const ranking = scoresByPage.get(page.id);
    const purpose = page.agentMetadata?.designIdeas?.automaticClosing ? 'closing' : contentRole(item);
    const rankCandidate = candidate => {
      let best = -Infinity;
      let source = '';
      variants.forEach((variant, index) => {
        if (variant.role !== candidate.id) return;
        const matchScore = ranking?.[index] ?? 0;
        if (matchScore > best) {
          best = matchScore;
          source = `${variant.family} · ${variant.label}`;
        }
      });
      return { candidate, source, score: best };
    };
    const fit = content => fitLayouts(content, { ...options,
      slideNumber: slideIds.indexOf(page.id) + 1, slideCount: targetSlideCount,
    }).map(rankCandidate).filter(({ candidate, source }) => {
      const layout = layouts.find(entry => entry.id === candidate.id);
      if (layout?.isClosing) return !!source && purpose === 'closing' && page.id === slideIds.at(-1) && page.id !== slideIds[0];
      return source && (!(layout?.isCover || candidate.id.endsWith('cover')) || page.id === slideIds[0]);
    });
    if ('reason' in item || protectedObjects) {
      skippedSlides.push({
        slide: slideIds.indexOf(page.id) + 1,
        reason: 'reason' in item ? item.reason : 'locked or linked content',
      });
      continue;
    }
    let listContent = item;
    if (item.texts.some(entry => entry.shape.ph && entry.role !== 'title')) {
      const { layoutInfo, masterInfo, theme: sourceTheme } = assets;
      listContent = { ...item, texts: item.texts.map(entry => {
        if (!entry.shape.ph || entry.role === 'title') return entry;
        const shape = getFullShape(entry.shape, {
          fileInfo: file, slideInfo: page, layoutInfo, masterInfo, theme: sourceTheme,
        });
        const inheritedListStyle = {
          ...masterInfo?.txStyles?.bodyStyle, ...shape._masterShp?.txBody?.lstStyle,
          ...shape._layoutShp?.txBody?.lstStyle,
        };
        return { ...entry, inheritedListStyle };
      }) };
    }
    const split = splitBulletContent(listContent, genId);
    // Use a card or step layout when the split fits. Keep the textbox as a
    // single list when its items need more room together.
    let candidates = split ? fit(split) : [];
    if (!candidates.length || page.id === slideIds[0]) candidates.push(...fit(listContent));
    const merged = candidates.length ? null : mergePhotoText(listContent);
    if (merged) candidates = fit(merged);
    if (!candidates.length) {
      const flexibleOptions = { ...options, flexible: true, layoutIds: item.images.length ? flexibleVisualLayouts : flexibleTextLayouts };
      let fallback = fitLayouts(split || listContent, flexibleOptions);
      if (split && !fallback.length) fallback = fitLayouts(listContent, flexibleOptions);
      if (merged && !fallback.length) fallback = fitLayouts(merged, flexibleOptions);
      candidates = fallback.map(candidate => ({ candidate, score: 0, source: `${theme.name} · Flexible layout` }));
    }
    const makePlan = ({ candidate, source }): Plan => ({
      page,
      shapes: [...inheritedPictures, ...candidate.shapes],
      layout: candidate.id,
      source,
      background: candidate.theme.background,
    });
    const priority = ({ candidate }) => {
      const layout = layouts.find(layout => layout.id === candidate.id);
      if (page.id === slideIds[0] &&
          (candidate.id.endsWith('-cover') || layout?.isCover)) return 100;
      if (purpose === 'closing' && layout?.isClosing) return 90;
      if (purpose === 'summary' && layout?.templateRole === 'summary') return 80;
      if (purpose === 'text' && layout?.preferredContent === 'title-short-text' &&
          item.texts.length === 2 && !item.images.length) return 50;
      if ((split || purpose === 'points') && layout?.templateRole === 'points') return layout.generic ? 40 : 60;
      if (layout?.generic) return -1;
      return candidate.id === 'timeline' ? 2 : Number(candidate.styledList);
    };
    candidates.sort((a, b) => priority(b) - priority(a) || b.score - a.score);
    if (candidates.length) plans.push(makePlan(candidates[0]));
    else skippedSlides.push({ slide: slideIds.indexOf(page.id) + 1, reason: 'content did not fit' });
  }

  if (skippedSlides.length) console.table(skippedSlides);
  return applyPlans(plans, onProgress);

  async function applyPlans(plans: Plan[], onProgress: Progress): Promise<ReformatResult> {
    async function getFamilyLayout() {
      const design = sharedDesignLayout(width, height, genId, theme);
      const reference = design.shapes.at(-1);
      const currentFile = getFileInfo();
      let masterLayout;
      for (const layout of [...(currentFile.layouts || [])].reverse()) {
        if (!layout.parentid || !layout.sharedHtmlLayout || layout.name !== theme.name) continue;
        const artwork = await loadSlideFromDexie(fileId, layout.id, 'slideLayouts');
        checkDeck();
        if (artwork?.bg?.bgPr?.solidFill?.uniClr?.$_val === design.bg.bgPr.solidFill.uniClr.$_val &&
            artwork.shapes?.length === design.shapes.length &&
            (!reference || artwork.shapes.some(shape => shape.name === reference.name &&
              ['x', 'y', 'w', 'h'].every(key => Math.abs(shape[key] - reference[key]) < .01)))) {
          masterLayout = layout;
          break;
        }
      }
      if (!masterLayout) {
        const baseLayout = currentFile.layouts?.find(layout => layout.parentid && !layout.sharedHtmlLayout) ||
          currentFile.layouts?.find(layout => layout.parentid);
        if (!baseLayout) throw new Error('The presentation has no slide master layout to use.');
        onProgress('Installing shared slide artwork…');
        masterLayout = await installModelLayout(getFileInfo(), baseLayout.id, {
          name: theme.name, replaceArtwork: true, ...design,
        });
        checkDeck();
      }
      return masterLayout;
    }

    if (!plans.length) return { reformatted: 0, skipped: pages.length, added: 0 };
    const saved: string[] = [];
    try {
      checkDeck();
      const masterLayout = await getFamilyLayout();
      for (const { page, shapes, background, layout, source } of plans) {
        onProgress(`Applying ${theme.name} to slide ${saved.length + 1} of ${plans.length}…`);
        checkDeck();
        const stored = await loadSlideFromDexie(fileId, page.id, 'slides');
        checkDeck();
        const active = getSlideInfo();
        const isActive = getSlidesSlideId() === page.id && active?.id === page.id;
        const current = isActive ? active : stored;
        if (current?.id !== page.id || current.layoutid !== page.layoutid ||
            shapeSnapshot(current.shapes) !== shapeSnapshot(page.shapes))
          throw new Error('A slide changed while layouts were being prepared. Choose a family again.');
        const bg = background.toUpperCase() === theme.background.toUpperCase() ? null :
          { bgPr: { solidFill: editorColor(background) } };
        const definition = layouts.find(entry => entry.id === layout);
        const next = { ...current, bg, showMaster: 1, layoutid: masterLayout.id, shapes,
          agentMetadata: { ...current.agentMetadata,
            templateSelection: { family, layout, modelSelectedLayout: false, hostReflowed: true },
            designIdeas: { ...current.agentMetadata?.designIdeas, family, layout, source, role: definition?.templateRole || 'text' } } };
        if (!isActive) {
          // This writer persists the slide XML and its IndexedDB model without mounting it.
          if (linkedSlides.fileId !== fileId) throw new Error('The presentation changed. Choose a family again.');
          linkedSlides.save(next);
          await linkedSlides.flush();
          checkDeck();
        }
        linkedSlides.slides.set(page.id, next);
        const currentFile = getFileInfo();
        const fonts = currentFile.fonts || [];
        const usedFonts = fontsForShapes(shapes, fonts);
        updateFile({
          layouts: currentFile.layouts.some(layout => layout.id === masterLayout.id) ? currentFile.layouts :
            [...currentFile.layouts, masterLayout],
          slides: currentFile.slides.map(slide => slide.id === page.id ? { ...slide, layoutid: masterLayout.id } : slide),
          ...(usedFonts.length > fonts.length ? { fonts: usedFonts } : {}),
        });
        if (isActive) updateSlide(next);
        await saveDexie({ skipGenerateThumb: true });
        saved.push(page.id);
      }
      if (closingCandidate) {
        checkDeck();
        onProgress('Adding the closing slide…');
        const background = closingCandidate.theme.background;
        const closingPage = {
          id: slideIds.at(-1), fileId, name: closingLayout.defaultTitle || 'Thank you',
          shapes: closingCandidate.shapes, showMaster: 1, layoutid: masterLayout.id,
          bg: background.toUpperCase() === theme.background.toUpperCase() ? null :
            { bgPr: { solidFill: editorColor(background) } },
          agentMetadata: {
            templateSelection: { family, layout: closingCandidate.id, modelSelectedLayout: false, hostReflowed: true },
            designIdeas: { family, layout: closingCandidate.id, role: 'closing', automaticClosing: true },
          },
        };
        const id = await pasteSlide(closingPage, fileId, false, { append: true });
        slideIds.push(id);
        checkDeck();
        linkedSlides.slides.set(id, { ...closingPage, id });
        const fonts = getFileInfo().fonts || [];
        const usedFonts = fontsForShapes(closingCandidate.shapes, fonts);
        if (usedFonts.length > fonts.length) updateFile({ fonts: usedFonts });
        await saveDexie({ skipGenerateThumb: true });
        plans.push({ page: { ...closingPage, id }, shapes: closingCandidate.shapes,
          layout: closingCandidate.id, source: theme.name + ' · Closing', background });
        saved.push(id);
      }
    } catch (error) {
      if (!saved.length) throw error;
      throw new Error(`Reformatted ${saved.length} of ${plans.length} slides. ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      if (saved.length) {
        console.info(`Design Ideas · ${saved.length} of ${plans.length} slides saved`);
        console.table(plans.slice(0, saved.length).map(({ page, layout, source }) => ({
          Slide: slideIds.indexOf(page.id) + 1,
          'Slide ID': page.id,
          Layout: layout,
          'Catalog match or source': source,
        })));
      }
      if (getFileInfo()?.id === fileId && canEditDeck(getFileInfo())) {
        const visibleId = getSlidesSlideId();
        if (saved.includes(visibleId)) await selectSlide(visibleId, true);
        for (const id of saved) {
          if (getFileInfo()?.id !== fileId) break;
          try {
            await saveThumb(id, { timeoutMs: 15_000 });
          } catch (error) {
            console.warn('Unable to refresh a reformatted slide thumbnail.', error);
          }
        }
      }
    }
    const reformatted = saved.filter(id => originalSlideIds.has(id)).length;
    return { reformatted, skipped: pages.length - reformatted, added: saved.length - reformatted };
  }
}
