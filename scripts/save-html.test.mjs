import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const result = await build({ entryPoints:['editor-vuejs/src/lib/main/saveHtml.ts'],bundle:true,platform:'node',format:'esm',write:false,
  plugins:[{name:'export-boundaries',setup(builder){
    builder.onResolve({filter:/^(shared-vuejs\/(editor|api\/(downloadShape|dbutils|updateText))|\.\/exportEditableHtml)$/},args=>({path:args.path,namespace:'mock'}));
    builder.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:`
      export const getFileInfo=()=>globalThis.fixture.file;
      export const getDocumentRevision=()=>globalThis.fixture.revision;
      export const markFileSaved=async id=>globalThis.fixture.marked.push(id);
      export const selectDownloadFile=name=>globalThis.fixture.picker(name);
      export const downloadFile=(...args)=>globalThis.fixture.download(...args);
      export const flushPendingTextSave=async()=>{};
      export const flushPendingDexieSaves=async()=>{};
      export const prepareHtmlExport=(...args)=>globalThis.fixture.prepare(...args);
    `}));
  }}]});
const {prepareHtml,savePreparedHtml,selectHtmlDestination,isHtmlSaveCurrent}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
function fixture() { const value={file:{id:'deck',name:'Deck.pptx'},revision:1,marked:[],picker:()=>({}),download:async()=>true,prepare:async()=>new Blob(['html'])};globalThis.fixture=value;return value; }
for(const [format,editable,filename] of [['single',false,'Deck.html'],['single',true,'Deck.editable.html'],['zip',false,'Deck.zip'],['zip',true,'Deck.editable.zip']]) {
  test(`${filename}: prepares before opening the picker and clears dirty after saving`,async()=>{
    const f=fixture(),calls=[];f.prepare=async(...args)=>{calls.push(['prepare',...args]);return new Blob(['contents'])};
    const prepared=await prepareHtml(format,editable);f.picker=name=>{calls.push(['picker',name]);return {name}};
    f.download=async(blob,name,show,callback,destination)=>{calls.push(['download',name,destination.name,await blob.text()]);return true};
    const pending=savePreparedHtml(prepared);assert.deepEqual(calls.slice(0,2),[['prepare',format,editable],['picker',filename]]);
    assert.equal(await pending,true);assert.deepEqual(f.marked,['deck']);assert.equal(calls[2][3],'contents');
  });
}
test('cancelled picker leaves dirty state unchanged',async()=>{const f=fixture();const prepared=await prepareHtml('single',false);f.picker=()=>null;f.download=()=>assert.fail('no download');assert.equal(await savePreparedHtml(prepared),false);assert.deepEqual(f.marked,[])});
test('changes during preparation discard the stale output',async()=>{const f=fixture();f.prepare=async()=>{f.revision++;return new Blob(['old'])};await assert.rejects(prepareHtml('single',false),/changed while preparing/)});
test('changes after preparation prevent saving stale output',async()=>{const f=fixture();const prepared=await prepareHtml('single',false);f.revision++;assert.equal(isHtmlSaveCurrent(prepared.snapshot),false);await assert.rejects(savePreparedHtml(prepared),/changed/);assert.deepEqual(f.marked,[])});
test('changes while the file is being written do not clear the dirty flag',async()=>{const f=fixture();const prepared=await prepareHtml('single',false);f.download=async()=>{f.revision++;return true};assert.equal(await savePreparedHtml(prepared),true);assert.deepEqual(f.marked,[])});
test('a failed download preserves dirty state',async()=>{const f=fixture();const prepared=await prepareHtml('zip',true);f.download=async()=>{throw Error('Write failed')};await assert.rejects(savePreparedHtml(prepared),/Write failed/);assert.deepEqual(f.marked,[])});
test('the picker can open while HTML preparation is still running',async()=>{
  const f=fixture(),calls=[];let finish;
  f.prepare=()=>new Promise(resolve=>{finish=resolve;calls.push('preparing')});
  f.picker=name=>{calls.push(`picker:${name}`);return {name}};
  f.download=async()=>{calls.push('download');return true};
  const pending=prepareHtml('zip',true);
  while (!finish) await Promise.resolve();
  const selection=selectHtmlDestination('zip',true);
  assert.deepEqual(calls,['preparing','picker:Deck.editable.zip']);
  finish(new Blob(['contents']));
  assert.equal(await savePreparedHtml(await pending,selection),true);
  assert.deepEqual(calls,['preparing','picker:Deck.editable.zip','download']);
});
