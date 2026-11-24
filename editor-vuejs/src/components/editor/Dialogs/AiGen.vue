<template>
  <NModal v-model:show="open" preset="card" :title="translate('AI Gen')"
    :mask-closable="false" :closable="!inserting" :close-on-esc="!inserting"
    style="width: 560px; max-width: calc(100vw - 32px)">
    <div :class="$style.form" @pointerdown.stop @pointerup.stop @keydown.stop @keyup.stop @paste.stop>
      <label for="ai-gen-prompt">{{ translate('Describe the image') }}</label>
      <NInput v-model:value="prompt" type="textarea" placeholder=""
        :input-props="{ id: 'ai-gen-prompt' }"
        :autosize="{ minRows: 3, maxRows: 6 }" :maxlength="1000"
        :disabled="generating || inserting" />
      <div :class="$style.hint">
        {{ translate('NanoDiffuser runs on your browser’s GPU. The first use downloads about 382 MiB.') }}
      </div>
      <div v-if="status" role="status" :class="$style.status">{{ status }}</div>
      <NProgress v-if="generating && percent != null" type="line" :percentage="percent" />
      <img v-if="preview" :src="preview" :alt="translate('Generated image')" :class="$style.preview" />
      <div :class="$style.actions">
        <NButton :loading="generating" :disabled="!prompt.trim() || generating || inserting" @click="generate">
          {{ translate('Generate Image') }}
        </NButton>
        <NButton type="primary" :loading="inserting" :disabled="!image || generating || inserting" @click="insert">
          {{ translate('Insert Image') }}
        </NButton>
      </div>
    </div>
  </NModal>
</template>

<script setup lang="ts">
import { onUnmounted, ref, shallowRef } from "vue";
import { NButton, NInput, NModal, NProgress } from "naive-ui";
import { getFileInfo, getInfoUseGrid, getSlideInfo, getSlidesMasterView } from "shared-vuejs/editor";
import { addImageShape, processImage } from "shared-vuejs/api/upload";
import { saveDexie } from "shared-vuejs/api/dbutils";
import { translate } from "@/lib/i18n";

const open = defineModel<boolean>("show", { required: true });
const prompt = ref("");
const status = ref("");
const percent = ref<number>();
const generating = ref(false);
const inserting = ref(false);
const image = shallowRef<Blob>();
const preview = ref("");
const imageStyle = ""; //"impressionist painting, oil on canvas, visible brushstrokes, soft broken color, luminous atmosphere, delicate painterly texture, elegant composition";
let worker: Worker | undefined;

function clearPreview() {
  if (preview.value) URL.revokeObjectURL(preview.value);
  preview.value = "";
  image.value = undefined;
}

function stopWorker() {
  worker?.terminate();
  worker = undefined;
}

function generate() {
  const description = prompt.value.trim();
  if (!description || generating.value || inserting.value) return;
  generating.value = true;
  percent.value = undefined;
  status.value = translate("Starting NanoDiffuser");
  clearPreview();

  try {
    if (!worker) {
      worker = new Worker(new URL("../../../lib/agent/nanodiffuser.worker.mjs", import.meta.url), { type: "module" });
      worker.onmessage = ({ data }) => {
        if (data.type === "progress") {
          status.value = translate(data.message);
          percent.value = data.percent;
          return;
        }
        generating.value = false;
        if (data.type === "result") {
          image.value = data.image;
          preview.value = URL.createObjectURL(data.image);
          status.value = "";
        } else {
          status.value = translate(data.message);
        }
      };
      worker.onerror = () => {
        stopWorker();
        generating.value = false;
        status.value = translate("NanoDiffuser could not start. Try again.");
      };
    }
    worker.postMessage({ prompt: `${description}, ${imageStyle}` });
  } catch {
    stopWorker();
    generating.value = false;
    status.value = translate("NanoDiffuser could not start. Try again.");
  }
}

async function insert() {
  const file = getFileInfo();
  const slideId = getSlideInfo()?.id;
  if (!image.value || inserting.value || generating.value) return;
  if (!file?.id || !slideId || getSlidesMasterView() || getInfoUseGrid()) {
    status.value = translate("Open a presentation slide to insert the image.");
    return;
  }

  inserting.value = true;
  try {
    const media = await processImage(image.value, { fileId: file.id });
    if (getFileInfo()?.id !== file.id || getSlideInfo()?.id !== slideId) {
      throw new Error("The active presentation or slide changed.");
    }
    if (!addImageShape(media, { x: file.width / 2, y: file.height / 2, fitWithinSlide: true })) {
      throw new Error("Could not insert the image.");
    }
    await saveDexie();
    open.value = false;
  } catch (error) {
    status.value = translate(error.message || "Could not insert the image.");
  } finally {
    inserting.value = false;
  }
}

onUnmounted(() => {
  stopWorker();
  clearPreview();
});
</script>

<style module>
.form { display: grid; gap: 12px; max-height: 75dvh; overflow: auto; }
.form label { font-weight: 600; }
.hint { color: #666; }
.status { overflow-wrap: anywhere; }
.preview { justify-self: center; width: min(100%, 320px); aspect-ratio: 1; object-fit: contain; }
.actions { display: flex; justify-content: flex-end; gap: 8px; }
</style>
