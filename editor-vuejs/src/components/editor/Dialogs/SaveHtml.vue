<template>
  <NModal
    :show="show"
    @update:show="close"
    preset="dialog"
    title="Save HTML"
    :mask-closable="!saving"
    :close-on-esc="!saving"
    :closable="!saving"
    :style="{ width: '440px', maxWidth: 'calc(100vw - 32px)' }"
  >
    <template #icon><BrandHtml5 /></template>
    <div class="html-save-options">
      <div>
        <p id="html-format-label" class="field-label">Format</p>
        <NRadioGroup v-model:value="format" aria-labelledby="html-format-label" :disabled="saving">
          <NSpace>
            <NRadio value="single">Single HTML</NRadio>
            <NRadio value="zip">ZIP</NRadio>
          </NSpace>
        </NRadioGroup>
        <p class="format-description">{{ format === 'single' ? 'One HTML file with all media included.' : 'An HTML file and its supporting assets in a ZIP archive.' }}</p>
      </div>
      <div>
        <p id="html-editable-label" class="field-label">Editability</p>
        <NRadioGroup v-model:value="embedEditor" aria-labelledby="html-editable-label" :disabled="saving">
          <NSpace>
            <NRadio :value="false">View only</NRadio>
            <NRadio :value="true">Embed editor</NRadio>
          </NSpace>
        </NRadioGroup>
        <p class="editor-description">{{ embedEditor ? 'Include the editor so the file can be edited offline in a browser.' : 'Save a presentation for viewing, without the editor.' }}</p>
      </div>
    </div>
    <p class="preparation-status" role="status" aria-live="polite">{{ preparationMessage }}</p>
    <NButton v-if="preparationError" size="small" @click="prepare">Try again</NButton>
    <template #action>
      <NSpace justify="end">
        <NButton :disabled="saving" @click="close(false)">Cancel</NButton>
        <NButton type="primary" :loading="saving" :disabled="saving" @click="save">Save</NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import { NModal, NRadioGroup, NRadio, NSpace, NButton } from 'naive-ui';
import { BrandHtml5 } from '@vicons/tabler';
import { prepareHtml, savePreparedHtml, selectHtmlDestination, isHtmlSaveCurrent, type HtmlSaveFormat, type PreparedHtml } from '@/lib/main/saveHtml';
import { showError } from '@/lib/main/utils';

const props = defineProps<{ show: boolean }>();
const emit = defineEmits<{ 'update:show': [value: boolean] }>();
const format = ref<HtmlSaveFormat>('single');
const embedEditor = ref(false);
const saving = ref(false);
const preparing = ref(false);
const preparationError = ref('');
const prepared = shallowRef<PreparedHtml | null>(null);
const preparationMessage = computed(() => preparationError.value || (preparing.value ? 'Preparing HTML…' : prepared.value ? 'Ready to save.' : ''));
let generation = 0;
let preparationQueue: Promise<void> = Promise.resolve();

function prepare() {
  const current = ++generation;
  prepared.value = null;
  preparationError.value = '';
  if (!props.show) { preparing.value = false; return; }
  preparing.value = true;
  const nextFormat = format.value, nextEditable = embedEditor.value;
  preparationQueue = preparationQueue.catch(() => {}).then(async () => {
    if (current !== generation || !props.show) return;
    try {
      const result = await prepareHtml(nextFormat, nextEditable);
      if (current === generation && props.show) prepared.value = result;
    } catch (error) {
      if (current === generation && props.show) preparationError.value = error instanceof Error ? error.message : 'Unable to prepare HTML';
    } finally {
      if (current === generation) preparing.value = false;
    }
  });
}
watch([() => props.show, format, embedEditor], prepare, { immediate: true });
onBeforeUnmount(() => { generation++; });

function close(show: boolean) {
  if (!saving.value) emit('update:show', show);
}

async function save() {
  if (saving.value) return;
  saving.value = true;
  try {
    // Start the picker while the click still has browser user activation.
    const selection = selectHtmlDestination(format.value, embedEditor.value);
    const destination = await selection.destination;
    if (destination === null) return;
    if (!preparing.value && (!prepared.value || !isHtmlSaveCurrent(prepared.value.snapshot))) prepare();
    await preparationQueue;
    if (!prepared.value) throw new Error(preparationError.value || 'Unable to prepare HTML');
    const saved = await savePreparedHtml(prepared.value, { ...selection, destination: Promise.resolve(destination) });
    if (saved !== false) emit('update:show', false);
  } catch (error) {
    showError(error instanceof Error ? error.message : 'Unable to save HTML');
    if (prepared.value && !isHtmlSaveCurrent(prepared.value.snapshot)) prepare();
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.html-save-options { padding-block: 12px; }
.field-label { margin: 0 0 10px; font-weight: 600; }
.format-description, .editor-description { font-size: 13px; color: #63736b; line-height: 1.5; }
.format-description { margin: 10px 0 20px; }
.editor-description { margin: 8px 0 4px; }
.preparation-status { min-height: 18px; margin: 0 0 8px; font-size: 12px; color: #63736b; }
</style>
