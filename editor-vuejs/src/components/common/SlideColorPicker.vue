<template>
  <NPopover
    v-model:show="showPicker"
    trigger="click"
    placement="bottom-start"
    :show-arrow="false"
    :destroy-on-hide="false"
    :content-style="hideSlidePicker ? { display: 'none' } : undefined"
  >
    <template #trigger>
      <button
        type="button"
        class="slide-color-trigger"
        ref="slideColorTrigger"
        :aria-label="title || 'Choose color'"
        :title="title || 'Choose color'"
        @click="hideSlidePicker = false"
      >
        <span
          class="color-preview"
          :style="{ backgroundColor: curColor || 'transparent' }"
        ></span>
        <span v-if="!hideHexLabel" class="trigger-label">{{ hexLabel }}</span>
        <span class="trigger-arrow" aria-hidden="true">▾</span>
      </button>
    </template>

    <div class="slide-color-content">
      <StandardColors
        :on-change="chooseColor"
        :show-no-color="showNoColor"
        hide-recent-colors
      />
      <div v-if="showAlpha" class="opacity-control">
        <div class="subtitle">Opacity</div>
        <div class="opacity-value">
          <input
            class="opacity-slider"
            type="range"
            min="0"
            max="100"
            step="1"
            :value="alphaPercent"
            aria-label="Opacity"
            @input="setOpacity"
          />
          <div class="opacity-value">
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              :value="alphaPercent"
              aria-label="Opacity percentage"
              @change="setOpacity"
            />
            <span>%</span>
          </div>
        </div>
      </div>
      <div class="color-actions">
        <NButton
          v-if="ue.chrome"
          class="eyedropper-button"
          quaternary
          circle
          size="small"
          title="Color Picker"
          aria-label="Pick a color from the screen"
          @click="pickWithEyedropper"
        >
          <template #icon>
            <NIcon>
              <Eyedropper24Filled />
            </NIcon>
          </template>
        </NButton>
        <NButton class="more-colors-button" default @click="openCustomPicker">
          <template #icon>
            <NIcon>
              <ColorPalette />
            </NIcon>
          </template>
          More Colors...
        </NButton>
      </div>
    </div>
  </NPopover>

  <Teleport to="body">
    <div
      v-if="customPickerActive"
      class="custom-picker-anchor"
      :style="customPickerAnchorStyle"
    >
      <PickColor
        ref="customPicker"
        :cur-color="curColor"
        :on-color-change="chooseCustomColor"
        :show-alpha="showAlpha"
        @close="closeCustomPicker"
      />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { NButton, NIcon, NPopover } from "naive-ui";
import { Eyedropper24Filled } from "@vicons/fluent";
import StandardColors from "./StandardColors.vue";
import PickColor from "./PickColor.vue";
import { array2hex, color2array } from "shared-vuejs/api/colorUtils";
import { ColorPalette } from "@vicons/carbon";
import { ue } from "shared-vuejs/api/globalUtility";

const props = defineProps({
  curColor: { type: String, default: "#000000" },
  onChange: Function,
  showNoColor: Boolean,
  showAlpha: Boolean,
  title: String,
  hideHexLabel: Boolean,
});

const showPicker = ref(false);
const hideSlidePicker = ref(false);
const slideColorTrigger = ref<HTMLButtonElement | null>(null);
const customPicker = ref<any>(null);
const customPickerActive = ref(false);
const customPickerAnchorStyle = ref<Record<string, string>>({});
const hexLabel = computed(() => {
  const channels = color2array(props.curColor || "#000000");
  if (channels.length < 3) return "#000000";
  return array2hex(channels.slice(0, 3)).toUpperCase();
});
const alphaPercent = computed(() => {
  const channels = color2array(props.curColor || "#000000");
  const alpha = channels[3] ?? 1;
  return Math.round(Math.max(0, Math.min(1, alpha)) * 100);
});

async function chooseColor(color: string) {
  await props.onChange?.(color);
  showPicker.value = false;
}

async function chooseCustomColor(color: string) {
  await props.onChange?.(color);
}

async function openCustomPicker() {
  const rect = slideColorTrigger.value?.getBoundingClientRect();
  if (!rect) return;
  customPickerAnchorStyle.value = {
    position: "fixed",
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    opacity: "0",
    pointerEvents: "none",
    zIndex: "-1",
  };
  hideSlidePicker.value = true;
  customPickerActive.value = true;
  await nextTick();
  customPicker.value?.openPicker();
}

function closeCustomPicker() {
  customPickerActive.value = false;
  hideSlidePicker.value = false;
  showPicker.value = false;
}

async function setOpacity(event: Event) {
  const percent = Math.max(
    0,
    Math.min(100, Number((event.target as HTMLInputElement).value) || 0),
  );
  const channels = color2array(props.curColor || "#000000");
  const [red, green, blue] = channels.length >= 3 ? channels : [0, 0, 0];
  await props.onChange?.(array2hex([red, green, blue, percent / 100]));
}

async function pickWithEyedropper() {
  try {
    const eyeDropper = new window["EyeDropper"]();
    const result = await eyeDropper.open();
    await chooseColor(result.sRGBHex);
  } catch (err) {
    console.error("Error picking color: ", err);
  }
}
</script>

<style scoped>
.slide-color-trigger {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 32px;
  padding: 4px 8px;
  color: inherit;
  background: var(--n-color, #fff);
  border: 1px solid var(--n-border-color, #d9d9d9);
  border-radius: 3px;
  cursor: pointer;
  width: 120px;
}

.color-preview {
  width: 20px;
  height: 20px;
  border: 1px solid #aaa;
  box-sizing: border-box;
}

.trigger-label {
  font-size: 13px;
}

.trigger-arrow {
  margin-left: 3px;
  font-size: 11px;
}

.slide-color-content {
  width: 280px;
}

.more-colors-button {
  margin: 0;
  cursor: pointer;
}

.color-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  margin: 20px 5px 0;
}

.opacity-control {
  gap: 8px;
  margin: 10px 5px 0;
  font-size: 12px;
}

.opacity-slider {
  flex: 1;
  min-width: 0;
}

.opacity-value {
  display: flex;
  align-items: center;
  gap: 3px;
}

.opacity-value input {
  box-sizing: border-box;
  width: 48px;
  padding: 3px 4px;
  text-align: right;
}

.slide-color-content :deep(.colorSection) {
  justify-content: flex-end;
  margin-top: 8px;
}

.custom-picker-anchor {
  overflow: visible;
}
</style>
