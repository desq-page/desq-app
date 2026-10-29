<template>
  <DialogBase title="Slide Size">
    <div class="size-panel">
      <p class="description">Set the size for all slides in this presentation.</p>

      <div class="orientation-label">Orientation</div>
      <div class="orientation-buttons" role="group" aria-label="Slide orientation">
        <NButton :type="orientation === 'landscape' ? 'primary' : 'default'" :disabled="saving" @click="setOrientation('landscape')">
          Landscape
        </NButton>
        <NButton :type="orientation === 'portrait' ? 'primary' : 'default'" :disabled="saving" @click="setOrientation('portrait')">
          Portrait
        </NButton>
      </div>

      <label class="dimension-label" for="slide-width">Width (px)</label>
      <NInputNumber v-model:value="width" :input-props="{ id: 'slide-width', 'aria-label': 'Width (px)' }" :min="1" :show-button="false" :disabled="saving" />
      <label class="dimension-label" for="slide-height">Height (px)</label>
      <NInputNumber v-model:value="height" :input-props="{ id: 'slide-height', 'aria-label': 'Height (px)' }" :min="1" :show-button="false" :disabled="saving" />

      <p class="description">Changing the slide size does not resize or reposition existing content.</p>
      <NButton type="primary" :disabled="!valid || !changed || saving" :loading="saving" @click="applySize">Apply</NButton>
    </div>
  </DialogBase>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { NButton, NInputNumber } from "naive-ui";
import { getFileInfo, updateFile } from "shared-vuejs/editor";
import { saveDexie, flushPendingDexieSaves } from "shared-vuejs/api/dbutils";
import { flushPendingTextSave } from "shared-vuejs/api/updateText";
import { showError } from "shared-vuejs/api/utils";
import DialogBase from "@/components/common/Layouts/DialogBase.vue";

const width = ref<number | null>(getFileInfo().width);
const height = ref<number | null>(getFileInfo().height);
const saving = ref(false);
const valid = computed(() => typeof width.value === 'number' && Number.isFinite(width.value) && width.value >= 1 &&
  typeof height.value === 'number' && Number.isFinite(height.value) && height.value >= 1);
const changed = computed(() => width.value !== getFileInfo().width || height.value !== getFileInfo().height);
const orientation = computed(() => !valid.value || width.value === height.value ? null : width.value! > height.value! ? 'landscape' : 'portrait');

function setOrientation(value: 'landscape' | 'portrait') {
  if (!valid.value || !orientation.value || orientation.value === value) return;
  [width.value, height.value] = [height.value, width.value];
}

async function applySize() {
  if (!valid.value || !changed.value || saving.value) return;
  saving.value = true;
  try {
    const fileId = getFileInfo().id;
    await flushPendingTextSave();
    await flushPendingDexieSaves();
    if (getFileInfo().id !== fileId) throw new Error("The open presentation changed.");
    updateFile({ width: width.value, height: height.value });
    await saveDexie();
    await flushPendingDexieSaves();
    location.reload();
  } catch (error) {
    showError(error instanceof Error ? error.message : String(error));
    saving.value = false;
  }
}
</script>

<style scoped>
.size-panel { display: flex; flex-direction: column; gap: 10px; padding: 8px 0; }
.description { margin: 0 0 4px; color: #666; font-size: 12px; line-height: 1.5; }
.orientation-label, .dimension-label { font-size: 13px; font-weight: 500; }
.orientation-buttons { display: flex; gap: 8px; margin-bottom: 6px; }
.size-panel > .n-input-number { width: 100%; }
.size-panel > .n-button { align-self: flex-start; }
</style>
