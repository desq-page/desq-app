import { createEditorStore } from './store.mjs';
import { createSlideList } from './thumbnails.jsx';
import { createEditorCanvas } from 'shared-vuejs/canvas';
import sharedCanvasCSS from 'shared-vuejs/canvas.css';
import van from 'vanjs-core';
import { Button, Field, NumberField, ColorField, SelectField, Section, Toolbar, FileInput } from './components/native.jsx';
import { blankSlide, clone, createShape,
  color, colorValue, textStyle, textParagraphs, formatText, duplicateSlide, moveItem, moveEffect, effectGroups, removeShapes, id } from './model.mjs';
import { loadDocumentFonts, renderPlayerSlide, releaseDocumentFonts } from './render.jsx';
import { ensurePlayer, ensurePlayerStyles } from './renderer-loader.mjs';
import { fileDataURL, download, embedAssets, editableHTML } from './document.mjs';
import { editableZip } from './package.mjs';

export function mountEditor(host, options = {}) {
  if (!(host instanceof HTMLElement)) throw Error('mountEditor needs a host element.');
  const store = createEditorStore({ document: options.document, source: options.documentSource, workspace: options.workspace,
    resume: options.resume, onError: error => { if (!destroyed) { ui.status = `Local save failed: ${error.message}`; options.onError?.(error); } } });
  options = { ...options, document: undefined, documentSource: undefined };
  let destroyed = false, draggedEffect;
  const ui = store.ui;
  const getDoc = () => store.view.val;
  const getSlide = () => getDoc()?.slides[0];
  let presentationGeneration = 0;
  let editorFontSize;
  function exitPresentation() {
    presentationGeneration++;
    globalThis.SavannaPlayer?.stopPresentation?.();
    if (editorFontSize !== undefined) {
      document.documentElement.style.fontSize = editorFontSize;
      editorFontSize = undefined;
    }
    ui.presenting = false;
    root.focus();
  }
  async function present() {
    finishEditing();
    if (editorFontSize === undefined) editorFontSize = document.documentElement.style.fontSize;
    ui.presenting = true; root.focus();
    const generation = ++presentationGeneration;
    try {
      await store.flush();
      await Promise.all([ensurePlayer(), ensurePlayerStyles()]);
      if (!ui.presenting || generation !== presentationGeneration || destroyed) return;
      await new Promise(resolve => requestAnimationFrame(resolve));
      const viewport = document.getElementById('viewport');
      if (!viewport) throw Error('Presentation viewport was not mounted.');
      viewport.replaceChildren();
      const player = globalThis.SavannaPlayer;
      const slideList = [...store.slides.rawVal];
      // Read each presentation slide only when the player requests it.
      player.setEmbeddedSlides(async index => renderPlayerSlide(await store.readView(slideList[index - 1].id, {objectURLs:false}), 1));
      await player.initSlides({
        ...await store.presentationInfo(),
        width: getDoc().file.width, height: getDoc().file.height, grid: getDoc().file.grids, publish: getDoc().file.publish,
      });
    } catch (error) {
      if (!destroyed && generation === presentationGeneration) {
        exitPresentation();
        ui.status = `Unable to start presentation: ${error.message}`;
      }
    }
  }
  const selectedShapes = () => (getSlide()?.shapes || []).filter(s => ui.selection.includes(s.id));
  const selected = () => selectedShapes()[0];
  const message = value => { if (!destroyed) ui.status = value; };
  const safe = action => async (...args) => {
    if (ui.busy || destroyed) return;
    try { ui.busy = true; return await action(...args); }
    catch (error) { message(error.message); options.onError?.(error); }
    finally { ui.busy = false; }
  };
  function transact(change, label = 'Updated') {
    if (store.loading.rawVal || !getDoc()) return;
    finishEditing();
    const next = clone(getDoc());
    change(next, next.slides[0]);
    if (store.commit(next)) message(label);
  }
  function updateSelected(change, label) {
    transact((doc, slide) => slide.shapes.filter(s => ui.selection.includes(s.id) && !s.locked).forEach(s => change(s, doc)), label);
  }
  async function chooseSlide(slideId) {
    if (destroyed) return;
    finishEditing();
    try { await store.selectSlide(slideId); } catch (error) { message(error.message); }
  }
  function insert(type, source) {
    if (!getDoc() || store.loading.rawVal) return;
    const shape = createShape(type, { ...getDoc().file, source });
    transact((doc, slide) => slide.shapes.push(shape), `Added ${type}`); ui.selection = [shape.id];
  }
  function deleteSelected() {
    const ids = selectedShapes().filter(s => !s.locked).map(s => s.id);
    if (ids.length) transact((doc, slide) => removeShapes(slide, ids), 'Deleted shapes');
    ui.selection = [];
  }
  function duplicateSelected() {
    const copies = selectedShapes().map(s => { const copy = duplicateSlide({ id: id(), shapes: [s] }).shapes[0]; copy.x += 20; copy.y += 20; return copy; });
    if (copies.length) transact((doc, slide) => slide.shapes.push(...copies), 'Duplicated shapes');
    ui.selection = copies.map(s => s.id);
  }
  function reorderLayer(delta) {
    if (ui.selection.length !== 1) return;
    transact((doc, slide) => { const from = slide.shapes.findIndex(s => s.id === ui.selection[0]); moveItem(slide.shapes, from, from + delta); }, 'Reordered shape');
  }
  function align(axis, edge) {
    const shapes = selectedShapes().filter(s => !s.locked);
    if (!shapes.length) return;
    const isX = axis === 'x', extent = isX ? 'w' : 'h';
    const low = shapes.length > 1 ? Math.min(...shapes.map(s => s[axis])) : 0;
    const high = shapes.length > 1 ? Math.max(...shapes.map(s => s[axis] + s[extent])) : getDoc().file[isX ? 'width' : 'height'];
    updateSelected(s => { s[axis] = edge === 'start' ? low : edge === 'end' ? high - s[extent] : (low + high - s[extent]) / 2; }, 'Aligned shapes');
  }
  async function addSlide(copy = false) {
    if (!getDoc()) return;
    finishEditing();
    const slide = copy ? duplicateSlide(getSlide()) : blankSlide();
    const list = [...store.slides.rawVal];
    const index = list.findIndex(s => s.id === ui.slideId);
    list.splice(index + 1, 0, { id:slide.id, name:slide.name || slide.title || 'Slide', layoutid:slide.layoutid });
    store.commit(clone(getDoc()), [['slide',slide.id,slide]], list);
    await chooseSlide(slide.id);
  }
  async function deleteSlide() {
    const list = store.slides.rawVal;
    if (list.length < 2) return;
    finishEditing();
    const index = list.findIndex(s => s.id === ui.slideId);
    const next = list.filter(s => s.id !== ui.slideId);
    store.commit(clone(getDoc()), [['slide',ui.slideId,undefined]], next);
    await chooseSlide(next[Math.min(index,next.length - 1)].id);
  }
  function reorderSlide(delta) {
    const list = [...store.slides.rawVal];
    const index = list.findIndex(s => s.id === ui.slideId);
    moveItem(list,index,index+delta);
    store.commit(clone(getDoc()), [], list);
  }
  async function load(doc) { finishEditing(); ui.selection = []; releaseDocumentFonts(getDoc()?.file.id); await store.load(doc); message('Document opened'); }
  const save = safe(async zip => {
    finishEditing();
    // Snapshot before awaiting media fetches. A later edit must remain dirty.
    const { document:snapshot, token } = await store.snapshot();
    const runtime = await options.getRuntime?.();
    if (destroyed) return;
    const resources = await options.getRendererResources?.(snapshot);
    if (zip) {
      const archive = await editableZip(snapshot, runtime, await options.getStyles?.(), resources);
      if (destroyed) return;
      download(archive, `${snapshot.file.name || 'Presentation'}.zip`, 'application/zip');
    } else {
      const html = editableHTML(await embedAssets(snapshot), runtime, resources);
      if (destroyed) return;
      download(html, `${snapshot.file.name || 'Presentation'}.html`, 'text/html;charset=utf-8');
    }
    await store.saved(token);
    message('Download prepared');
  });
  const imageFiles = safe(async files => {
    const images = [];
    for (const file of files) {
      if (!/^image\/(png|jpeg|gif|webp|avif|bmp)$/.test(file.type)) throw Error('Use a PNG, JPEG, GIF, WebP, AVIF or BMP image.');
      const source = await fileDataURL(file);
      const image = new Image(); image.src = source; await image.decode();
      const shape = createShape('image', getDoc().file), assetId = `image-${shape.id}`;
      shape.name = file.name; shape.h = shape.w * image.naturalHeight / image.naturalWidth;
      shape.blipFill.blip.$_target = assetId; images.push({ shape, assetId, source });
    }
    if (destroyed) return;
    transact((doc, slide) => images.forEach(({ shape, assetId, source }) => { doc.assets[assetId] = source; slide.shapes.push(shape); }), 'Added images');
    ui.selection = images.map(i => i.shape.id);
  });
  function finishEditing() { sharedCanvas?.finish(); }
  async function undo() { finishEditing(); try { await store.undo(); message('Undo'); } catch (error) { message(error.message); } }
  async function redo() { finishEditing(); try { await store.redo(); message('Redo'); } catch (error) { message(error.message); } }
  const canvas = <div class="ve-canvas ve-edlib-canvas" inert={() => store.loading.val ? "" : undefined} tabindex="0" aria-label="Slide canvas"/>;
  let sharedCanvas;
  function selectShapes(ids) {
    ui.selection = ids;
    queueMicrotask(() => { if (!destroyed) { syncCanvas(); sharedCanvas?.select(ids); } });
  }
  function syncCanvas() {
    if (!sharedCanvas || destroyed || !getDoc()) return;
    const doc = getDoc(), slideId = ui.slideId;
    loadDocumentFonts(doc);
    sharedCanvas.load(doc, slideId, [...ui.selection]);
  }
  function refit() {
    sharedCanvas?.resize(ui.fit ? 'Fit' : `${ui.zoom}%`);
    if (!sharedCanvas) ui.scale = 1;
  }
  const resizeObserver = new ResizeObserver(refit);
  function keydown(e) {
    if (store.loading.rawVal) return;
    if (e.target.closest('input,textarea,select,[contenteditable="true"],dialog')) return;
    const mod = e.ctrlKey || e.metaKey, key = e.key.toLowerCase();
    if (ui.presenting) {
      if (key === 'escape') exitPresentation();
      else return;
    } else if (mod && key === 'z') e.shiftKey ? redo() : undo();
    else if (mod && key === 'y') redo();
    else if (mod && key === 's') save(true);
    else if (mod && key === 'd') duplicateSelected();
    else if (mod && key === 'a') selectShapes((getSlide()?.shapes || []).filter(s => !s.hidden).map(s => s.id));
    else if (key === 'delete' || key === 'backspace') deleteSelected();
    else if (key === 'escape') { sharedCanvas?.finish(); selectShapes([]); }
    else if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(key) && ui.selection.length) {
      const step = e.shiftKey ? 10 : 1;
      updateSelected(s => { if (key === 'arrowleft') s.x -= step; if (key === 'arrowright') s.x += step; if (key === 'arrowup') s.y -= step; if (key === 'arrowdown') s.y += step; }, 'Moved shapes');
    } else return;
    e.preventDefault();
  }
  function properties() {
    const doc = getDoc(), slide = getSlide(), shape = selected();
    if (!doc || !slide) return <p>Loading slide…</p>;
    if (!shape) return <div>
      <Section title="Presentation"><Field label="Title"><input value={doc.file.name || ''} onchange={e => transact(d => { d.file.name = e.target.value; })}/></Field>
        <NumberField label="Width" value={doc.file.width} min={1} max={16000} action={v => transact(d => { d.file.width = v; })}/>
        <NumberField label="Height" value={doc.file.height} min={1} max={16000} action={v => transact(d => { d.file.height = v; })}/>
      </Section>
      <Section title="Slide"><Field label="Name"><input value={slide.name || slide.title || ''} onchange={e => transact((d, s) => { s.name = e.target.value; })}/></Field>
        <ColorField label="Background" value={colorValue(slide.bg?.solidFill, '#ffffff')} action={v => transact((d, s) => { s.bg = { solidFill: color(v) }; })}/>
      </Section>
      <p class="ve-hint">Drag across the canvas to select shapes. Shift-click selects multiple shapes. Click text to place the caret and type.</p>
    </div>;
    const style = textStyle(shape);
    const patch = (key, value) => updateSelected(s => {
      if (key === 'w' || key === 'h') Object.assign(s, globalThis.SavannaRenderer.resizeShapeGeometry(s, key === 'w' ? value : s.w, key === 'h' ? value : s.h));
      else s[key] = value;
    });
    return <div><p>{ui.selection.length} selected</p>
      <Section title="Position and size"><Field label="Name"><input value={shape.name || ''} disabled={!!shape.locked} onchange={e => patch('name', e.target.value)}/></Field>
        <div class="ve-grid">{['x', 'y', 'w', 'h'].map(key => <NumberField label={key.toUpperCase()} value={Math.round((shape[key] || 0) * 100) / 100} min={['w', 'h'].includes(key) ? 1 : undefined}
          disabled={!!shape.locked} step={1} action={v => patch(key, v)}/>)}</div>
        <NumberField label="Rotation (°)" value={shape.rot || 0} disabled={!!shape.locked} action={v => patch('rot', v)}/>
        <Field label="Locked"><input type="checkbox" checked={!!shape.locked} onchange={e => transact((d, s) => s.shapes.filter(s => ui.selection.includes(s.id)).forEach(s => { s.locked = e.target.checked; }))}/></Field>
      </Section>
      {shape.blipFill ? <Section title="Picture"><Toolbar label="Picture editing">
        <Button label="Crop" disabled={!!shape.locked} action={() => sharedCanvas.crop()}/>
        <Button label="Finish crop" action={() => sharedCanvas.finish()}/>
      </Toolbar></Section> : null}
      <Section title="Appearance"><ColorField label="Fill" value={colorValue(shape.solidFill)} action={v => updateSelected(s => { s.solidFill = color(v); delete s.noFill; delete s.gradFill; })}/>
        <Field label="No fill"><input type="checkbox" checked={!!shape.noFill} onchange={e => patch('noFill', e.target.checked)}/></Field>
        <ColorField label="Outline" value={colorValue(shape.ln?.solidFill, '#172b4d')} action={v => updateSelected(s => { s.ln = { ...s.ln, noFill: false, solidFill: color(v) }; })}/>
        <NumberField label="Outline width" min={0} max={100} value={(shape.ln?.$_w || 0) / 9525} action={v => updateSelected(s => { s.ln = { ...s.ln, $_w: v * 9525, noFill: v === 0 }; })}/>
      </Section>
      {shape.txBody ? <Section title="Text"><p class="ve-hint">Text is directly editable on the slide.</p>
        <NumberField label="Font size (pt)" min={1} max={500} value={(style.$_sz || 1800) / 100} action={v => updateSelected(s => formatText(s, { $_sz: v * 100 }))}/>
        <Field label="Font"><input value={style.latin?.$_typeface || 'Arial'} onchange={e => updateSelected(s => formatText(s, { latin: { $_typeface: e.target.value } }))}/></Field>
        <Toolbar label="Font style">{[['Bold', '$_b'], ['Italic', '$_i']].map(([label, key]) => <Button label={label} pressed={!!+style[key]} action={() => updateSelected(s => formatText(s, { [key]: +!+style[key] }))}/>)}</Toolbar>
        <ColorField label="Text color" value={colorValue(style.solidFill, '#172b4d')} action={v => updateSelected(s => formatText(s, { solidFill: color(v) }))}/>
        <SelectField label="Alignment" value={textParagraphs(shape)[0]?.pPr?.$_algn || 'l'} options={[["l", "Left"], ["ctr", "Center"], ["r", "Right"], ["just", "Justify"]]}
          action={v => updateSelected(s => textParagraphs(s).forEach(p => { p.pPr = { ...p.pPr, $_algn: v }; }))}/>
      </Section> : null}
      <Section title="Arrange"><Toolbar label="Shape order"><Button label="Backward" icon="↓" action={() => reorderLayer(-1)}/><Button label="Forward" icon="↑" action={() => reorderLayer(1)}/></Toolbar>
        <Toolbar label="Alignment">{[['Left', 'x', 'start'], ['Center', 'x', 'center'], ['Right', 'x', 'end'], ['Top', 'y', 'start'], ['Middle', 'y', 'center'], ['Bottom', 'y', 'end']].map(([label, axis, edge]) => <Button label={label} action={() => align(axis, edge)}/>)}</Toolbar>
        <Toolbar label="Geometry editing"><Button label="Edit points" disabled={!!shape.locked || !!shape.blipFill || !!shape.children} action={() => sharedCanvas.editPoints()}/>
          <Button label="Group" disabled={ui.selection.length < 2} action={() => sharedCanvas.group()}/>
          <Button label="Ungroup" disabled={!shape.children} action={() => sharedCanvas.ungroup()}/></Toolbar>
        <Toolbar label="Shape actions"><Button label="Duplicate" action={duplicateSelected}/><Button label="Delete" action={deleteSelected}/></Toolbar>
      </Section>
    </div>;
  }
  function layers() {
    if (!getSlide()) return <p/>;
    return <Section title="Layers"><ol class="ve-layers">{[...getSlide().shapes].reverse().map(shape => <li>
      <button type="button" aria-pressed={ui.selection.includes(shape.id)} onclick={() => selectShapes([shape.id])}>{shape.locked ? '🔒 ' : ''}{shape.name || shape.type || 'Shape'}</button>
      <button type="button" title="Toggle visibility" aria-label={`Toggle visibility of ${shape.name || 'shape'}`}
        onclick={() => transact((d, s) => { const target = s.shapes.find(s => s.id === shape.id); target.hidden = !target.hidden; })}>{shape.hidden ? '○' : '●'}</button>
    </li>)}</ol></Section>;
  }
  function animations() {
    const slide = getSlide();
    if (!slide) return <p/>;
    const changeEffect = (group, index, change) => transact((doc, s) => change(effectGroups(s)[group], index), 'Updated animation');
    return <Section title="Animations" open={false}>
      <Toolbar label="Add animation"><Button label="Add fade" disabled={!ui.selection.length} action={() => transact((d, s) => {
        s.timing ||= {}; s.timing.m ||= [];
        for (const sh of ui.selection) s.timing.m.push({ sh, grp: 0, presetID: 10, tr: 1, du: .5, dl: 0, rp: 1, re: 1, rv: 0, rw: 0,
          bh: [{ ty: 'filter', dl: 0, du: .5, rv: 0, fty: 'fade', sty: 0 }] });
      }, 'Added fade animation')}/></Toolbar>
      {effectGroups(slide).map((effects, group) => <div><h4>{group === 0 ? 'Main sequence' : `Trigger: ${effects[0]?.trs || group}`}</h4>
        <ol class="ve-effects">{effects.map((effect, index) => <li draggable="true" data-effect-index={index} data-effect-group={group}
          ondragstart={e => { draggedEffect = { group, index }; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', `${group}:${index}`); }}
          ondragover={e => { if (draggedEffect?.group === group) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; e.currentTarget.classList.add('ve-drop'); } }}
          ondragleave={e => e.currentTarget.classList.remove('ve-drop')}
          ondragend={() => { draggedEffect = undefined; root.querySelectorAll('.ve-drop').forEach(e => e.classList.remove('ve-drop')); }}
          ondrop={e => { e.preventDefault(); e.currentTarget.classList.remove('ve-drop'); const source = draggedEffect; draggedEffect = undefined;
            if (source?.group === group) transact((d, s) => { moveEffect(s, group, source.index, index); }, 'Reordered animation'); }}>
          <span>{slide.shapes.find(s => s.id === effect.sh)?.name || effect.sh} · {effect.presetID === 10 ? 'Fade' : `Effect ${effect.presetID ?? ''}`}</span>
          <SelectField label="Start" value={String(effect.tr || 1)} options={[["1", "On click"], ["2", "With previous"], ["3", "After previous"]]}
            action={v => changeEffect(group, index, (list, i) => { list[i].tr = +v; })}/>
          <NumberField label="Duration (s)" value={effect.du ?? .5} min={0} max={3600} step={.1} action={v => changeEffect(group, index, (list, i) => {
            list[i].du = v; (list[i].bh || []).forEach(b => { b.du = v; }); })}/>
          <NumberField label="Delay (s)" value={effect.dl || 0} min={0} max={3600} step={.1} action={v => changeEffect(group, index, (list, i) => { list[i].dl = v; })}/>
          <Toolbar label="Reorder animation"><Button label="Move up" icon="↑" disabled={index === 0} action={() => transact((d, s) => moveEffect(s, group, index, index - 1))}/>
            <Button label="Move down" icon="↓" disabled={index === effects.length - 1} action={() => transact((d, s) => moveEffect(s, group, index, index + 1))}/>
            <Button label="Remove effect" icon="×" action={() => changeEffect(group, index, (list, i) => list.splice(i, 1))}/></Toolbar>
        </li>)}</ol>
      </div>)}
    </Section>;
  }
  const slideList = createSlideList(store, ui, chooseSlide);
  const root = <div class="ve-editor" tabindex="-1" onkeydown={keydown}>
    <header><strong>Savanna · VanJS</strong><Toolbar label="File">
      <Button label="Save editable ZIP" icon="↓" disabled={() => ui.busy} action={() => save(true)}/>
      <Button label="Single Editable HTML" disabled={() => ui.busy} action={() => save(false)}/>
      <Button label="Undo" icon="↶" disabled={() => !ui.canUndo} action={undo}/><Button label="Redo" icon="↷" disabled={() => !ui.canRedo} action={redo}/>
      <Button label="Present" icon="▶" action={present}/>
    </Toolbar></header>
    <nav class="ve-insert" aria-label="Insert"><Toolbar label="Insert shapes">
      {[["text", "T"], ["rectangle", "▭"], ["ellipse", "◯"], ["triangle", "△"], ["line", "╱"]].map(([type, icon]) => <Button label={type[0].toUpperCase() + type.slice(1)} icon={icon} action={() => insert(type)}/>)}
      <FileInput label="Images" accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/bmp" multiple action={imageFiles}/>
      <SelectField label="Draw on canvas" value="" options={[["", "Choose tool…"], ["rect", "Rectangle"], ["ellipse", "Ellipse"], ["line", "Line"], ["arrow", "Arrow"], ["path", "Freehand"], ["polygon", "Polygon"]]}
        action={type => { if (type) sharedCanvas.draw(type); }}/>
      <Button label="Guides" pressed={() => ui.showGuides} action={() => { ui.showGuides = !ui.showGuides; sharedCanvas.guides(ui.showGuides); }}/>
      <Button label="Delete selection" icon="×" disabled={() => !ui.selection.length} action={deleteSelected}/>
    </Toolbar></nav>
    <div class="ve-workspace"><aside class="ve-slides" aria-label="Slides">
      <Toolbar label="Slide actions"><Button label="Add slide" icon="+" action={() => addSlide()}/><Button label="Duplicate slide" action={() => addSlide(true)}/></Toolbar>
      {slideList.element}
      <Toolbar label="Reorder slides"><Button label="Slide up" icon="↑" action={() => reorderSlide(-1)}/>
        <Button label="Slide down" icon="↓" action={() => reorderSlide(1)}/>
        <Button label="Delete slide" disabled={() => store.slides.val.length < 2} action={deleteSlide}/></Toolbar>
    </aside>{canvas}<aside class="ve-inspector" aria-label="Properties" inert={() => store.loading.val ? "" : undefined}>{properties}{layers}{animations}</aside></div>
    <footer><span role="status" aria-live="polite">{() => ui.status}</span><span>{() => ui.dirty ? 'Unsaved edits' : 'Saved'}</span>
      <label>Zoom <input type="range" min="25" max="200" step="5" value={() => ui.fit ? Math.round(ui.scale * 100) : ui.zoom}
        oninput={e => { ui.fit = false; ui.zoom = +e.target.value; refit(); }}/></label><output>{() => `${Math.round(ui.scale * 100)}%`}</output>
      <Button label="Fit" action={() => { ui.fit = true; refit(); }}/>
    </footer>
    {() => ui.presenting ? <div class="ve-presentation" role="dialog" aria-label="Presentation" aria-modal="true">
      <Button label="Exit presentation" action={exitPresentation}/>
      <div id="container" data-name="player" class="container ve-player-container">
        <div id="mainframe" class="mainframe"><div id="viewport" class="viewport"></div></div>
      </div><p>← / → to navigate · Esc to exit</p>
    </div> : ''}
  </div>;
  host.append(root);
  const canvasStyle = document.createElement('style');
  canvasStyle.textContent = sharedCanvasCSS.replace(/(-?(?:\d*\.?\d+))rem\b/g, '$1px');
  root.append(canvasStyle);
  sharedCanvas = createEditorCanvas(canvas, {
    onUndo: undo, onRedo: redo, onSelectSlide: chooseSlide,
    onScale(scale) { ui.scale = scale; },
    onSelection(ids) { if (!sharedCanvas?.isCurrent(getDoc(), ui.slideId)) return; if (JSON.stringify(ids) !== JSON.stringify([...ui.selection])) ui.selection = ids; },
    onChange(slide) {
      if (destroyed || !getDoc() || slide.id !== getSlide().id) return;
      const next = { ...getDoc(), slides:[slide] };
      if (store.commit(next)) sharedCanvas.acknowledge(next);
    },
  });
  const unsubscribe = store.subscribe(event => {
    if (destroyed) return;
    if (event.type === 'change') options.onChange?.({ workspace:store.workspace, slideId:event.slideId, revision:store.token });
  });
  van.hydrate(root, () => {
    getDoc();
    queueMicrotask(() => { syncCanvas(); refit(); });
    return root;
  });
  const ready = store.ready.then(() => { if (!destroyed) { syncCanvas(); refit(); } });
  ready.catch(error => message(error.message));
  resizeObserver.observe(canvas);
  refit();
  const beforeUnload = e => { finishEditing(); if (ui.dirty) { e.preventDefault(); e.returnValue = ''; } };
  window.addEventListener('beforeunload', beforeUnload);
  root.focus();
  return {
    ready, store, workspace:store.workspace,
    selectSlide:chooseSlide,
    flush:() => { finishEditing(); return store.flush(); },
    getDocument:async () => { finishEditing(); return store.getDocument(); },
    load, undo, redo, saveZIP: () => save(true), saveHTML: () => save(false), saveSingleEditableHTML: () => save(false),
    get dirty() { return ui.dirty; },
    destroy() {
      if (ui.presenting || editorFontSize !== undefined) exitPresentation();
      destroyed = true; resizeObserver.disconnect();
      releaseDocumentFonts(getDoc()?.file.id);
      window.removeEventListener('beforeunload', beforeUnload);
      sharedCanvas?.destroy();
      unsubscribe(); slideList.cleanup();
      void store.close().catch(error => options.onError?.(error));
      root.remove();
    },
  };
}
