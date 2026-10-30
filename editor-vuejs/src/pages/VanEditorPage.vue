<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRoute, onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router';
import { loadFileFromDexie, flushPendingDexieSaves } from 'shared-vuejs/api/dbutils';
import { flushPendingTextSave } from 'shared-vuejs/api/updateText';
import { createVanEditorSource } from '../lib/main/vanEditorSource.mjs';
import { vanEditorFrame } from '../lib/main/vanEditorFrame.mjs';

const route = useRoute();
const source = ref('');
const error = ref('');
const frame = ref<HTMLIFrameElement>();

async function flushFrame() {
  try {
    const child = frame.value?.contentWindow as any;
    const host = child?.document.querySelector('[data-desq-editor]');
    await child?.DesqVanEditor?.getEditor(host)?.flush();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause);
    return false;
  }
}
onBeforeRouteLeave(flushFrame);
onBeforeRouteUpdate(flushFrame);

watch(() => route.params.id, async (id, _previous, onCleanup) => {
  let cancelled = false;
  const sourceKey = crypto.randomUUID();
  const registry = (window as any).DesqVanSources ||= {};
  onCleanup(() => { cancelled = true; delete registry[sourceKey]; });
  source.value = '';
  error.value = '';
  try {
    const fileId = String(id);
    await flushPendingTextSave();
    await flushPendingDexieSaves();
    const file = await loadFileFromDexie(fileId);
    if (!file) throw Error('This file is not available in this browser.');
    const documentSource = createVanEditorSource(file);
    const header = await documentSource.getHeader();
    if (cancelled) return;
    registry[sourceKey] = documentSource;
    const runtimeURL = new URL(`${import.meta.env.BASE_URL}editor-vanjs.js?v=${Date.now()}`, location.origin).href;
    if (!cancelled) source.value = vanEditorFrame(header, runtimeURL, sourceKey);
  } catch (cause) {
    if (!cancelled) error.value = cause instanceof Error ? cause.message : String(cause);
  }
}, { immediate: true });
</script>

<template>
  <main class="van-editor-page">
    <iframe v-if="source" ref="frame" :srcdoc="source" title="VanJS document editor" />
    <p v-else role="status">{{ error || 'Loading document in VanJS editor…' }}</p>
  </main>
</template>

<style scoped>
.van-editor-page { position: fixed; inset: 0; background: white; }
iframe { display: block; width: 100%; height: 100%; border: 0; }
p { padding: 24px; }
</style>
