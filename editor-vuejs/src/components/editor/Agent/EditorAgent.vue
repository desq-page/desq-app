<template>
  <div class="editor-agent" @pointerdown.stop="editorAdapter.rememberTextCursor()" @pointerup.stop @contextmenu.stop>
    <section id="agent-taskpane" class="agent-panel" role="complementary" aria-label="Editor agent task pane">
      <header><strong>Editor agent</strong><button aria-label="Close agent panel" @click="open = false">×</button></header>
      <div class="agent-settings">
        <label for="agent-provider">Provider</label>
        <select id="agent-provider" v-model="provider" :disabled="busy">
          <option value="chatgpt">ChatGPT / OpenAI</option>
          <option value="gemini">Gemini</option>
          <option value="local">Local</option>
        </select>
        <label for="agent-model">Model</label>
        <select v-if="modelKey === 'chatgpt'" id="agent-model" v-model="chatgptModel" :disabled="busy || !chatgptModels.length" @change="selectChatGPTModel">
          <option v-if="!chatgptModels.length" value="">Connect to load models</option>
          <option v-for="model in chatgptModels" :key="model.id" :value="model.id">{{ model.label }}</option>
        </select>
        <select v-else-if="modelKey === 'gemini'" id="agent-model" v-model="geminiModel" :disabled="busy || !geminiModels.length" @change="rememberGeminiModel">
          <option v-if="!geminiModels.length" value="">Connect to load models</option>
          <option v-for="model in geminiModels" :key="model.id" :value="model.id">{{ model.label }}</option>
        </select>
        <select v-else id="agent-model" v-model="modelKey" :disabled="busy || ready">
          <option v-for="model in LOCAL_MODELS" :key="model.key" :value="model.key">{{ model.label }}</option>
        </select>
        <button v-if="busy || ready" class="stop-model" type="button" @click="stopModel">Stop model</button>
        <template v-if="modelKey === 'chatgpt' && chatgptAuthMode === 'api-key' && !ready">
          <label for="chatgpt-api-key">OpenAI API key</label>
          <input id="chatgpt-api-key" v-model="chatgptApiKey" type="password" autocomplete="off" maxlength="512" :disabled="busy"
            @keydown.stop @keyup.stop @keypress.stop @paste.stop @copy.stop @cut.stop />
        </template>
        <template v-if="modelKey === 'gemini' && !ready">
          <label for="gemini-api-key">Gemini API key</label>
          <input id="gemini-api-key" v-model="geminiApiKey" type="password" autocomplete="off" maxlength="512" :disabled="busy"
            @keydown.stop @keyup.stop @keypress.stop @paste.stop @copy.stop @cut.stop />
          <label><input v-model="rememberGeminiKey" type="checkbox" :disabled="busy" @keydown.stop @keyup.stop @keypress.stop /> Remember key on this browser</label>
        </template>
        <button v-if="!ready" :disabled="busy || (modelKey === 'chatgpt' && !chatgptAuthMode)" @click="loadModel">{{ busy ? 'Connecting…' : modelKey === 'chatgpt' ? (chatgptAuthMode === 'api-key' ? 'Connect OpenAI' : 'Continue with ChatGPT') : modelKey === 'gemini' ? 'Connect Gemini' : 'Load local model' }}</button>
        <button v-if="modelKey === 'chatgpt' && (chatgptEmail || chatgptModels.length)" :disabled="busy" @click="disconnectChatGPT">Disconnect</button>
        <button v-if="modelKey === 'gemini' && (geminiModels.length || geminiKeySaved)" :disabled="busy" @click="disconnectGemini">Forget key and disconnect</button>
      </div>
      <div v-if="provider === 'local'" class="agent-settings">
          <label for="agent-html-template">Design template (PPTX)</label>
          <select id="agent-html-template" v-model="htmlTemplate" :disabled="busy">
            <option value="freeform">Freeform</option>
            <option v-for="item in PPTX_TEMPLATE_CHOICES" :key="item.id" :value="item.id">{{ item.name }}</option>
          </select>

      </div>
      <div class="agent-tabs" role="tablist" aria-label="Slide task">
        <button id="agent-create-tab" type="button" role="tab" :aria-selected="taskMode === 'create'" aria-controls="agent-task-form" :tabindex="taskMode === 'create' ? 0 : -1" :disabled="busy" @click="taskMode = 'create'" @keydown.right.prevent.stop="selectTaskTab('edit')" @keydown.left.prevent.stop="selectTaskTab('edit')">Create slide</button>
        <button id="agent-edit-tab" type="button" role="tab" :aria-selected="taskMode === 'edit'" aria-controls="agent-task-form" :tabindex="taskMode === 'edit' ? 0 : -1" :disabled="busy" @click="taskMode = 'edit'" @keydown.right.prevent.stop="selectTaskTab('create')" @keydown.left.prevent.stop="selectTaskTab('create')">Edit current slide</button>
      </div>
      <form id="agent-task-form" role="tabpanel" :aria-labelledby="taskMode === 'create' ? 'agent-create-tab' : 'agent-edit-tab'" @submit.prevent="sendCommand">
        <div v-if="taskMode === 'create'" class="create-options">
          <label for="agent-slide-count">Number of slides
            <select id="agent-slide-count" v-model="slideCount" :disabled="busy" @keydown.stop @keyup.stop @keypress.stop>
              <option value="auto">Auto</option>
              <option v-for="count in 10" :key="count" :value="count">{{ count }}</option>
            </select>
          </label>
          <label for="agent-effort">Effort
            <select id="agent-effort" v-model="effort" :disabled="busy">
              <option value="quick">Quickly</option><option value="detailed">Elaborated</option>
            </select>
          </label>
        </div>
        <p v-else class="model-note">Updates replace the current slide in place. You can undo the change.</p>
        <label for="agent-command">{{ taskMode === 'create' ? 'Topic' : 'Command' }}</label>
        <textarea id="agent-command" v-model="activeCommand" maxlength="3200" rows="3" required :disabled="busy"
          :placeholder="taskMode === 'create' ? 'e.g. Solar energy for business leaders' : 'e.g. Simplify the explanation and use a darker background'"
          @keydown.stop @keyup.stop @keypress.stop
          @pointerdown.stop @pointerup.stop @mousedown.stop @mouseup.stop @click.stop @dblclick.stop
          @touchstart.stop @touchend.stop @wheel.stop @contextmenu.stop
          @input.stop @change.stop @paste.stop @copy.stop @cut.stop
          @compositionstart.stop @compositionupdate.stop @compositionend.stop />
        <label for="agent-source-files">Source documents</label>
        <input id="agent-source-files" type="file" multiple accept=".pdf,.docx,.pptx,.html,.htm,.md,.txt" :disabled="busy" @change="addSourceFiles" @click.stop />
        <label for="agent-source-url">Source URL</label>
        <input id="agent-source-url" v-model="sourceUrl" type="url" placeholder="https://… (including Wikipedia)" :disabled="busy" @keydown.enter.prevent="addSourceUrl" />
        <button type="button" :disabled="busy || !sourceUrl.trim()" @click="addSourceUrl">Add URL</button>
        <ul v-if="sourceBundles.length" class="agent-source-list">
          <li v-for="source in sourceBundles" :key="source.id">{{ source.name }} · {{ source.blocks.length }} blocks · {{ source.assets.length }} assets
            <button type="button" :disabled="busy" @click="downloadSourceEvidence(source)">Inspect extracted source</button>
            <button type="button" :disabled="busy" @click="sourceBundles = sourceBundles.filter(item => item.id !== source.id)">Remove</button>
            <p v-for="warning in source.warnings" :key="warning" class="model-note">{{ warning }}</p>
          </li>
        </ul>
        <div class="agent-actions">
          <button type="submit" :disabled="!ready || busy || !activeCommand.trim() || (taskMode === 'create' && !validSlideCount)">{{ busy && ready ? 'Working…' : taskMode === 'create' ? 'Create slides' : 'Update slide' }}</button>
        </div>
      </form>
      <section v-if="currentTemplateUsage" class="agent-template-usage" aria-label="Current slide design">
        <strong>Current slide design</strong>
        <p v-if="currentNativeTemplate" class="model-note">Native template · master and layout linked</p>
        <p>{{ currentTemplateUsage.family }} · {{ currentTemplateUsage.layout }}</p>
        <p v-for="note in currentTemplateUsage.notes" :key="note" class="model-note">{{ note }}</p>
      </section>
      <details v-if="lastTemplateRows.length" class="agent-template-usage">
        <summary>Last generated deck · templates and layouts</summary>
        <p v-if="lastTemplateNote" class="model-note">{{ lastTemplateNote }}</p>
        <ol>
          <li v-for="row in lastTemplateRows" :key="row.slide">
            {{ row.title }} — {{ row.family }} · {{ row.layout }}
            <p v-for="note in row.notes" :key="note" class="model-note">{{ note }}</p>
          </li>
        </ol>
      </details>
      <p role="status" class="agent-result">{{ status }}</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { piniaInfo, piniaSlides } from '@/lib/common/store';
import { useRoute } from 'vue-router';
import { getFileInfo, getSlideInfo, getSlidesSlideId } from 'shared-vuejs/editor';
import { editorAdapter } from '@/lib/agent/editor-adapter';
import { createEditorTools } from '@/lib/agent/editor-tools.mjs';
import { installEditorAgent, parseAgentOrigins } from '@/lib/agent/webmcp.mjs';
import { createLocalAgent } from '@/lib/agent/local-agent.mjs';
import {templateUsage,deckTemplateUsage} from '@/lib/agent/template-report.mjs';
import {preparePresentonContext} from '@/lib/agent/presenton-pptx.mjs';
import { PPTX_TEMPLATE_CHOICES } from '@/lib/agent/presenton-templates.mjs';
import { ingestSource, ingestUrl } from '@/lib/agent/source-intake.mjs';
import { SELECTABLE_LOCAL_MODELS as LOCAL_MODELS } from '@/lib/agent/local-models.mjs';
import { createChatGPTAgent, chatgptRequest } from '@/lib/agent/chatgpt-agent.mjs';
import { openChatGPTSignInPopup } from '@/lib/agent/chatgpt-popup.mjs';
import { createGeminiAgent, geminiRequest } from '@/lib/agent/gemini-agent.mjs';
import { buildAgentTask, validateAgentTaskPlan } from '@/lib/agent/agent-task.mjs';
import { readGeminiPreferences, saveGeminiPreferences, forgetGeminiPreferences } from '@/lib/agent/gemini-preferences.mjs';
import { readAgentProvider, saveAgentProvider } from '@/lib/agent/provider-preferences.mjs';

const route = useRoute();
const open = computed({ get: () => piniaInfo().currentTaskPane === 'agent', set: value => piniaInfo().setCurTaskPane(value ? 'agent' : '') });
const busy = ref(false), ready = ref(false);
const command = ref(''), status = ref(''), bridgeStatus = ref('Starting editor tools…');
const taskMode = ref<'create' | 'edit'>('create');
const sourceBundles = ref<any[]>([]);
const sourceUrl = ref('');
const topic = ref(''), slideCount = ref<number | 'auto'>('auto'), effort = ref('quick');

const htmlTemplate = ref('builtin-ocean');
const activeCommand = computed({ get: () => taskMode.value === 'create' ? (topic.value || (sourceBundles.value.length ? 'Create a presentation from the attached sources' : '')) : command.value,
  set: value => { if (taskMode.value === 'create') topic.value = value; else command.value = value; } });
const validSlideCount = computed(() => slideCount.value === 'auto' || (typeof slideCount.value === 'number' && Number.isInteger(slideCount.value) && slideCount.value >= 1 && slideCount.value <= 10));
async function selectTaskTab(mode: 'create' | 'edit') {
  if (busy.value) return;
  taskMode.value = mode;
  await nextTick();
  document.getElementById(`agent-${mode}-tab`)?.focus();
}
const runtimeStatus = ref('');
const initialProvider = readAgentProvider();
const modelKey = ref(initialProvider === 'local' ? LOCAL_MODELS[0].key : initialProvider);
const provider = computed({ get: () => ['chatgpt', 'gemini'].includes(modelKey.value) ? modelKey.value : 'local',
  set: value => {
    stopModel();
    modelKey.value = value === 'local' ? LOCAL_MODELS[0].key : value;
    saveAgentProvider(value);
    if (value === 'gemini') restoreGemini();
  } });
function selectChatGPTModel() {
  if (!ready.value || modelKey.value !== 'chatgpt') return;
  local?.dispose();
  local = createChatGPTAgent(chatgptModel.value);
}

const chatgptModels = ref<{ id: string; label: string }[]>([]), chatgptModel = ref(''), chatgptEmail = ref('');
const chatgptAuthMode = ref(''), chatgptApiKey = ref('');
watch(modelKey, async value => {
  if (value !== 'chatgpt') return;
  try { const account = await chatgptRequest('status'); if (active) chatgptAuthMode.value = account.authMode || 'oauth'; }
  catch (error) { if (active) { chatgptAuthMode.value = ''; status.value = error instanceof Error ? error.message : String(error); } }
}, { immediate: true });
const geminiModels = ref<{ id: string; label: string }[]>([]), geminiModel = ref(''), geminiApiKey = ref('');
const geminiKeySaved = ref(!!readGeminiPreferences().apiKey);
const rememberGeminiKey = ref(geminiKeySaved.value);
let geminiController: AbortController | undefined;
let loginController: AbortController | undefined, loginWindow: ReturnType<typeof openChatGPTSignInPopup>;
let executionController: AbortController | undefined;
const authoring = computed(() => provider.value === 'local' ? 'html' : 'svg');
let active = true, installation: any, local: any, generation = 0;
const registry = createEditorTools(editorAdapter, () => active &&
  getFileInfo()?.id === route.params.id && !!getSlidesSlideId() && getSlideInfo()?.id === getSlidesSlideId());

function restoreGemini() {
  if (active && modelKey.value === 'gemini' && !ready.value && !busy.value && readGeminiPreferences().apiKey) void connectGemini();
}
watch(open, value => { if (value) restoreGemini(); });

onMounted(async () => {
  document.addEventListener('selectionchange', editorAdapter.rememberTextCursor);
  try {
    const origins = parseAgentOrigins(import.meta.env.VITE_EDITOR_AGENT_ORIGINS);
    installation = await installEditorAgent(registry, { window, document, navigator, origins });
    if (!active) { installation.dispose(); return; }
    bridgeStatus.value = installation.native ? 'WebMCP tools available to agents.' : 'Editor tools available to embedded agents. Native WebMCP is unavailable in this browser.';
    if (installation.nativeError) console.warn('WebMCP registration unavailable:', installation.nativeError);
  } catch (error) { bridgeStatus.value = error instanceof Error ? error.message : String(error); }
  restoreGemini();
});

async function loadModel() {
  if (modelKey.value === 'chatgpt') { await connectChatGPT(); return; }
  if (modelKey.value === 'gemini') { await connectGemini(); return; }
  const run = ++generation;
  busy.value = true;
  status.value = 'Loading local model…';
  local?.dispose();
  runtimeStatus.value = '';
  ready.value = false;
  try {
    const instance = createLocalAgent(progress => {
      if (active && local === instance && busy.value) status.value = progress.status === 'generating' ? `Generating locally: ${progress.characters} characters · ${Math.round(progress.elapsedMs / 1000)}s` : `Loading ${progress.file || 'model'}: ${Math.round(progress.progress || 0)}%`;
    }, modelKey.value);
    local = instance;
    const runtime = await local.load();
    if (active && generation === run) {
      ready.value = true; status.value = 'Local model ready.';
      runtimeStatus.value = `${LOCAL_MODELS.find(model => model.key === modelKey.value)?.label} · ${runtime.backend.toUpperCase()} · ${runtime.dtype}`;
    }
  } catch (error) {
    if (active && generation === run) { status.value = error instanceof Error ? error.message : String(error); local?.dispose(); local = undefined; }
  } finally { if (active && generation === run) busy.value = false; }
}

async function connectGemini() {
  const run = ++generation;
  busy.value = true; ready.value = false; status.value = 'Connecting to Gemini…';
  local?.dispose(); runtimeStatus.value = '';
  geminiController = new AbortController();
  const signal = geminiController.signal;
  const timeout = setTimeout(() => geminiController?.abort(), 120_000);
  const preferences = readGeminiPreferences();
  const apiKey = geminiApiKey.value.trim() || preferences.apiKey;
  if (!geminiModel.value) geminiModel.value = preferences.model;
  geminiApiKey.value = '';
  try {
    const data = await geminiRequest('connect', { signal, body: apiKey.trim() ? { apiKey } : {} });
    if (!active || generation !== run) return;
    geminiModels.value = data.models;
    if (!data.models.length) throw new Error('No Gemini text models are available to this key.');
    if (!data.models.some((model: { id: string }) => model.id === geminiModel.value)) {
      geminiModel.value = data.models.find((model: { id: string }) => /flash/.test(model.id))?.id || data.models[0].id;
    }
    local = createGeminiAgent(() => geminiModel.value);
    ready.value = true; status.value = 'Gemini ready. Choose a model and send a command.';
    runtimeStatus.value = 'Gemini · Direct browser connection';
    if (apiKey && rememberGeminiKey.value) {
      try { saveGeminiPreferences(apiKey, geminiModel.value); geminiKeySaved.value = true; }
      catch (error) { status.value = error instanceof Error ? error.message : String(error); }
    } else if (!rememberGeminiKey.value) {
      forgetGeminiPreferences(); geminiKeySaved.value = false;
    }
  } catch (error) {
    if (active && generation === run) status.value = error instanceof Error ? error.message : String(error);
  } finally {
    clearTimeout(timeout);
    if (active && generation === run) { geminiController = undefined; busy.value = false; }
  }
}

function rememberGeminiModel() {
  const saved = readGeminiPreferences();
  if (saved.apiKey) {
    try { saveGeminiPreferences(saved.apiKey, geminiModel.value); }
    catch (error) { status.value = error instanceof Error ? error.message : String(error); }
  }
}

async function disconnectGemini() {
  stopModel(); busy.value = true;
  try {
    forgetGeminiPreferences(); geminiKeySaved.value = false;
    await geminiRequest('disconnect', { body: {} });
    geminiModels.value = []; geminiModel.value = '';
    status.value = 'Gemini disconnected. The saved API key was removed from this browser.';
  } catch (error) { status.value = error instanceof Error ? error.message : String(error); }
  finally { busy.value = false; }
}

async function connectChatGPT() {
  const run = ++generation;
  // Open synchronously from the click so browser popup blockers allow OAuth.
  loginWindow = chatgptAuthMode.value === 'oauth' ? openChatGPTSignInPopup() : null;
  busy.value = true; ready.value = false; status.value = 'Connecting to ChatGPT…';
  local?.dispose(); runtimeStatus.value = '';
  loginController = new AbortController();
  const signal = loginController.signal;
  const timeout = setTimeout(() => loginController?.abort(), 5 * 60_000);
  try {
    let account = await chatgptRequest('status', { signal });
    chatgptAuthMode.value = account.authMode || 'oauth';
    if (account.authMode === 'api-key' && (!account.connected || chatgptApiKey.value.trim())) {
      await chatgptRequest('connect', { signal, body: { apiKey: chatgptApiKey.value } });
      chatgptApiKey.value = '';
      account = await chatgptRequest('status', { signal });
    }
    if (!account.connected) {
      if (!loginWindow || loginWindow.closed) throw new Error('Allow popups to continue with ChatGPT.');
      const login = await chatgptRequest('login', { signal, body: {} });
      if (!active || generation !== run) return;
      const url = new URL(login.url);
      if (url.origin !== 'https://auth.openai.com') throw new Error('Invalid ChatGPT sign-in address.');
      await loginWindow.navigate(url.href);
      status.value = 'Complete ChatGPT sign-in in the browser window…';
      while (!account.connected) {
        await new Promise<void>((resolve, reject) => {
          const cancel = () => { clearTimeout(timer); reject(new Error('ChatGPT sign-in cancelled or timed out.')); };
          const timer = setTimeout(() => { signal.removeEventListener('abort', cancel); resolve(); }, 1000);
          signal.addEventListener('abort', cancel, { once: true });
          if (signal.aborted) cancel();
        });
        account = await chatgptRequest('status', { signal });
        if (account.error) throw new Error(account.error);
        // OpenAI may isolate the popup with COOP. Server state and the overall
        // timeout remain authoritative after navigation, not its WindowProxy.
      }
    }
    loginWindow?.close(); loginWindow = null;
    const data = await chatgptRequest('models', { signal });
    if (!active || generation !== run) return;
    chatgptEmail.value = account.email;
    chatgptModels.value = data.models;
    if (!data.models.length) throw new Error('No ChatGPT models are available to this account.');
    if (!data.models.some((model: { id: string }) => model.id === chatgptModel.value)) chatgptModel.value = data.models[0].id;
    local = createChatGPTAgent(chatgptModel.value);
    ready.value = true; status.value = 'ChatGPT ready.';
    runtimeStatus.value = `ChatGPT · ${data.models.find((model: { id: string }) => model.id === chatgptModel.value)?.label}`;
  } catch (error) {
    if (active && generation === run) status.value = error instanceof Error ? error.message : String(error);
  } finally {
    clearTimeout(timeout);
    if (generation === run) { loginWindow?.close(); loginWindow = null; loginController = undefined; busy.value = false; }
  }
}

async function disconnectChatGPT() {
  stopModel(); busy.value = true;
  try {
    const result = await chatgptRequest('logout', { body: {} });
    chatgptEmail.value = ''; chatgptModels.value = []; chatgptModel.value = '';
    status.value = result.revoked ? 'ChatGPT disconnected.' : 'Disconnected locally. Remote revocation was not confirmed; disconnect the app in ChatGPT Settings.';
  } catch (error) { status.value = error instanceof Error ? error.message : String(error); }
  finally { busy.value = false; }
}

const currentSlideDesign = computed(() => ({slideId:piniaSlides().slideId,revision:piniaSlides().sldState,metadata:(getSlideInfo() as any)?.agentMetadata}));
const currentNativeTemplate = computed(() => currentSlideDesign.value.metadata?.engine === 'pptx-template-native');
const currentTemplateUsage = computed(() => templateUsage(currentSlideDesign.value.metadata?.templateSelection));
const lastTemplateRows = ref<any[]>([]), lastTemplateNote = ref('');
function downloadSourceEvidence(source: any) {
  const manifest = {...source, assets: source.assets.map(({data,blob,...asset}: any) => asset)};
  const url = URL.createObjectURL(new Blob([JSON.stringify(manifest,null,2)],{type:'application/json'}));
  const link = document.createElement('a'); link.href = url; link.download = `${source.name}.source.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url),1000);
}

async function addSourceUrl() {
  if (busy.value || !sourceUrl.value.trim()) return;
  const run = ++generation;
  executionController = new AbortController();
  const signal = executionController.signal;
  busy.value = true;
  status.value = 'Reading web source…';
  try {
    const source = await ingestUrl(sourceUrl.value.trim(), { signal });
    signal.throwIfAborted();
    if (!active || generation !== run) return;
    sourceBundles.value.push(source);
    sourceUrl.value = '';
    status.value = 'Web source content and design evidence ready.';
  } catch (error) { if (active && generation === run) status.value = error instanceof Error ? error.message : String(error); }
  finally { if (active && generation === run) busy.value = false; }
}

async function addSourceFiles(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files || []);
  if (!files.length || busy.value) return;
  const run = ++generation;
  executionController = new AbortController();
  const signal = executionController.signal;
  busy.value = true;
  try {
    for (const file of files) {
      status.value = `Reading source: ${file.name}…`;
      const source = await ingestSource(file, { signal });
      signal.throwIfAborted();
      if (!active || generation !== run) return;
      sourceBundles.value.push(source);
    }
    status.value = 'Source content and design evidence ready.';
  } catch (error) { if (active && generation === run) status.value = error instanceof Error ? error.message : String(error); }
  finally { input.value = ''; if (active && generation === run) busy.value = false; }
}

async function sendCommand() {
  if (!ready.value || busy.value || !activeCommand.value.trim()) return;
  const mode = taskMode.value, count = slideCount.value;
  const nativeTemplateMode = mode === 'create' && ['html','markdown'].includes(authoring.value) && htmlTemplate.value !== 'freeform';
  const submittedTarget = { fileId: getFileInfo()?.id, pageId: getSlidesSlideId() };
  let task;
  try { task = buildAgentTask({ mode, topic: topic.value || (sourceBundles.value.length ? 'Create a presentation from the attached sources' : ''), command: command.value, count, effort: effort.value, slideAuthoring: nativeTemplateMode ? 'pptx' : authoring.value, local: provider.value === 'local' }); }
  catch (error) { status.value = error instanceof Error ? error.message : String(error); return; }
  const prompt = task.prompt;
  const reply = { text: '' };
  const run = ++generation;
  busy.value = true;
  status.value = 'Interpreting command…';
  executionController = new AbortController();
  const signal = executionController.signal;
  const results: string[] = [];
  let placeholderCount = 0;
  try {
    const documentResult = await registry.executeTool('savanna_get_document');
    const pageResult = await registry.executeTool('savanna_get_page', { limit: 100 });
    if (!documentResult.ok || !pageResult.ok) throw new Error(documentResult.error || pageResult.error);
    if (mode === 'edit' && (documentResult.result.fileId !== submittedTarget.fileId || pageResult.result.pageId !== submittedTarget.pageId))
      throw new Error('The slide changed before its content could be read. Submit the edit again.');
    const usesPresenton = ['html','markdown'].includes(authoring.value);
    const pptxTemplateContext = usesPresenton && provider.value !== 'local'
      ? await preparePresentonContext(htmlTemplate.value, {signal,onProgress: (message: string) => { if(active && generation === run) status.value = message; }})
      : undefined;
    signal.throwIfAborted();
    const plan = await local.plan(prompt, registry.listTools(), { signal, pptxTemplateContext, sourceBundles: sourceBundles.value, document: documentResult.result, page: pageResult.result, slideAuthoring: authoring.value, htmlTemplate: htmlTemplate.value, ...(provider.value === 'local' ? { localDesignMode: 'freeform-html' } : {}), slideTask: { mode, count: mode === 'edit' ? 1 : count }, authoringEffort: mode === 'create' ? effort.value : 'detailed' }, { onProgress: (message: string) => {
      if (active && generation === run) { status.value = message; reply.text = message; }
    } });
    if (!active || generation !== run) return;
    validateAgentTaskPlan(plan, mode, count);
    if (mode === 'edit') for (const call of plan.calls) Object.assign(call.arguments, submittedTarget);
    for (const call of plan.calls) {
      if (!active || generation !== run) break;
      status.value = call.name === 'savanna_create_deck' ? 'Compiling and checking the deck…' : call.name === 'savanna_create_slide' ? 'Creating slide and resolving requested images…' : 'Applying editor command…';
      reply.text = status.value;
      const result = await registry.executeTool(call.name, call.arguments, { signal, sourceBundles: plan.sourceBundles || sourceBundles.value, replaceCurrent: mode === 'edit',
        ...(local?.rewriteText ? { rewriteText: (field: any, options: any) => local.rewriteText(field, options) } : {}),
        ...(local?.imageMatches ? { imageMatches: (image: any, options: any) => local.imageMatches(image, options) } : {}),
        ...(local?.imageKeywords ? { imageKeywords: (image: any, options: any) => local.imageKeywords(image, options) } : {}),
        ...(local?.generateImage ? { generateImage: (image: any, options: any) => local.generateImage(image, options) } : {}), onProgress: (message: string) => {
        if (active && generation === run) { status.value = message; reply.text = message; }
      } });
      if (!result.ok) throw new Error(result.error);
      if (call.name === 'savanna_create_deck') {
        lastTemplateRows.value = deckTemplateUsage(call.arguments.slides);
        lastTemplateNote.value = plan.metrics?.designBrief?.templateFallback ? 'Family fallback: the model did not choose a valid family, so the app used the built-in template.' : '';
      }
      results.push(`${call.name.replace('savanna_', '')}: ${JSON.stringify(result.result)}`);
      placeholderCount += result.result.placeholderCount || 0;
      if (result.result.warnings?.length) results.push(`Warnings: ${result.result.warnings.join('\n')}`);
      if (call.name === 'savanna_create_deck') reply.text = mode === 'edit' ? `Updated the submitted slide: ${result.result.title}.` : `Created ${result.result.slideCount} editable slides: ${result.result.title}.`;
    }
    if (active && generation === run) {
      const completion = plan.calls.length ? (plan.calls.every(call => registry.listTools().find(tool => tool.name === call.name)?.annotations.readOnlyHint) ? 'Read operations completed.' : 'Edits applied.') : '';
      const deckResult = plan.calls.some(call => call.name === 'savanna_create_deck') ? reply.text : '';
      reply.text = [plan.message, deckResult || completion, ...results.filter(result => result.startsWith('Warnings:')), placeholderCount ? `${placeholderCount} unavailable image(s) were replaced with editable placeholders showing their descriptions.` : ''].filter(Boolean).join('\n\n') || 'No edits applied. Please describe what you would like to change.';
      status.value = reply.text;
    }
  } catch (error) {
    if (active && generation === run) {
      reply.text = `${results.length ? 'Some operations completed before the error. ' : ''}${error instanceof Error ? error.message : String(error)}`;
      status.value = reply.text;
    }
    if (local?.stopped) { local?.dispose(); ready.value = false; runtimeStatus.value = ''; }
  } finally { if (active && generation === run) { busy.value = false; } }
}

function stopModel() {
  generation++;
  executionController?.abort(); executionController = undefined;
  geminiController?.abort(); geminiController = undefined;
  geminiApiKey.value = '';
  loginController?.abort(); loginController = undefined;
  loginWindow?.close(); loginWindow = null;
  local?.dispose(); local = undefined;

  ready.value = false; busy.value = false;
  runtimeStatus.value = '';
  status.value = 'Model stopped.';
}

onBeforeUnmount(() => {
  document.removeEventListener('selectionchange', editorAdapter.rememberTextCursor);
  editorAdapter.clearTextCursor();
  active = false;
  stopModel();
  registry.dispose();
  installation?.dispose();
});
</script>

<style scoped>
.editor-agent { width: 100%; height: 100%; min-height: 0; font: 14px/1.45 system-ui, sans-serif; color: #172923; user-select: text; touch-action: auto; }
.agent-toggle, .agent-actions button, .agent-panel > button { border: 1px solid #b7c9b1; border-radius: 8px; background: #edf3e1; padding: 8px 14px; cursor: pointer; }
.agent-panel { box-sizing: border-box; display: flex; flex-direction: column; width: 100%; height: 100%; min-height: 0; background: white; border-left: 1px solid #dbe5cc; padding: 12px; overflow-y: auto; }
.agent-settings { flex-shrink: 0; margin: 10px 0; font-size: 12px; }
.stop-model { margin-top: 8px; border: 1px solid #b7c9b1; border-radius: 8px; background: #edf3e1; padding: 8px 14px; cursor: pointer; }
header { display: flex; justify-content: space-between; align-items: center; }
header button { border: 0; background: transparent; font-size: 24px; cursor: pointer; }
.agent-status, .model-note { color: #63736b; font-size: 12px; }
label { display: block; margin-top: 12px; }
textarea { width: 100%; box-sizing: border-box; margin: 6px 0; padding: 8px; border: 1px solid #b7c9b1; border-radius: 8px; font: inherit; }
select, input[type="password"], input[type="number"] { width: 100%; box-sizing: border-box; margin-top: 6px; padding: 8px; border: 1px solid #b7c9b1; border-radius: 8px; font: inherit; }
.agent-tabs { display: flex; flex-shrink: 0; gap: 4px; margin-top: 8px; border-bottom: 1px solid #dbe5cc; }
.agent-tabs button { flex: 1; border: 0; border-bottom: 3px solid transparent; background: transparent; padding: 9px 4px; font: inherit; color: #52675b; cursor: pointer; }
.agent-tabs button[aria-selected="true"] { border-bottom-color: #527746; color: #172923; font-weight: 600; background: #f1f4ee; }
.agent-template-usage { overflow-wrap:anywhere; font-size:12px; }
.create-options { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
#agent-task-form { flex-shrink: 0; }
.agent-actions { display: flex; gap: 8px; }
button:disabled { opacity: .55; cursor: default; }
.agent-result { flex: 1 0 80px; white-space: pre-wrap; overflow-wrap: anywhere; overflow: auto; font-size: 12px; margin-bottom: 0; }
</style>
