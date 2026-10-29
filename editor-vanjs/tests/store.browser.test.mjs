import {runBrowserFixture} from '../../scripts/browser-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const chrome=process.env.CHROME_BIN || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/chromium','/usr/bin/google-chrome'].find(existsSync);
test('IndexedDB store loads individual slides, persists edits/history, rejects stale loads and keeps thumbnail rows', {skip:!chrome,timeout:60000}, async()=>{
 const dir=await mkdtemp(join(tmpdir(),'van-store-'));
 try{
 const html=`<!doctype html><html><head><meta charset="utf-8"><style>html,body{height:100%;margin:0}#host{height:600px}</style></head><body><div id="host"></div><script src="${new URL('../dist/editor.js',import.meta.url).href}"></script><script>
 (async()=>{
 const check=(ok,message)=>{if(!ok)throw Error(message)};
 const tick=()=>new Promise(r=>setTimeout(r,60));
 try{
  await SavannaVanEditor.ready();
  const doc=SavannaVanEditor.blankDocument();
  doc.customDocumentMetadata={preserve:true};
  const slide=doc.slides[0];slide.id='s0';slide.layoutid='layout';
  slide.shapes=[{id:'text0',type:'text',x:20,y:20,w:200,h:50,txBody:{bodyPr:{},p:[{r:[{t:'Page zero'}]}]}}];
  doc.slides=Array.from({length:40},(_,index)=>({...structuredClone(slide),id:'s'+index,name:'Page '+index,shapes:[{...structuredClone(slide.shapes[0]),id:'text'+index}]}));
  doc.file.slides=doc.slides.map(s=>({id:s.id,layoutid:s.layoutid,title:s.name,customMetadata:'preserve'}));
  doc.layouts=[{id:'layout',parentid:'master',shapes:[]}];doc.masters=[{id:'master',theme:'theme',shapes:[]}];doc.themes={theme:{clrScheme:{}}};
  doc.assets.picture='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j8ioAAAAASUVORK5CYII=';
  doc.slides[0].shapes.push({id:'picture',type:'image',x:300,y:10,w:100,h:100,blipFill:{blip:{$_target:'picture'}}});
  doc.assets.largeUnused='data:application/octet-stream;base64,'+'QQ=='.repeat(1024);
  const calls=[];let release;
  const header={version:1,file:doc.file,slides:doc.slides.map(({shapes,...rest})=>rest),layouts:[{id:'layout',parentid:'master'}],masters:[{id:'master',theme:'theme'}],tableStyles:[]};
  const source={getHeader:async()=>structuredClone(header),loadRecord:async(kind,id)=>{
    calls.push(kind+':'+id);
    if(id==='s1')await new Promise(r=>release=r);
    return structuredClone(kind==='theme'?doc.themes[id]:doc[{slide:'slides',layout:'layouts',master:'masters'}[kind]].find(s=>s.id===id));
   },loadAsset:async id=>{calls.push('asset:'+id);return doc.assets[id]},assetKeys:async()=>Object.keys(doc.assets),themeKeys:async()=>Object.keys(doc.themes)};
  const workspace=crypto.randomUUID();
  const store=SavannaVanEditor.createEditorStore({source,workspace});await store.ready;
  check(calls.filter(id=>id.startsWith('slide:')).join(',')==='slide:s0','initialization reads only the first slide');
  check(store.view.val.slides.length===1&&store.view.val.assets.largeUnused===undefined,'working view excludes inactive slides and unused media');
  check(!store.commit(structuredClone(store.view.val)),'unchanged working view creates no undo entry');
  const mediaURL=store.view.val.assets.picture;check(mediaURL.startsWith('blob:'),'active media uses a scoped object URL');
  const a=store.selectSlide('s1');
  while(!release)await tick();
  const b=store.selectSlide('s2');await b;release();await a;
  check(store.view.val.slides[0].id==='s2','late slide load cannot replace newest selection');
  let revoked=false;try{await fetch(mediaURL)}catch{revoked=true}check(revoked,'leaving a slide revokes its media URLs');
  const next=structuredClone(store.view.val);next.slides[0].shapes[0].x=300;store.commit(next);await store.flush();
  check(store.history.val.dirty&&store.history.val.canUndo,'edits persist with history');
  const savedToken=store.token;
  await store.saved(savedToken);check(!store.history.val.dirty,'save marker follows persisted revision');
  await store.selectSlide('s3');await store.selectSlide('s2');
  check(store.view.val.slides[0].shapes[0].x===300,'navigation reloads persisted edits');
  await store.close();
  const reopened=SavannaVanEditor.createEditorStore({source,workspace,resume:true});await reopened.ready;
  check(reopened.view.val.slides[0].id==='s2'&&reopened.view.val.slides[0].shapes[0].x===300,'reopen restores working copy and selected slide');
  await reopened.undo();check(reopened.view.val.slides[0].shapes[0].x===20,'undo reads journal from IndexedDB');
  check(reopened.history.val.dirty,'undo away from saved revision is dirty');
  await reopened.redo();check(!reopened.history.val.dirty,'redo to saved revision is clean');
  const full=await reopened.getDocument();check(full.file.slides[0].customMetadata==='preserve','unknown slide metadata survives storage');check(full.slides.length===40&&full.assets.largeUnused===doc.assets.largeUnused,'explicit export assembles inactive records and assets');
  await reopened.close();
  const bounded=SavannaVanEditor.createEditorStore({document:doc,historyLimit:2});await bounded.ready;
  for(const x of [40,60,80]){const next=structuredClone(bounded.view.val);next.slides[0].shapes[0].x=x;bounded.commit(next)}
  await bounded.flush();await Promise.all([bounded.undo(),bounded.undo(),bounded.undo()]);
  check(bounded.view.val.slides[0].shapes[0].x===40&&!bounded.history.val.canUndo,'history limit and rapid undo operations preserve ordering');
  await bounded.close();
  const failed=SavannaVanEditor.createEditorStore({document:doc});await failed.ready;
  const put=IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put=function(value,...rest){if(value.workspace===failed.workspace&&value.kind==='slide')throw new DOMException('Disk full','QuotaExceededError');return put.call(this,value,...rest)};
  const unsaved=structuredClone(failed.view.val);unsaved.slides[0].shapes[0].x=777;failed.commit(unsaved);
  let rejected=false;try{await failed.flush()}catch{rejected=true}finally{IDBObjectStore.prototype.put=put}
  check(rejected&&failed.error.val?.name==='QuotaExceededError','storage failure is surfaced');
  let blocked=false;try{await failed.selectSlide('s2')}catch{blocked=true}
  check(blocked&&failed.view.val.slides[0].id==='s0','failed save cannot evict the unsaved slide');
  const recovery=await failed.getDocument();check(recovery.slides[0].shapes[0].x===777,'export recovers pending records after storage failure');
  await failed.close().catch(()=>{});
  const host=document.getElementById('host');
  const api=SavannaVanEditor.mount(host,{document:doc});await api.ready;await tick();
  const row=host.querySelector('[data-slide-id="s0"]');
  const thumbnail= row.querySelector('.ve-thumb');
  let renders=0;const render=SavannaRenderer.renderSlide;SavannaRenderer.renderSlide=(...args)=>{renders++;return render(...args)};
  let previous=-1;for(let stable=0,tries=0;stable<3&&tries<30;tries++){await tick();if(previous===renders)stable++;else stable=0;previous=renders}
  const initialRenders=renders;
  await api.selectSlide('s2');await tick();
  check(renders===initialRenders,'selecting a slide does not render thumbnails again');
  SavannaRenderer.renderSlide=render;
  check(row===host.querySelector('[data-slide-id="s0"]')&&thumbnail===row.querySelector('.ve-thumb'),'selection keeps thumbnail row identity');
  check(host.querySelectorAll('#sld').length===1&&api.store.view.val.slides.length===1,'canvas holds one selected slide');
  check(host.querySelector('[data-slide-id="s2"] button').getAttribute('aria-current')==='true','selection styling observes store without rebuilding rows');
  const nodes=[...host.querySelectorAll('.ve-thumb .shp[id]')];check(!nodes.some(node=>/^text\\d+$/.test(node.id)),'thumbnail IDs cannot collide with editor IDs');
  await api.selectSlide('s0');await tick();
  const snapshots=await api.getDocument();check(snapshots.slides.length===40&&snapshots.customDocumentMetadata.preserve,'asynchronous public snapshot preserves deck and unknown metadata');
  api.destroy();
  const result=document.createElement('pre');result.id='result';result.textContent='PASS';document.body.append(result);
 }catch(e){const result=document.createElement('pre');result.id='result';result.textContent=e.stack;document.body.append(result);}
 })();</script></body></html>`;
 await writeFile(join(dir,'test.html'),html);
 const output=await runBrowserFixture(chrome,pathToFileURL(join(dir,'test.html')).href,join(dir,'profile'));
 assert.equal(output.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1],'PASS',output.slice(-2500));
 }finally{await rm(dir,{recursive:true,force:true});}
});
