import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const result = await build({
  entryPoints: ['editor-vuejs/src/lib/main/exportEditableHtml.ts'],
  bundle: true, platform: 'node', format: 'esm', write: false,
  define: {'import.meta.env.BASE_URL': '"/"'},
  plugins: [{name:'export-boundaries',setup(builder) {
    builder.onResolve({filter:/.*/}, args => args.kind === 'entry-point' ? undefined : {path:args.path,namespace:'mock'});
    builder.onLoad({filter:/.*/,namespace:'mock'}, () => ({contents:`
      export const getFileInfo = () => ({id:'deck',name:'Deck.pptx'});
      export const saveDexie = async () => {globalThis.htmlExportFixture.events.push('save');};
      export const flushPendingTextSave = async () => {globalThis.htmlExportFixture.events.push('flush');};
      export const prepareExportFile = async () => ({id:'deck',name:'Deck.pptx'});
      export const prepareEditableDocument = async () => ({file:{id:'deck',name:'Deck.pptx'},slides:[],layouts:[],masters:[],assets:{}});
      export const createSinglePresentationHtml = async () => new Blob(['viewer'], {type:'text/html'});
      export const exportFile = async () => {globalThis.htmlExportFixture.events.push('render');};
      export const getMediaRecordsFromOPFS = async () => [];
      export const getMediaRecordFromOPFS = async () => ({});
      export const getFontRecordsFromOPFS = async () => [];
      export const downloadFile = (...args) => {globalThis.htmlExportFixture.download=args;globalThis.htmlExportFixture.events.push('download');return true;};
      export const showProgress = () => {};
      export default {};
      export const fileDataURL = async () => '';
      export const editableHTML = () => '<html>editor</html>';
      export const presentationHTML = () => '<html>viewer</html>';
      export const addVanChartPreviews = async () => {};
      export const editableZip = async () => new Blob(['editor zip']);
      export const packageFile = async () => {globalThis.htmlExportFixture.events.push('package');return new Blob(['viewer zip']);};
      export const normalizeDocument = doc => ({file:doc,slides:[],layouts:[],masters:[],assets:{}});
      export const mediaMime = () => '';
    `}));
  }}],
});
const exporters = await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));

for (const fn of ['exportEditableHtml','exportSingleEditableHtml','exportSinglePageHtml','exportPresentationZip']) {
  test(`${fn} writes to the destination selected before packaging`, async () => {
    const previousFetch = globalThis.fetch;
    globalThis.fetch = async () => ({ok:true,text:async () => 'SavannaVanEditor __savannaAssetPool',arrayBuffer:async () => new ArrayBuffer(0)});
    globalThis.htmlExportFixture = {events:[]};
    const handle = {name:'Chosen file'}, name = fn.includes('Zip') || fn === 'exportEditableHtml' ? 'Chosen.zip' : 'Chosen.html';
    try {
      assert.equal(await exporters[fn](handle,name),true);
      const [blob,savedName,showPicker,onSaved,destination] = globalThis.htmlExportFixture.download;
      assert.ok(blob instanceof Blob);
      assert.equal(savedName,name);
      assert.equal(destination,handle);
      assert.equal(showPicker,false,'must not reopen the picker after packaging');
      assert.equal(onSaved,undefined);
      assert.deepEqual(globalThis.htmlExportFixture.events.slice(0,2),['flush','save']);
      if(fn === 'exportPresentationZip') assert.deepEqual(globalThis.htmlExportFixture.events,['flush','save','render','package','download']);
    } finally {globalThis.fetch=previousFetch;delete globalThis.htmlExportFixture;}
  });
}
