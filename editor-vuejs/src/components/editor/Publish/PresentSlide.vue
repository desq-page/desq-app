<template>
  <div ref="surface" class="presentation" hidden>
    <iframe v-if="url" :src="url" title="Presentation" allowfullscreen @load="focusPlayer" />
    <p v-else role="status">{{ error || "Loading presentation…" }}</p>
    <button class="exit" type="button" @click="close">Exit presentation</button>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from "vue";
import { getSlidesCalcSlideIndex } from "shared-vuejs/editor";
import { saveDexie } from "shared-vuejs/api/dbutils";
import { genPlayerUrl } from "shared-vuejs/api/play";
import { flushPendingTextSave } from "shared-vuejs/api/updateText";
import { piniaInfo } from "@/lib/common/store";

const surface = ref<HTMLDivElement | null>(null);
const url = ref("");
const error = ref("");
let request = 0;
let wasFullscreen = false;

async function start() {
  const element = surface.value;
  if (!element?.hidden) return;
  const current = ++request;
  const slideIndex = Math.max(1, getSlidesCalcSlideIndex());
  piniaInfo().setCurPopup("");
  error.value = "";
  element.hidden = false;
  // Request fullscreen before saving so the click's user activation is available.
  element.requestFullscreen?.().then(() => {
    if (current !== request && document.fullscreenElement === element)
      void document.exitFullscreen().catch(() => {});
  }).catch(() => { /* The presentation stays in a viewport-sized overlay. */ });
  try {
    await flushPendingTextSave();
    await saveDexie();
    if (current === request) url.value = genPlayerUrl({ slideIndex, layoutType: "slide" });
  } catch (cause) {
    if (current === request) error.value = cause instanceof Error ? cause.message : String(cause);
  }
}

function close() {
  request++;
  url.value = "";
  const element = surface.value;
  if (element) element.hidden = true;
  if (element && document.fullscreenElement === element)
    void document.exitFullscreen().catch(() => {});
}

function fullscreenChanged() {
  const fullscreen = !!surface.value && document.fullscreenElement === surface.value;
  if (wasFullscreen && !fullscreen) close();
  wasFullscreen = fullscreen;
}

function focusPlayer(event: Event) {
  (event.currentTarget as HTMLIFrameElement).focus();
}

onMounted(() => document.addEventListener("fullscreenchange", fullscreenChanged));
onBeforeUnmount(() => {
  document.removeEventListener("fullscreenchange", fullscreenChanged);
  close();
});
defineExpose({ start });
</script>

<style scoped>
.presentation {
  position: fixed;
  inset: 0;
  z-index: 5000;
  background: #101622;
  color: white;
}
.presentation:not([hidden]) {
  display: grid;
  place-items: center;
}
iframe {
  width: 100%;
  height: 100%;
  border: 0;
}
.exit {
  position: absolute;
  top: 12px;
  right: 12px;
  padding: 6px 10px;
  border: 0;
  border-radius: 4px;
  background: #202938;
  color: white;
  cursor: pointer;
}
</style>
