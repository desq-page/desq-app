import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import vm from 'node:vm';

test('applying Capsule saves the entire deck without navigating through offscreen slides', async () => {
  const text = (id, paragraphs, attributes = {}) => ({
    id, y: 200, ...attributes, txBody: { p: paragraphs.map(t => ({ r: [{ t }] })) },
  });
  const heading = t => text('title', [t], { y: 40, ph: { $_type: 'title' } });
  const chart = { id: 'chart', type: 'chart', w: 500, h: 300,
    graphic: { graphicData: { 'c:chart': { chartJson: { values: [1, 2] } } } } };
  const photo = { id: 'photo', type: 'image', w: 500, h: 320,
    blipFill: { blip: { $_target: 'example.jpg' } } };
  const longCaption = 'Record the center of the tracing for comparison. '.repeat(16).trim();
  const shortCaption = 'Keep the original recording.';
  const conditions = heading('Conditions an EKG');
  conditions.txBody.p[0].r.push({ $_otag: 'br' }, { t: 'Can Help Diagnose' });
  const numberedText = [
    '6. \tInjury to heart muscle, such as myocardial \tinfarction (the medical term for heart attack)',
    '7. \tElectrolyte imbalances, which affect rate, \trhythm, and contractility of heart muscle',
  ];
  const purposes = text('purposes', [
    '2. To monitor vital signs (heart rate and heart rhythm)',
    'Heart rate is the number of heartbeats per minute.',
    'Heart rhythm is the pattern of the heartbeat and the intervals between beats. Rhythm is typically identified as regular or irregular.',
  ]);
  purposes.txBody.p.forEach((paragraph, index) => {
    paragraph.pPr = { $_lvl: index ? 1 : 0, $_marL: (index ? 78 : 36) * 9525,
      $_indent: -30 * 9525, buChar: { $_char: '•' } };
  });
  const pages = [
    [heading('Electrocardiography'), text('subtitle', ['Reading an EKG'])],
    [heading('Recording an EKG'), text('body', [
      '• Place the electrodes using the standard positions.',
      '• Check the recording for movement and signal quality.',
      '• Record the result and follow the local workflow.',
      '• Explain the next step to the patient.',
    ])],
    [heading('Signal quality'), chart],
    [text('long-caption', [longCaption]), text('short-caption', [shortCaption], { y: 470 }), photo],
    [conditions, text('conditions-body', numberedText), { ...photo, w: 400, h: 204 }],
    [heading('Purposes of EKG'), purposes],
    [text('locked', ['Keep the original layout'], { locked: true })],
  ].map((shapes, index) => ({ id: 'page-' + index, layoutid: 'original', shapes }));
  const store = new Map(pages.map(page => [page.id, page]));
  let current = structuredClone(pages[0]);
  let file = { id: 'deck', width: 960, height: 720,
    slides: pages.map(({ id, layoutid }) => ({ id, layoutid })),
    layouts: [{ id: 'original', parentid: 'master' }] };
  const saved = [], refreshed = [], selected = [];
  let activeDirty = false;
  let id = 0, installs = 0;
  const editor = {
    getFileInfo: () => file, getSlideInfo: () => current, getSlidesSlideId: () => current.id,
    getSlidesMasterView: () => false, getInfoUseGrid: () => 0,
    updateFile: patch => { file = { ...file, ...patch }; },
    updateSlide: page => { current = page; activeDirty = true; },
  };
  const mocks = {
    'shared-vuejs/editor': editor,
    'shared-vuejs/api/dbutils': {
      loadSlideFromDexie: (_, pageId) => structuredClone(store.get(pageId)),
      loadAllAssetsFromDexie: async () => ({}),
      saveDexie: async () => {
        if (activeDirty) {
          store.set(current.id, structuredClone(current));
          saved.push(current.id);
          activeDirty = false;
        }
      },
      saveThumb: async slideId => { refreshed.push(slideId); },
    },
    'shared-vuejs/api/slide': { pasteSlide: async (page, fileId, forLayout, options) => {
      assert.equal(options.append, true);
      const pageId = 'closing-' + ++id;
      store.set(pageId, structuredClone({ ...page, id: pageId }));
      file = { ...file, slides: [...file.slides, { id: pageId, layoutid: page.layoutid }] };
      saved.push(pageId);
      return pageId;
    }, selectSlide: async pageId => {
      selected.push(pageId);
      current = structuredClone(store.get(pageId));
    } },
    'shared-vuejs/api/updateText': { flushPendingTextSave: async () => {}, hideEditor() {} },
    'shared-vuejs/api/linked-slides': { linkedSlides: {
      fileId: 'deck', slides: new Map(), previous: () => false,
      save: page => {
        assert.notEqual(page.id, current.id);
        store.set(page.id, structuredClone(page));
        saved.push(page.id);
      },
      flush: async () => {},
    } },
    'shared-vuejs/api/installModelLayout': { installModelLayout: async (_, __, design) => {
      installs++;
      store.set('capsule', { ...design, id: 'capsule' });
      return { id: 'capsule', parentid: 'master', sharedHtmlLayout: true };
    } },
    'shared-vuejs/renderer': { getFullShape: shape => shape },
    'shared-vuejs/api/utility': { genId: () => 'generated-' + ++id },
  };
  const stubModule = (name, exports) => Object.keys(exports)
    .map(key => `export const ${key} = mocks[${JSON.stringify(name)}].${key};`).join('\n');
  const {outputFiles} = await build({
    entryPoints: ['editor-vuejs/src/lib/design/reformat-slides.ts'], bundle: true, write: false,
    format: 'iife', globalName: 'design', define: { 'import.meta.url': JSON.stringify('file:///fixture.js') },
    plugins: [{ name: 'test-editor', setup(builder) {
      builder.onResolve({ filter: /^shared-vuejs\// }, args => mocks[args.path]
        ? { path: args.path, namespace: 'test' } : undefined);
      builder.onResolve({ filter: /generated-fonts\.mjs$/ }, () => ({ path: 'fonts', namespace: 'test' }));
      builder.onLoad({ filter: /.*/, namespace: 'test' }, args => ({
        contents: args.path === 'fonts' ? 'export const generatedFontFamilies = () => []; export const loadGeneratedGoogleFonts = async () => [];'
          : stubModule(args.path, mocks[args.path]),
      }));
    } }],
  });
  const context = { mocks, URL, structuredClone,
    document: { createElement: () => ({ getContext: () => ({ measureText: text => ({ width: text.length * 8 }) }) }) },
    console: { warn() {}, info() {}, table() {} },
  };
  vm.runInNewContext(outputFiles[0].text, context);
  const result = await context.design.reformatSlides(() => {}, 'capsule');
  assert.deepEqual({ ...result }, { reformatted: 6, skipped: 1, added: 1 });
  assert.equal(installs, 1);
  assert.deepEqual(saved.slice(0, 6), pages.slice(0, 6).map(page => page.id));
  assert.equal(saved.length, 7);
  const closingId = file.slides.at(-1).id;
  assert.equal(store.get(closingId).agentMetadata.designIdeas.automaticClosing, true);
  assert.deepEqual(selected, [pages[0].id]);
  assert.deepEqual(refreshed, saved);
  assert.deepEqual(file.slides.map(page => page.layoutid), ['capsule', 'capsule', 'capsule', 'capsule', 'capsule', 'capsule', 'original', 'capsule']);
  assert.equal(current.id, pages[0].id);
  assert.deepEqual(store.get(pages[2].id).shapes.find(shape => shape.id === chart.id).graphic, chart.graphic);
  const reformattedPhoto = store.get(pages[3].id).shapes;
  const captions = reformattedPhoto.filter(shape => shape.txBody);
  assert.equal(captions.length, 1);
  assert.equal(captions[0].txBody.p.length, 2);
  assert.equal(captions[0].txBody.p[0].r[0].t, longCaption);
  assert.equal(captions[0].txBody.p[1].r[0].t, shortCaption);
  assert.deepEqual(reformattedPhoto.find(shape => shape.id === photo.id).blipFill, photo.blipFill);
  const multilineSlide = store.get(pages[4].id).shapes;
  assert.ok(multilineSlide.find(shape => shape.id === 'title').txBody.p[0].r.some(run => run.$_otag === 'br'));
  assert.equal(multilineSlide.find(shape => shape.id === 'title').h, 110);
  const numberedCards = multilineSlide.filter(shape => shape.reformatListNumber != null);
  assert.deepEqual(numberedCards.map(shape => shape.reformatListNumber), [6, 7]);
  assert.deepEqual(numberedCards.map(shape => shape.txBody.p[0].r[0].t),
    numberedText.map(line => line.replace(/^\d+\.\s+/, '')));
  assert.deepEqual(multilineSlide.find(shape => shape.id === photo.id).blipFill, photo.blipFill);
  const countBeforeReapply = file.slides.length;
  const reapplied = await context.design.reformatSlides(() => {}, 'capsule');
  assert.equal(reapplied.added, 0);
  assert.equal(file.slides.length, countBeforeReapply);
  assert.equal(file.slides.at(-1).id, closingId);
  assert.equal(current.id, pages[0].id);
  const people = await context.design.reformatSlides(() => {}, 'peoples-platform');
  assert.equal(people.added, 0);
  const statSlide = store.get(pages[5].id);
  assert.equal(statSlide.agentMetadata.designIdeas.layout, 'source/peoples-platform/5');
  const retainedStatistic = statSlide.shapes.filter(shape => shape.name === 'Design Ideas artwork: Statistic placeholder');
  assert.deepEqual(retainedStatistic.map(shape => shape.txBody.p[0].r[0].t), ['?', '%']);
  assert.equal(statSlide.shapes.find(shape => shape.id === purposes.id).txBody.p.length, 3);
});
