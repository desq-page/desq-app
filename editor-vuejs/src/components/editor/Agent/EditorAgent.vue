<template>
  <div class="editor-agent" @pointerdown.stop="editorAdapter.rememberTextCursor()" @pointerup.stop @contextmenu.stop>
    <section id="agent-taskpane" class="agent-panel" role="complementary" aria-label="Editor agent task pane">
      <header><strong>Editor agent</strong><button aria-label="Close agent panel" @click="open = false">×</button></header>
      <section class="external-brief">
        <p>Choose a layout and copy the prompt to your preferred AI (ChatGPT, Claude, Gemini, Grok, Deepseek, ...). Then paste its response below to generate slides.</p>
        <fieldset class="layout-options" :disabled="busy">
          <legend>Layout</legend>
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
          <label for="external-prompt">Prompt</label>
          <button class="copy-button" type="button" aria-label="Copy prompt" title="Copy prompt" @click="copyPrompt"><DocumentCopy24Regular aria-hidden="true" /></button>
        </div>
        <textarea id="external-prompt" readonly :rows="externalLayoutStyle === 'templates' ? 3 : 3" :value="externalFullPrompt" @keydown.stop @keyup.stop />
        <label for="external-brief-json">Presentation output (JSON or HTML)</label>
        <textarea id="external-brief-json" v-model="externalBriefText" rows="4" :disabled="busy" placeholder="Paste the JSON or full HTML response here" @keydown.stop @keyup.stop @keypress.stop @paste.stop />
        <label>Or open the HTML output file <input type="file" accept=".html,.htm,text/html" :disabled="busy" @change="loadExternalHtml" /></label>
        <p v-if="externalBriefError" role="alert">{{ externalBriefError }}</p>
        <div v-if="externalBriefResult.repaired">
          <p role="status">The JSON was repaired automatically. Review the repaired content carefully before creating slides; repair can change or omit content.</p>
          <details><summary>Review repaired JSON</summary>
            <textarea readonly rows="8" :value="externalBriefResult.repairedJson" aria-label="Repaired JSON" @keydown.stop @keyup.stop />
          </details>
        </div>
        <div v-if="externalBriefDeck">
          <strong>{{ externalBriefDeck.title }} · {{ externalBriefDeck.slides.length }} slides</strong>
          <ol><li v-for="(slide, index) in externalBriefDeck.slides" :key="index">{{ slide.title }} · {{ slide.layout }}</li></ol>
          <p>Review the slide list and source before creating slides.</p>
        </div>
        <button class="primary-button create-button" type="button" :disabled="busy || !externalBriefDeck" @click="createExternalBrief">{{ busy ? 'Creating slides…' : 'Create slides from output' }}</button>
      </section>
      <section v-if="currentTemplateUsage" class="agent-template-usage" aria-label="Current slide design">
        <strong>Current slide design</strong>
        <p v-if="currentNativeTemplate" class="model-note">Native template · master and layout linked</p>
        <p>{{ currentTemplateUsage.family }} · {{ currentTemplateUsage.layout }}</p>
        <p v-for="note in currentTemplateUsage.notes" :key="note" class="model-note">{{ note }}</p>
      </section>
      <p role="status" class="agent-result">{{ status }}</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue';
import { DocumentCopy24Regular } from '@vicons/fluent';
import { piniaInfo, piniaSlides } from '@/lib/common/store';
import { useRoute } from 'vue-router';
import { getFileInfo, getSlideInfo, getSlidesSlideId } from 'shared-vuejs/editor';
import { editorAdapter } from '@/lib/agent/editor-adapter';
import { createEditorTools } from '@/lib/agent/editor-tools.mjs';
import { installEditorAgent, parseAgentOrigins } from '@/lib/agent/webmcp.mjs';
import { templateUsage } from '@/lib/agent/template-report.mjs';
import { parseExternalBriefResult } from '@/lib/agent/external-brief.mjs';
import { preflightDeckPlan } from '@/lib/agent/deck-preflight.mjs';
import externalPrompt from '@/lib/agent/external-brief/instructions-v1.md?raw';
import externalSchema from '@/lib/agent/external-brief/schema-v1.json?raw';

const route = useRoute();
const open = computed({ get: () => piniaInfo().currentTaskPane === 'agent', set: value => piniaInfo().setCurTaskPane(value ? 'agent' : '') });
const busy = ref(false), status = ref(''), externalBriefText = ref('');
const externalLayoutStyle = ref<'templates' | 'frontend-slides'>('frontend-slides');
const nativeBriefSchema = JSON.parse(externalSchema);
const nativeSlideProperties = nativeBriefSchema.properties.slides.items.properties;
nativeSlideProperties.layout.enum = nativeSlideProperties.layout.enum.filter((layout: string) => layout !== 'svg' && layout !== 'html');
delete nativeSlideProperties.svg;
delete nativeSlideProperties.html;
const nativeBriefSchemaText = JSON.stringify(nativeBriefSchema, null, 2);
const externalInstructions = `${externalPrompt}\n${nativeBriefSchemaText}\n\nLayout preference: Use the Desq native layouts; do not use SVG or HTML layouts.\n\nMy request: `;
const externalFullPrompt = computed(() => externalLayoutStyle.value === 'frontend-slides'
  ? 'Use skill https://github.com/zarazhangrui/frontend-slides, generate a presentation and make it downloadable HTML, title: '
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
const registry = createEditorTools(editorAdapter, () => active &&
  getFileInfo()?.id === route.params.id && !!getSlidesSlideId() && getSlideInfo()?.id === getSlidesSlideId());
const currentSlideDesign = computed(() => ({ slideId: piniaSlides().slideId, revision: piniaSlides().sldState, metadata: (getSlideInfo() as any)?.agentMetadata }));
const currentNativeTemplate = computed(() => currentSlideDesign.value.metadata?.engine === 'pptx-template-native');
const currentTemplateUsage = computed(() => templateUsage(currentSlideDesign.value.metadata?.templateSelection));

async function loadExternalHtml(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (file.size > 1700000) { status.value = 'HTML must be under 1,700,000 bytes.'; input.value = ''; return; }
  externalBriefText.value = await file.text();
  input.value = '';
}

async function copyPrompt() {
  try {
    await navigator.clipboard.writeText(externalFullPrompt.value);
    status.value = externalLayoutStyle.value === 'frontend-slides' ? 'Prompt copied. Add your presentation title in the external chat.' : 'Prompt copied. Add your request in the external chat.';
  } catch { status.value = 'Could not copy automatically. Select and copy the prompt above.'; }
}

onMounted(async () => {
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
  if (!fileId || !pageId) { status.value = 'Open a presentation and select a slide first.'; return; }
  const run = ++generation;
  executionController = new AbortController();
  const signal = executionController.signal;
  busy.value = true;
  try {
    status.value = 'Checking the slide content and layouts…';
    const documentResult = await registry.executeTool('desq_get_document');
    if (!documentResult.ok) throw Error(documentResult.error);
    const args = { ...deck, fileId, pageId };
    preflightDeckPlan({ calls: [{ name: 'desq_create_deck', arguments: args }] }, { document: documentResult.result, allowTextOverflow: true });
    signal.throwIfAborted();
    if (getFileInfo()?.id !== fileId || getSlidesSlideId() !== pageId) throw Error('The selected slide changed. Please try again.');
    status.value = 'Creating editable slides…';
    const result = await registry.executeTool('desq_create_deck', args, { signal, allowTextOverflow: true, onProgress: (message: string) => { if (active && generation === run) status.value = message; } });
    if (!result.ok) throw Error(result.error);
    if (active && generation === run) status.value = [`Created ${result.result.slideCount} editable slides.`, ...(result.result.warnings || [])].join('\n');
  } catch (error) {
    if (active && generation === run) status.value = error instanceof Error ? error.message : String(error);
  } finally { if (active && generation === run) busy.value = false; }
}


onBeforeUnmount(() => {
  document.removeEventListener('selectionchange', editorAdapter.rememberTextCursor);
  editorAdapter.clearTextCursor();
  active = false;
  generation++;
  executionController?.abort();
  registry.dispose();
  installation?.dispose();
});
</script>

<style scoped>
.editor-agent { width: 100%; height: 100%; min-height: 0; font: 13px/1.5 system-ui, -apple-system, BlinkMacSystemFont, sans-serif; color: #203a2a; user-select: text; touch-action: auto; }
.agent-panel { box-sizing: border-box; display: flex; flex-direction: column; width: 100%; height: 100%; min-height: 0; padding: 16px; overflow-y: auto; background: #f8faf5; border-left: 1px solid #dce5d8; }
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
