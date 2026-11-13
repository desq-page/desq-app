<script setup>
import { useUrlSearchParams } from "@vueuse/core";
import { onMounted, onUnmounted, ref } from "vue";
import { setupDB } from "shared-vuejs/api/db";
import { createSinglePresentationHtml } from "shared-vuejs/api/presentation-export";

const params = useUrlSearchParams();
const source = ref("");
const error = ref("");
const frame = ref();
let closed = false;
const relay = event => {
  if (window.parent === window) return;
  if (event.source === frame.value?.contentWindow && Number.isInteger(event.data?.slideIndex)) {
    window.parent.postMessage({ slideIndex: event.data.slideIndex }, "*");
  } else if (event.source === frame.value?.contentWindow && event.data?.scriptVariables) {
    window.parent.postMessage({ scriptVariables: event.data.scriptVariables }, "*");
  } else if (event.source === window.parent && ["moveForward", "moveBackward", "gotoSlide", "getVars"].includes(event.data?.cmd)) {
    frame.value?.contentWindow.postMessage(event.data, "*");
  }
};
onMounted(async () => {
  window.addEventListener("message", relay);
  try {
    await setupDB();
    const html = await createSinglePresentationHtml(params.fileId, {
      baseUrl: import.meta.env.BASE_URL,
      initialSlide: Number(params.slideIndex) || 1,
      layoutType: params.layoutType || "",
    });
    if (!closed) source.value = URL.createObjectURL(html);
  } catch (cause) {
    if (!closed) error.value = cause.message;
  }
});
onUnmounted(() => {
  closed = true;
  window.removeEventListener("message", relay);
  if (source.value) URL.revokeObjectURL(source.value);
});
</script>

<template>
  <iframe v-if="source" ref="frame" :src="source" sandbox="allow-scripts" allowfullscreen
    title="Presentation preview" style="position:fixed;inset:0;width:100%;height:100%;border:0" />
  <p v-else role="status">{{ error || "Preparing presentation…" }}</p>
</template>
