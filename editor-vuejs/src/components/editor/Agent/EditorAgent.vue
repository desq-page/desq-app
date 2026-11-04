<template>
  <NModal v-model:show="open" preset="card" :title="mode === 'new' ? '✨ Create a presentation with external AI' : '✨ Insert slides with external AI'"
    :mask-closable="!busy" :close-on-esc="!busy" :closable="!busy"
    :style="{ width: '900px', maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100dvh - 40px)' }">
  <div class="editor-agent" @pointerdown.stop="rememberCursor" @pointerup.stop @contextmenu.stop>
    <section id="agent-taskpane" class="agent-panel" aria-label="AI presentation response">
      <section class="external-brief">
        <p>Copy the prompt into your AI chat, then paste its response or upload the HTML or JSON file here.</p>
        <fieldset class="layout-options" :disabled="busy">
          <legend>Choose layout</legend>
          <label class="layout-option">
            <input v-model="externalLayoutStyle" type="radio" name="external-layout" value="frontend-slides" />
            <span><strong>Frontend Slides</strong><small>Use Frontend Slides design guidance for editable HTML slides.</small></span>
          </label>
          <label class="layout-option">
            <input v-model="externalLayoutStyle" type="radio" name="external-layout" value="templates" />
            <span><strong>Desq templates</strong><small>Use Desq’s editable slide templates.</small></span>
          </label>

        </fieldset>
        <div class="prompt-heading">
          <label for="external-prompt">Prompt to copy to external  AI chat</label>
          <button class="copy-button" type="button" aria-label="Copy prompt" title="Copy prompt" @click="copyPrompt"><DocumentCopy24Regular aria-hidden="true" /></button>
        </div>
        <textarea id="external-prompt" readonly :rows="externalLayoutStyle === 'templates' ? 3 : 3" :value="externalFullPrompt" @keydown.stop @keyup.stop />
        <label for="external-brief-json">Response (JSON or HTML)</label>
        <textarea id="external-brief-json" v-model="externalBriefText" rows="4" :disabled="busy" placeholder="Paste the JSON or full HTML response here" @keydown.stop @keyup.stop @keypress.stop @paste.stop />
        <label>Or open a response file <input type="file" accept=".html,.htm,.json,text/html,application/json" :disabled="busy" @click="clearSelectedResponseFile" @change="loadExternalHtml" /></label>
        <p v-if="selectedResponseFile" class="selected-response-file" role="status">Loaded: {{ selectedResponseFile }}</p>
        <p v-if="externalBriefError" role="alert">{{ externalBriefError }}</p>
        <!-- <div v-if="externalBriefResult.repaired">
          <p role="status">The JSON was repaired automatically. Review the repaired content carefully before creating slides; repair can change or omit content.</p>
          <details><summary>Review repaired JSON</summary>
            <textarea readonly rows="8" :value="externalBriefResult.repairedJson" aria-label="Repaired JSON" @keydown.stop @keyup.stop />
          </details>
        </div>
        <div v-if="externalBriefDeck">
          <strong>{{ externalBriefDeck.title }} · {{ externalBriefDeck.slides.length }} slides</strong>
          <ol><li v-for="(slide, index) in externalBriefDeck.slides" :key="index">{{ slide.title }} · {{ slide.layout }}</li></ol>
          <p>Review the slide list and source before creating slides.</p>
        </div> -->
        <button class="primary-button create-button" type="button" :disabled="busy || !externalBriefDeck" @click="createExternalBrief">{{ busy ? (mode === 'new' ? 'Creating presentation…' : 'Inserting slides…') : (mode === 'new' ? 'Create new presentation' : 'Insert slides into this presentation') }}</button>
      </section>
      <section v-if="mode === 'insert' && currentTemplateUsage" class="agent-template-usage" aria-label="Current slide design">
        <strong>Current slide design</strong>
        <p v-if="currentNativeTemplate" class="model-note">Native template · master and layout linked</p>
        <p>{{ currentTemplateUsage.family }} · {{ currentTemplateUsage.layout }}</p>
        <p v-for="note in currentTemplateUsage.notes" :key="note" class="model-note">{{ note }}</p>
      </section>
      <p role="status" class="agent-result">{{ status }}</p>
    </section>
  </div>
  </NModal>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue';
import { NModal } from 'naive-ui';
import { DocumentCopy24Regular } from '@vicons/fluent';
import { piniaInfo, piniaSlides } from '@/lib/common/store';
import { useRoute } from 'vue-router';
import { getFileInfo, getSlideInfo, getSlidesSlideId } from 'shared-vuejs/editor';
import { editorAdapter } from '@/lib/agent/editor-adapter';
import { createEditorTools } from '@/lib/agent/editor-tools.mjs';
import { installEditorAgent, parseAgentOrigins } from '@/lib/agent/webmcp.mjs';
import { templateUsage } from '@/lib/agent/template-report.mjs';
import { parseExternalBriefResult } from '@/lib/agent/external-brief.mjs';
import { renderScriptedFrontendSlides } from '@/lib/agent/scripted-html-render.mjs';
import { loadGeneratedGoogleFonts, renderedHtmlFontFamilies } from '@/lib/agent/generated-fonts.mjs';
import { createExternalResponseFile, isHtmlResponse } from '@/lib/agent/external-response.mjs';
import { prepareEmbeddedHtmlImages, embeddedHtmlAssets } from '@/lib/agent/html-embedded-images.mjs';
import { parseFrontendSlides } from '@/lib/agent/frontend-slides-import.mjs';
import { preflightDeckPlan } from '@/lib/agent/deck-preflight.mjs';
import externalPrompt from '@/lib/agent/external-brief/instructions-v1.md?raw';
import externalSchema from '@/lib/agent/external-brief/schema-v1.json?raw';

const { mode } = defineProps<{ mode: 'new' | 'insert' }>();
const emit = defineEmits<{ created: [fileId: string] }>();
const route = useRoute();
const open = computed({ get: () => piniaInfo().openEditorAgentModal, set: value => { if (!busy.value) piniaInfo().openEditorAgentModal = value; } });
const rememberCursor = () => { if (mode === 'insert') editorAdapter.rememberTextCursor(); };
const busy = ref(false), status = ref(''), externalBriefText = ref(''), selectedResponseFile = ref('');
const externalLayoutStyle = ref<'templates' | 'frontend-slides'>('frontend-slides');
const nativeBriefSchema = JSON.parse(externalSchema);
const nativeSlideProperties = nativeBriefSchema.properties.slides.items.properties;
nativeSlideProperties.layout.enum = nativeSlideProperties.layout.enum.filter((layout: string) => layout !== 'svg' && layout !== 'html');
delete nativeSlideProperties.svg;
delete nativeSlideProperties.html;
const nativeBriefSchemaText = JSON.stringify(nativeBriefSchema, null, 2);
const externalInstructions = `${externalPrompt}\n${nativeBriefSchemaText}\n\nLayout preference: Use the Desq native layouts; do not use SVG or HTML layouts.\n\nMy request: `;
const externalFullPrompt = computed(() => externalLayoutStyle.value === 'frontend-slides'
  ? 'Generate a presentation using skill https://github.com/zarazhangrui/frontend-slides. Use animations, SVG, morph if necessary. Avoid canvas. Output downloadable HTML. Presentation topic: '
  : externalInstructions);
const externalBriefResult = computed(() => {
  if (!externalBriefText.value.trim()) return { deck: null, repaired: false, repairedJson: undefined, error: '' };
  try { return { ...parseExternalBriefResult(externalBriefText.value), error: '' }; }
  catch (error) { return { deck: null, repaired: false, repairedJson: undefined, error: error instanceof Error ? error.message : String(error) }; }
});
const externalBriefDeck = computed(() => externalBriefResult.value.deck);
const externalBriefError = computed(() => externalBriefResult.value.error);
let active = true, installation: any, generation = 0;
let executionController: AbortController | undefined;
const registry = createEditorTools(editorAdapter, () => active && mode === 'insert' &&
  getFileInfo()?.id === route.params.id && !!getSlidesSlideId() && getSlideInfo()?.id === getSlidesSlideId());
const currentSlideDesign = computed(() => ({ slideId: piniaSlides().slideId, revision: piniaSlides().sldState, metadata: (getSlideInfo() as any)?.agentMetadata }));
const currentNativeTemplate = computed(() => currentSlideDesign.value.metadata?.engine === 'pptx-template-native');
const currentTemplateUsage = computed(() => templateUsage(currentSlideDesign.value.metadata?.templateSelection));

async function loadExternalHtml(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (file.size > 50000000) { status.value = 'Response files must be under 50 MB.'; selectedResponseFile.value = ''; input.value = ''; return; }
  try {
    externalBriefText.value = await file.text();
    selectedResponseFile.value = file.name;
    status.value = '';
  } catch (error) {
    selectedResponseFile.value = '';
    status.value = error instanceof Error ? `Could not read ${file.name}: ${error.message}` : `Could not read ${file.name}.`;
  }
  // Reset after reading so choosing the same file again still fires change.
  input.value = '';
}

function clearSelectedResponseFile(event: MouseEvent) {
  (event.currentTarget as HTMLInputElement).value = '';
}

async function copyPrompt() {
  try {
    await navigator.clipboard.writeText(externalFullPrompt.value);
    status.value = externalLayoutStyle.value === 'frontend-slides' ? 'Prompt copied. Add your presentation title in the external chat.' : 'Prompt copied. Add your request in the external chat.';
  } catch { status.value = 'Could not copy automatically. Select and copy the prompt above.'; }
}

onMounted(async () => {
  if (mode !== 'insert') return;
  document.addEventListener('selectionchange', editorAdapter.rememberTextCursor);
  try {
    const origins = parseAgentOrigins(import.meta.env.VITE_EDITOR_AGENT_ORIGINS);
    installation = await installEditorAgent(registry, { window, document, navigator, origins });
    if (!active) { installation.dispose(); return; }
    if (installation.nativeError) console.warn('WebMCP registration unavailable:', installation.nativeError);
  } catch (error) { console.warn('Editor agent registration unavailable:', error); }
});

async function createExternalBrief() {
  const deck = externalBriefDeck.value;
  if (!deck || busy.value) return;
  const fileId = getFileInfo()?.id, pageId = getSlidesSlideId();
  if (mode === 'insert' && (!fileId || !pageId)) { status.value = 'Open a presentation and select a slide first.'; return; }
  const run = ++generation;
  executionController = new AbortController();
  const signal = executionController.signal;
  busy.value = true;
  try {
    if (mode === 'new') {
      const id = await createExternalResponseFile(externalBriefText.value, deck, {signal,onProgress: (message: string) => { if (active && generation === run) status.value = message; }});
      signal.throwIfAborted();
      piniaInfo().openEditorAgentModal = false;
      emit('created', id);
      return;
    }
    status.value = 'Checking the slide content and layouts…';
    const documentResult = await registry.executeTool('desq_get_document');
    if (!documentResult.ok) throw Error(documentResult.error);
    const isHtmlDocument = isHtmlResponse(externalBriefText.value);
    let preparedAssets = new Map(), preparedLayoutAssets = new Map();
    let renderedDeck = deck;
    const importFontWarnings: string[] = [];
    if (isHtmlDocument) {
      status.value = 'Rendering the HTML…';
      const embedded = await prepareEmbeddedHtmlImages(externalBriefText.value, {prefix:'agent-image-' + crypto.randomUUID()});
      renderedDeck = await renderScriptedFrontendSlides(embedded.source, parseFrontendSlides(embedded.source), { signal });
      preparedAssets = embeddedHtmlAssets(renderedDeck, embedded.images);
      preparedLayoutAssets = embeddedHtmlAssets({slides:renderedDeck.sharedLayouts || []}, embedded.images);
      signal.throwIfAborted();
      if (getFileInfo()?.id !== fileId || getSlidesSlideId() !== pageId) throw Error('The selected slide changed. Please try again.');
      const { saveMediaRecordToOPFS } = await import('shared-vuejs/api/opfs');
      for (const asset of embedded.images.values()) {
        signal.throwIfAborted();
        const data = new Uint8Array(await (await fetch(asset.data)).arrayBuffer());
        await saveMediaRecordToOPFS({fileId,name:asset.name,data,w:asset.w,h:asset.h});
      }
      signal.throwIfAborted();
      const { googleFonts } = await import('shared-vuejs/api/googleFonts');
      const catalog = new Map(googleFonts.map((font: string[]) => [font[0].toLowerCase(), font[0]]));
      const families = renderedHtmlFontFamilies({...renderedDeck,slides:[...renderedDeck.slides,...(renderedDeck.sharedLayouts || [])]}).map((name: string) => catalog.get(name.toLowerCase())).filter(Boolean) as string[];
      if (families.length) {
        status.value = `Loading fonts: ${families.join(', ')}…`;
        const failed = await loadGeneratedGoogleFonts([...new Set(families)]);
        if (failed.length) importFontWarnings.push(`Could not load Google Fonts: ${failed.join(', ')}. Fallback fonts may change the layout.`);
        await document.fonts?.ready;
      }
      signal.throwIfAborted();
    }
    const { sharedLayouts, ...deckArguments } = renderedDeck;
    const args = { ...deckArguments, fileId, pageId };
    preflightDeckPlan({ calls: [{ name: 'desq_create_deck', arguments: args }] }, { document: documentResult.result, allowTextOverflow: true });
    signal.throwIfAborted();
    if (getFileInfo()?.id !== fileId || getSlidesSlideId() !== pageId) throw Error('The selected slide changed. Please try again.');
    status.value = 'Creating editable slides…';
    const result = await registry.executeTool('desq_create_deck', args, { signal, allowTextOverflow: true, insertOnly: true, preparedAssets, preparedLayoutAssets, sharedHtmlLayouts: sharedLayouts, onProgress: (message: string) => { if (active && generation === run) status.value = message; } });
    if (!result.ok) throw Error(result.error);
    if (active && generation === run) status.value = [`Inserted ${result.result.slideCount} editable slides.`, ...importFontWarnings, ...(result.result.warnings || [])].join('\n');
  } catch (error) {
    if (active && generation === run) status.value = error instanceof Error ? error.message : String(error);
  } finally { if (active && generation === run) busy.value = false; }
}


onBeforeUnmount(() => {
  if (mode === 'insert') {
    document.removeEventListener('selectionchange', editorAdapter.rememberTextCursor);
    editorAdapter.clearTextCursor();
  }
  active = false;
  piniaInfo().openEditorAgentModal = false;
  generation++;
  executionController?.abort();
  registry.dispose();
  installation?.dispose();
});
</script>

<style scoped>
.editor-agent { width: 100%; height: auto; min-height: 0; font: 13px/1.5 system-ui, -apple-system, BlinkMacSystemFont, sans-serif; color: #203a2a; user-select: text; touch-action: auto; }
.agent-panel { box-sizing: border-box; display: flex; flex-direction: column; width: 100%; height: auto; max-height: calc(100dvh - 150px); min-height: 0; padding: 4px 12px 16px; overflow-y: auto; background: #f8faf5; border: 0; }
header { display: flex; justify-content: space-between; align-items: center; }
header strong { font-size: 17px; line-height: 1.2; letter-spacing: -.02em; }
header button { border: 0; background: transparent; color: #718074; font-size: 24px; cursor: pointer; }
.external-brief > p:first-child { margin: 18px 0 0; color: #38533e; line-height: 1.55; }
.layout-options { padding: 0; margin: 20px 0 16px; border: 0; min-width: 0; }
.layout-options legend, .external-brief > label { display: block; margin-bottom: 8px; font-size: 13px; font-weight: 700; }
.layout-option { display: flex; align-items: flex-start; gap: 10px; margin: 8px 0; padding: 12px; border: 1px solid #dce5d8; border-radius: 10px; background: #fff; cursor: pointer; }
.layout-option:has(input:checked) { border-color: #82a669; background: #f1f7ec; box-shadow: 0 0 0 1px #82a669; }
.layout-option input { flex: none; margin: 3px 0 0; accent-color: #4d7e38; }
.layout-option strong, .layout-option small { display: block; }
.layout-option small { margin-top: 3px; color: #718074; font-size: 12px; line-height: 1.4; }
.external-brief > label { margin-top: 18px; }
.selected-response-file { margin: 0 0 8px; color: #38533e; font-size: 12px; }
textarea { width: 100%; box-sizing: border-box; margin: 0 0 8px; padding: 10px; border: 1px solid #dce5d8; border-radius: 9px; background: #fff; color: #203a2a; font: inherit; resize: vertical; }
.external-brief button { display: inline-flex; justify-content: center; align-items: center; width: 100%; padding: 11px 14px; border: 0; border-radius: 9px; font: 700 13px system-ui, sans-serif; cursor: pointer; }
.primary-button { color: #fff; background: #376d3a; }
.primary-button:not(:disabled):hover { background: #285a2f; }
.prompt-heading { display: flex; align-items: center; gap: 8px; margin: 18px 0 8px; font-weight: 700; }
.external-brief button.copy-button { width: 28px; height: 28px; padding: 4px; border-radius: 5px; background: transparent; color: #326d36; }
.copy-button svg { width: 20px; height: 20px; }
.external-brief button.copy-button:hover { background: #e8f0e3; }
.full-prompt { position: relative; }
.full-prompt summary { padding-right: 35px; }
.external-brief button.full-copy { position: absolute; top: -4px; right: 0; }
.create-button { margin-top: 8px; }
.external-brief details { margin: 14px 0; color: #526e55; }
.external-brief summary { cursor: pointer; font-weight: 600; }
.external-brief details textarea { margin-top: 8px; }
.model-note, .agent-result { color: #718074; font-size: 12px; line-height: 1.45; }
.agent-template-usage { margin-top: 18px; overflow-wrap: anywhere; font-size: 12px; }
button:disabled { opacity: .5; cursor: default; }
:focus-visible { outline: 2px solid #507e3c; outline-offset: 3px; }
.agent-result { white-space: pre-wrap; overflow-wrap: anywhere; }
</style>
