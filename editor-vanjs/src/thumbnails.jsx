import van from 'vanjs-core';
import { renderPlayerSlide } from './render.jsx';

// Keyed rows survive selection and edits. Only visible thumbnails hold artwork;
// the serialized cache lives in IndexedDB and is invalidated per edited slide.
export function createSlideList(store, ui, chooseSlide) {
  const list = <ol/>;
  const rows = new Map();
  let disposed = false, queue = Promise.resolve();
  const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
    for (const entry of entries) {
      const row = rows.get(entry.target.dataset.slideId);
      if (!row) continue;
      row.visible = entry.isIntersecting;
      if (row.visible) schedule(row);
      else { row.request++; row.image.replaceChildren(); }
    }
  }, { rootMargin:'160px' });
  function schedule(row) {
    const request = ++row.request;
    queue = queue.catch(() => {}).then(async () => {
      if (disposed || !row.visible || request !== row.request) return;
      const token = store.cacheToken;
      let html = await store.readThumbnail(row.id);
      if (html === undefined) {
        const doc = await store.readView(row.id, {objectURLs:false});
        if (disposed || !row.visible || request !== row.request) return;
        html = await renderPlayerSlide(doc, 1, {preview:true,idPrefix:`ve-thumb-${row.id}-`});
        await store.saveThumbnail(row.id, html, token);
      }
      if (disposed || !row.visible || request !== row.request) return;
      if (token !== store.cacheToken) { schedule(row); return; }
      row.image.innerHTML = html;
    }).catch(error => { if (!disposed && row.visible) row.image.textContent = 'Preview unavailable'; });
  }
  let dimensions = '';
  van.hydrate(list, () => {
    const items = store.slides.val;
    const file = store.metadata.val;
    if (!file) return list;
    const size = file.width + ':' + file.height;
    const resized = dimensions !== size;
    dimensions = size;
    const keep = new Set(items.map(item => item.id));
    for (const [id,row] of rows) if (!keep.has(id)) { observer?.unobserve(row.element); row.element.remove(); row.request++; rows.delete(id); }
    items.forEach((item,index) => {
      let row = rows.get(item.id);
      if (!row) {
        const image = <div class="ve-slide slide ve-shared-slide"/>;
        const frame = <span class="ve-thumb">{image}</span>;
        const label = <span/>;
        const button = <button type="button" aria-current={() => item.id === ui.slideId ? 'true' : 'false'} onclick={() => chooseSlide(item.id)}>{frame}{label}</button>;
        const element = <li data-slide-id={item.id}>{button}</li>;
        row = { id:item.id, element, image, frame, label, request:0, visible:!observer };
        rows.set(item.id,row);
        list.append(element);
        if (observer) observer.observe(element); else schedule(row);
      }
      row.label.textContent = `${index + 1}. ${item.name || item.title || 'Slide'}`;
      row.frame.style.height = `${112 * file.height / file.width}px`;
      Object.assign(row.image.style,{width:file.width+'px',height:file.height+'px',transform:`scale(${112/file.width})`,transformOrigin:'top left'});
      if (list.children[index] !== row.element) list.insertBefore(row.element,list.children[index] || null);
      if (resized && row.visible) schedule(row);
    });
    return list;
  });
  const unsubscribe = store.subscribe(event => {
    if (event.type === 'change' || event.type === 'history' || event.type === 'load') {
      const row = rows.get(event.slideId);
      if (row?.visible) schedule(row);
      if (event.type === 'history' || event.type === 'load' || event.allThumbnails) for (const row of rows.values()) if (row.visible) schedule(row);
    }
  });
  return { element:list, cleanup() { disposed=true; observer?.disconnect(); unsubscribe(); for (const row of rows.values()) row.request++; rows.clear(); } };
}
