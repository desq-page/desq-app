import van from 'vanjs-core';
import * as vanX from 'vanjs-ext';
import { clone, normalizeDocument, blankDocument, id } from './model.mjs';
import { openLocalDatabase } from './local-db.mjs';

const descriptor = slide => ({ id: slide.id, name: slide.name || slide.title || 'Slide', title: slide.title,
  layoutid: slide.layoutid, transition: slide.transition, show: slide.show });
const fileSlides = (slides, prior = []) => {
  const metadata = new Map(prior.map(slide=>[slide.id,slide]));
  return slides.map(slide=>{
    const {shapes,timing,bg,originalXml,...rest} = metadata.get(slide.id) || {};
    return {...rest,id:slide.id,title:slide.name,layoutid:slide.layoutid,transition:slide.transition};
  });
};
const kinds = ['slide', 'layout', 'master', 'theme', 'asset', 'history', 'thumbnail', 'root'];
const visit = (value, callback) => {
  if (!value || typeof value !== 'object') return;
  callback(value);
  Object.values(value).forEach(item => visit(item, callback));
};

// The UI observes independent signals. Only view holds shape models, and it
// contains one slide plus that slide's dependencies, never the entire deck.
export function createEditorStore(options = {}) {
  let input = options.document;
  const source = options.source;
  const workspace = options.workspace || id();
  const view = van.state(null), slides = van.state([]), metadata = van.state(null), history = van.state({ canUndo: false, canRedo: false, dirty: false });
  const loading = van.state(true), error = van.state(null);
  const ui = vanX.reactive({ slideId:'', selection:[], zoom:100, fit:true, scale:1, showGuides:false,
    dirty:false, canUndo:false, canRedo:false, status:'Loading document…', busy:false, presenting:false });
  let db, header, disposed = false, selectionGeneration = 0, loadGeneration = 0;
  let tail = Promise.resolve(), revision = 0, historyTail = Promise.resolve();
  const inflight = new Map();
  const pendingRecords = new Map();
  const recordKey = (kind,key) => JSON.stringify([kind,key]);
  const listeners = new Set();
  const urls = new WeakMap();
  function releaseView(doc) { for (const url of urls.get(doc) || []) URL.revokeObjectURL(url); urls.delete(doc); }
  function setView(next) {
    const previous = view.rawVal;
    if (previous && previous !== next) {
      const retained = new Set(Object.values(next?.assets || {}).map(asset => typeof asset === 'string' ? asset : asset?.data || asset?.url));
      const keep = [];
      for (const url of urls.get(previous) || []) {
        if (retained.has(url)) keep.push(url); else URL.revokeObjectURL(url);
      }
      if (next && keep.length) urls.set(next,[...(urls.get(next) || []),...keep]);
      urls.delete(previous);
    }
    view.val = next;
  }
  function objectAsset(asset, allocated) {
    const value = typeof asset === 'string' ? asset : asset?.data || asset?.url;
    if (!value?.startsWith('data:')) return asset;
    const comma = value.indexOf(',');
    const prefix = value.slice(5,comma);
    const bytes = /;base64$/i.test(prefix) ? Uint8Array.from(atob(value.slice(comma+1)),c=>c.charCodeAt(0)) : new TextEncoder().encode(decodeURIComponent(value.slice(comma+1)));
    const url = URL.createObjectURL(new Blob([bytes],{type:prefix.split(';')[0]}));
    allocated.push(url);
    return typeof asset === 'string' ? url : {...asset,data:url};
  }
  function emit(event) { for (const listener of listeners) listener(event); }
  function report(cause) { error.val = cause; ui.status = `Local save failed: ${cause.message}`; options.onError?.(cause); }
  function enqueue(operation) {
    const write = tail.then(operation);
    tail = write;
    write.catch(report);
    return write;
  }
  function publishHeader() {
    if (JSON.stringify(metadata.rawVal) !== JSON.stringify(header.file)) metadata.val = header.file;
    // A slide selection never writes this signal. Edits only update the list
    // when slide descriptors or ordering actually change.
    if (JSON.stringify(slides.rawVal) !== JSON.stringify(header.slides)) slides.val = header.slides;
    history.val = { canUndo: header.cursor > (header.base || 0), canRedo: header.cursor < header.length, dirty: header.token !== header.savedToken };
    Object.assign(ui,history.rawVal);
  }
  function headerEntries() { return ['header', 'document', clone(header)]; }
  async function record(kind, recordId, settings = {}) {
    if (!recordId) return undefined;
    const overlay = settings.pending || pendingRecords;
    const pendingKey = recordKey(kind,recordId);
    if (overlay.has(pendingKey)) return structuredClone(overlay.get(pendingKey)[2]);
    const stored = await db.read(workspace, kind, recordId);
    if (stored !== undefined || !source) return stored;
    const key = kind + ':' + recordId;
    if (inflight.has(key)) return inflight.get(key);
    const epoch = loadGeneration;
    const pending = (async () => {
      const value = kind === 'asset' ? await source.loadAsset(recordId) : await source.loadRecord(kind, recordId);
      if (settings.cache !== false && value !== undefined && epoch === loadGeneration) await db.write(workspace, [[kind, recordId, value]]);
      return value;
    })();
    inflight.set(key, pending);
    try { return await pending; } finally { inflight.delete(key); }
  }
  async function readView(slideId, settings = {}) {
    const slide = await record('slide', slideId);
    if (!slide || !Array.isArray(slide.shapes)) throw Error(`Slide ${slideId} is unavailable in the local document.`);
    const slideMeta = header.slides.find(slide => slide.id === slideId);
    const layoutId = slide.layoutid || slideMeta?.layoutid;
    const layout = await record('layout', layoutId);
    const layoutMeta = header.layouts.find(layout => layout.id === layoutId);
    const master = await record('master', layout?.parentid || layoutMeta?.parentid);
    const masterMeta = header.masters.find(item => item.id === master?.id);
    const themeId = master?.theme || masterMeta?.theme || header.file.theme;
    const theme = typeof themeId === 'string' ? await record('theme', themeId) : undefined;
    const targets = new Set();
    [slide, layout, master, theme].forEach(model => visit(model, node => {
      for (const key of ['$_target', 'src', 'poster', 'dataUrl']) if (typeof node[key] === 'string' && !/^(?:data:|blob:|https?:|file:)/i.test(node[key])) targets.add(node[key]);
    }));
    for (const font of header.file.fonts || []) if (font.type === 'local' && font.name) targets.add('fonts/' + font.name);
    const assets = Object.fromEntries((await Promise.all([...targets].map(async target => [target, await record('asset', target)]))).filter(([,value]) => value !== undefined));
    const allocated = [];
    if (settings.objectURLs !== false) for (const key of Object.keys(assets)) assets[key] = objectAsset(assets[key],allocated);
    const result = { version: header.version, file: header.file, slides: [slide], layouts: layout ? [layout] : [], masters: master ? [master] : [],
      themes: theme ? { [themeId]: theme } : {}, tableStyles: header.tableStyles, assets };
    urls.set(result,allocated);
    return result;
  }
  async function selectSlide(slideId) {
    const request = ++selectionGeneration;
    loading.val = true;
    try {
      await tail;
      if (disposed || request !== selectionGeneration) return false;
      if (view.rawVal?.slides[0].id === slideId) return true;
      const next = await readView(slideId);
      if (disposed || request !== selectionGeneration) { releaseView(next); return false; }
      setView(next);
      header = {...header,activeSlide:slideId};
      const selectionHeader = clone(header);
      enqueue(()=>db.write(workspace,[['header','document',selectionHeader]]));
      const sameSlide = ui.slideId === slideId;
      ui.slideId = slideId;
      ui.selection = sameSlide ? ui.selection.filter(id => next.slides[0].shapes.some(shape=>shape.id===id)) : [];
      ui.status = 'Ready';
      emit({ type: 'selection', slideId });
      return true;
    } catch (cause) { if (!disposed && request === selectionGeneration) report(cause); throw cause; }
    finally { if (request === selectionGeneration && !disposed) loading.val = false; }
  }
  async function initialize(documentData, resume = false) {
    const generation = ++loadGeneration;
    ++selectionGeneration;
    loading.val = true;
    await tail.catch(() => {});
    tail = Promise.resolve();
    pendingRecords.clear();
    const saved = resume && await db.read(workspace, 'header', 'document');
    if (saved) header = saved;
    else {
      let doc;
      if (source && !documentData) {
        const data = await source.getHeader();
        header = { ...data, version: data.version || 1, cursor: 0, length: 0, token: 0, savedToken: 0 };
      } else {
        doc = normalizeDocument(documentData || blankDocument());
        header = { version: doc.version, file: doc.file, slides: doc.slides.map(descriptor), layouts: doc.layouts.map(descriptor),
          masters: doc.masters.map(item => ({ ...descriptor(item), theme: item.theme })), tableStyles: doc.tableStyles || [], cursor: 0, length: 0, token: 0, savedToken: 0 };
      }
      if (!header.slides?.length) throw Error('The document has no slides.');
      if (!Number.isFinite(header.file?.width) || header.file.width <= 0 || !Number.isFinite(header.file?.height) || header.file.height <= 0) throw Error('Document width and height must be positive numbers.');
      if (new Set(header.slides.map(slide=>slide.id)).size !== header.slides.length || header.slides.some(slide=>!slide.id)) throw Error('Slide IDs must be unique.');
      header.slides = header.slides.map(descriptor);
      header.layouts = (header.layouts || []).map(item=>({...descriptor(item),parentid:item.parentid}));
      header.masters = (header.masters || []).map(item=>({...descriptor(item),theme:item.theme}));
      // Keep layout parent metadata available without retaining its shapes.
      if (doc) header.layouts = doc.layouts.map(item => ({ ...descriptor(item), parentid: item.parentid }));
      header.file.slides = fileSlides(header.slides,header.file.slides);
      const entries = [headerEntries()];
      if (doc) {
        const {version,file,slides,layouts,masters,themes,assets,tableStyles,...rootMetadata} = doc;
        entries.push(['root','document',rootMetadata]);
        for (const [kind, records] of [['slide',doc.slides],['layout',doc.layouts],['master',doc.masters]]) for (const item of records) entries.push([kind,item.id,item]);
        for (const kind of ['theme', 'asset']) for (const [key,value] of Object.entries(doc[kind === 'theme' ? 'themes' : 'assets'] || {})) entries.push([kind,key,value]);
      }
      await db.write(workspace, entries, kinds);
      doc = undefined;
    }
    if (disposed || generation !== loadGeneration) return;
    revision = Math.max(revision, header.serial || header.token, header.length);
    error.val = null;
    ui.selection = [];
    setView(null);
    publishHeader();
    await selectSlide(header.slides.some(slide=>slide.id===header.activeSlide) ? header.activeSlide : header.slides[0].id);
    emit({type:'load'});
  }
  const ready = (async () => {
    db = await openLocalDatabase(options.databaseName);
    try { await initialize(input, options.resume); } finally { input = undefined; options.document = undefined; }
  })();
  ready.catch(report);

  function commit(next, extraRecords = [], nextSlides) {
    if (!view.rawVal || disposed) return false;
    const before = view.rawVal;
    const beforeHeader = clone(header);
    const targetSlide = next.slides[0];
    const descriptors = nextSlides || header.slides.map(item => item.id === targetSlide.id ? descriptor(targetSlide) : item);
    const file = { ...next.file, slides: fileSlides(descriptors,header.file.slides) };
    if (JSON.stringify(before.slides[0]) === JSON.stringify(targetSlide) && JSON.stringify(before.file) === JSON.stringify(file) && !extraRecords.length && JSON.stringify(header.slides) === JSON.stringify(descriptors)) return false;
    header = { ...header, file, slides:descriptors, cursor: header.cursor+1, length:header.cursor+1, base:Math.max(header.base || 0,header.cursor+1-(options.historyLimit || 100)), token:++revision, serial:revision };
    const invalidateAll = JSON.stringify({...beforeHeader.file,slides:undefined}) !== JSON.stringify({...header.file,slides:undefined});
    const entries = [['slide', targetSlide.id, clone(targetSlide)], ...extraRecords];
    for (const [key,value] of Object.entries(next.assets || {})) if (JSON.stringify(value) !== JSON.stringify(before.assets[key])) entries.push(['asset',key,value]);
    // A journal entry contains only changed records and lightweight metadata.
    const afterHeader = clone(header), journalId = String(header.cursor).padStart(12,'0');
    const beforeSlide = clone(before.slides[0]);
    const afterSlide = clone(targetSlide);
    const savedEntries = entries.map(entry => structuredClone(entry));
    for (const entry of savedEntries) pendingRecords.set(recordKey(entry[0],entry[1]),entry);
    enqueue(async () => {
      const recordsBefore = await Promise.all(savedEntries.filter(([kind]) => kind === 'slide').map(async ([kind,key]) => [kind,key,await db.read(workspace,kind,key)]));
      const journal = { beforeHeader, afterHeader, before:recordsBefore.map(([kind,key,value]) => [kind,key,key === beforeSlide.id ? beforeSlide : value]), after:savedEntries,
        focusBefore:beforeSlide.id, focusAfter:extraRecords.find(([kind,key,value])=>kind==='slide' && value && key!==beforeSlide.id)?.[1] || (afterHeader.slides.some(item=>item.id===afterSlide.id) ? afterSlide.id : afterHeader.slides[0].id) };
      await db.write(workspace, [...savedEntries, ['history',journalId,journal], ['header','document',afterHeader], ['thumbnail', targetSlide.id, undefined], ...(afterHeader.base ? [['history',String(afterHeader.base).padStart(12,'0'),undefined]] : [])], invalidateAll ? ['thumbnail'] : []);
      for (const entry of savedEntries) if (pendingRecords.get(recordKey(entry[0],entry[1])) === entry) pendingRecords.delete(recordKey(entry[0],entry[1]));
    });
    next.file = header.file;
    setView(next);
    publishHeader();
    emit({type:'change',slideId:targetSlide.id,allThumbnails:invalidateAll});
    return true;
  }
  async function moveHistory(direction) {
    if (disposed) return;
    ++selectionGeneration;
    loading.val = true;
    try {
      await tail;
      if (disposed) return;
      const cursor = header.cursor;
      if (direction < 0 ? cursor === (header.base || 0) : cursor === header.length) return;
      const index = direction < 0 ? cursor : cursor + 1;
      const journal = await db.read(workspace,'history',String(index).padStart(12,'0'));
      if (!journal) throw Error('Local undo history is unavailable.');
      const target = direction < 0 ? journal.beforeHeader : journal.afterHeader;
      const rows = direction < 0 ? journal.before : journal.after;
      const nextHeader = { ...target, cursor:cursor+direction, length:header.length, base:header.base, savedToken:header.savedToken, serial:header.serial };
      await enqueue(() => db.write(workspace,[...rows,['header','document',nextHeader],...rows.filter(([kind])=>kind==='slide').map(([,key])=>['thumbnail',key,undefined])]));
      header = nextHeader;
      setView(null);
      publishHeader();
      await selectSlide(direction < 0 ? journal.focusBefore : journal.focusAfter);
      emit({type:'history'});
    } finally { if (!disposed) loading.val = false; }
  }
  function historyOperation(direction) {
    const operation = historyTail.catch(()=>{}).then(()=>ready).then(()=>moveHistory(direction));
    historyTail = operation;
    operation.catch(report);
    return operation;
  }
  async function snapshot() {
    await ready;
    await historyTail.catch(()=>{});
    const snapshotHeader = clone(header);
    const overlay = new Map(pendingRecords);
    const prior = tail;
    const read = prior.catch(()=>{}).then(async () => {
      const readRecord = (kind,key) => record(kind,key,{pending:overlay,cache:false});
      const allSlides = []; for (const item of snapshotHeader.slides) allSlides.push(await readRecord('slide',item.id));
      const layouts = []; for (const item of snapshotHeader.layouts) layouts.push(await readRecord('layout',item.id));
      const masters = []; for (const item of snapshotHeader.masters) masters.push(await readRecord('master',item.id));
      const sourceAssets = []; if (source?.assetKeys) for (const key of await source.assetKeys()) sourceAssets.push([key,await readRecord('asset',key)]);
      const sourceThemes = []; if (source?.themeKeys) for (const key of await source.themeKeys()) sourceThemes.push([key,await readRecord('theme',key)]);
      const themes = new Map([...sourceThemes,...await db.list(workspace,'theme')]);
      const assets = new Map([...sourceAssets,...await db.list(workspace,'asset')]);
      for (const [kind,key,value] of overlay.values()) {
        const records = kind === 'theme' ? themes : kind === 'asset' ? assets : null;
        if (records) { if (value === undefined) records.delete(key); else records.set(key,value); }
      }
      return { token:snapshotHeader.token, document:{ ...await db.read(workspace,'root','document'), version:snapshotHeader.version, file:snapshotHeader.file, slides:allSlides, layouts, masters,
        themes:Object.fromEntries(themes), assets:Object.fromEntries(assets), tableStyles:snapshotHeader.tableStyles || [] } };
    });
    // A failed autosave remains failed, but explicit export can recover dirty records.
    tail = prior.then(()=>read).then(()=>undefined);
    tail.catch(()=>{});
    return read;
  }
  async function getDocument() { return (await snapshot()).document; }
  async function presentationInfo() {
    await tail;
    const slides = [];
    for (const item of header.slides) {
      const slide = await record('slide',item.id);
      slides.push({ ...item, timing:slide.timing, transition:slide.transition, show:slide.show });
    }
    const layouts = [];
    for (const [kind,items] of [['layout',header.layouts],['master',header.masters]]) for (const item of items) {
      const model = await record(kind,item.id);
      layouts.push({id:model.id,parentid:model.parentid,timing:model.timing});
    }
    return {slides,layouts};
  }
  return {
    workspace, view, slides, metadata, history, loading, error, ui, ready,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    async selectSlide(slideId) { await ready; await historyTail; return selectSlide(slideId); }, commit,
    async load(doc) { await ready; await historyTail.catch(()=>{}); return initialize(doc); },
    async flush() { await ready; await historyTail; await tail; },
    getDocument, snapshot, presentationInfo,
    async readView(slideId, settings) { await ready; await tail; return readView(slideId,settings); },
    async readThumbnail(slideId) { await ready; await tail; return db.read(workspace,'thumbnail',slideId); },
    async saveThumbnail(slideId, value, token) { if (!disposed && token === loadGeneration + ":" + header.token) await db.write(workspace,[['thumbnail',slideId,value]]); },
    get token() { return header?.token; },
    get cacheToken() { return loadGeneration + ":" + header?.token; },
    undo:() => historyOperation(-1), redo:() => historyOperation(1),
    async saved(token) { await tail; if (token === header.token) { header = {...header,savedToken:token}; publishHeader(); const savedHeader=clone(header); await enqueue(()=>db.write(workspace,[['header','document',savedHeader]])); } },
    async close() { disposed = true; ++selectionGeneration; ++loadGeneration; listeners.clear(); try { await ready; await historyTail; await tail; } finally { setView(null); pendingRecords.clear(); inflight.clear(); db?.close(); } },
  };
}
