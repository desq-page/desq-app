<template>
  <div class="palette" @contextmenu.prevent>
    <div class="subtitle">Theme Colors</div>
    <div class="theme-colors">
      <div v-for="column in themeColors" :key="column.key" class="theme-column">
        <button
          v-for="(color, index) in column.colors"
          :key="index"
          type="button"
          class="colorbutton"
          :class="{ 'theme-base': index === 0 }"
          :style="{ background: color }"
          :title="`${column.label}${index ? `, shade ${index}` : ''}: ${color.toUpperCase()}`"
          :aria-label="`${column.label}${index ? `, shade ${index}` : ''}: ${color.toUpperCase()}`"
          @pointerdown.prevent="(e) => swatchClick(e, color)"
          @click="(e) => e.detail === 0 && swatchClick(e, color)"
        ></button>
      </div>
    </div>
    <div class="subtitle">Standard Colors</div>
    <div class="standard-colors">
      <button
        v-for="color in standardColors"
        :key="color"
        type="button"
        class="colorbutton"
        :style="{ background: color }"
        :title="color"
        :aria-label="color"
        @pointerdown.prevent="(e) => swatchClick(e, color)"
        @click="(e) => e.detail === 0 && swatchClick(e, color)"
      ></button>
    </div>
    <button
      v-if="showNoColor"
      type="button"
      class="no-color-option"
      @click="(e) => swatchClick(e, '')"
    >
      <span class="colorbutton noColor"></span>No color
    </button>
    <template v-if="!hideRecentColors && recentColors.length">
      <div class="subtitle">Recent Colors (right click to remove)</div>
      <div class="colorbar">
        <button
          v-for="color in recentColors"
          :key="color"
          type="button"
          class="colorbutton"
          :style="{ background: color }"
          :title="color.toUpperCase()"
          :aria-label="color.toUpperCase()"
          @pointerdown.prevent="(e) => swatchClick(e, color)"
          @click="(e) => e.detail === 0 && swatchClick(e, color)"
        ></button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { updateFile, getTheme, getFileInfo } from "shared-vuejs/editor";

import { computed, nextTick, ref } from "vue";
import { piniaSlides } from "@/lib/common/store";
import {
  applyLuminance,
  mapStyleThemeColor,
} from "shared-vuejs/api/colorUtils";
import { saveDexie } from "shared-vuejs/api/dbutils";


const props = defineProps({
  onChange: Function,
  showNoColor: Boolean,
  hideRecentColors: Boolean,
});

const standardColors = [
  "#C00000",
  "#FF0000",
  "#FFC000",
  "#FFFF00",
  "#92D050",
  "#00B050",
  "#00B0F0",
  "#0070C0",
  "#002060",
  "#7030A0",
];
const themeSlots = [
  { key: "lt1", label: "Background 1", fallback: "#FFFFFF" },
  { key: "dk1", label: "Text 1", fallback: "#000000" },
  { key: "lt2", label: "Background 2", fallback: "#E7E6E6" },
  { key: "dk2", label: "Text 2", fallback: "#44546A" },
  ...["#4472C4", "#ED7D31", "#A5A5A5", "#FFC000", "#5B9BD5", "#70AD47"].map(
    (fallback, i) => ({
      key: `accent${i + 1}`,
      label: `Accent ${i + 1}`,
      fallback,
    }),
  ),
];
const slides = piniaSlides();
const themeColors = computed(() => {
  // The theme itself is not reactive; these store signals track slide/theme changes.
  void slides.slideId;
  void slides.sldState;
  void slides.masterView;
  const theme = getTheme();
  return themeSlots.map((slot) => {
    const entry = theme?.clrScheme?.[slot.key]?.uniClr;
    const color =
      (entry && mapStyleThemeColor(entry, theme, null)) || slot.fallback;
    // Office uses special shade ramps for very light and very dark colors.
    const channels =
      color
        .replace("#", "")
        .match(/.{2}/g)
        ?.slice(0, 3)
        .map((channel) => parseInt(channel, 16)) || [];
    const lightness = (Math.max(...channels) + Math.min(...channels)) / 510;
    const amounts =
      lightness > 0.95
        ? [-0.05, -0.15, -0.25, -0.35, -0.5]
        : lightness < 0.05
          ? [0.5, 0.35, 0.25, 0.15, 0.05]
          : lightness > 0.8
            ? [-0.1, -0.25, -0.5, -0.75, -0.9]
            : lightness < 0.2
              ? [0.9, 0.75, 0.5, 0.25, 0.1]
              : [0.8, 0.6, 0.4, -0.25, -0.5];
    return {
      ...slot,
      colors: [
        color,
        ...amounts.map((amount) =>
          applyLuminance(color, 1 - Math.abs(amount), Math.max(0, amount)),
        ),
      ],
    };
  });
});
const recentColors = ref<string[]>(
  Array.from(getFileInfo()?.colors || []).filter(
    (color): color is string => typeof color === "string" && !!color,
  ),
);

async function swatchClick(e: MouseEvent, color: string) {
  if (e.button !== 0 && e.button !== 2) return;
  const colors: string[] = Array.from(getFileInfo()?.colors || []);
  if (e.button === 2) {
    const idx = colors.indexOf(color);
    if (idx < 0) return;
    colors.splice(idx, 1);
  } else {
    if (color && !colors.includes(color)) colors.push(color);
    if (props.onChange) await props.onChange(color);
  }
  await nextTick();
  updateFile({ colors });
  recentColors.value = colors.filter(Boolean);
  saveDexie();
}
</script>

<style scoped>
.palette {
  padding: 0 5px;
}
.theme-colors,
.standard-colors {
  display: grid;
  grid-template-columns: repeat(10, minmax(0, 1fr));
  gap: 4px;
}
.theme-column {
  display: flex;
  flex-direction: column;
}
.colorbutton {
  display: block;
  box-sizing: border-box;
  width: 100%;
  height: 20px;
  padding: 0;
  cursor: pointer;
  border: 1px solid #ccc;
  border-radius: 0;
}
.theme-base {
  margin-bottom: 6px;
}
.colorbutton:hover,
.colorbutton:focus-visible {
  outline: 2px solid #0078d4;
  z-index: 1;
}
.colorbar {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.colorbar .colorbutton,
.no-color-option .colorbutton {
  width: 20px;
}
.no-color-option {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.noColor {
  background: linear-gradient(
    to top left,
    transparent calc(50% - 1px),
    #c00 50%,
    transparent calc(50% + 1px)
  );
}
.subtitle {
  font-size: 14px;
  font-weight: bold;
  margin: 10px 0 6px;
}
</style>
