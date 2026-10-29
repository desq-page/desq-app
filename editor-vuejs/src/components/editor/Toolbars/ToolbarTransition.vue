<template>
  <div class="transition-toolbar">
    <div class="effects" aria-label="Slide transition">
      <NButton
        v-for="effect in effects"
        :key="effect.value"
        :type="transition.ef === effect.value || (!transition.ef && !effect.value) ? 'primary' : 'default'"
        :secondary="transition.ef === effect.value || (!transition.ef && !effect.value)"
        :aria-pressed="transition.ef === effect.value || (!transition.ef && !effect.value)"
        :disabled="disabled"
        class="effect-button"
        @click="updateTransition({ ef: effect.value })"
      >
        <span class="effect-content"><NIcon :size="25"><component :is="effect.icon" /></NIcon>{{ effect.label }}</span>
      </NButton>
      <NDropdown trigger="click" :options="basicOptions" :value="transition.ef || null" :disabled="disabled"
        @select="value => updateTransition({ ef: value })">
        <NButton class="effect-button" :disabled="disabled"
          :type="basicSelected ? 'primary' : 'default'" :secondary="basicSelected"
          :aria-pressed="basicSelected" aria-label="Basic transitions">
          <span class="effect-content"><NIcon :size="25"><LayoutGrid /></NIcon>Basic</span>
          <template #icon><NIcon><ChevronDown /></NIcon></template>
        </NButton>
      </NDropdown>
      <NDropdown trigger="click" :options="excitingOptions" :value="transition.ef || null" :disabled="disabled"
        @select="value => updateTransition({ ef: value })">
        <NButton class="effect-button" :disabled="disabled"
          :type="excitingSelected ? 'primary' : 'default'" :secondary="excitingSelected"
          :aria-pressed="excitingSelected" aria-label="Exciting transitions">
          <span class="effect-content"><NIcon :size="25"><Star /></NIcon>Exciting</span>
          <template #icon><NIcon><ChevronDown /></NIcon></template>
        </NButton>
      </NDropdown>
      <NButton class="effect-button" disabled title="Coming soon">
        <span class="effect-content"><NIcon :size="25"><Activity /></NIcon>Dynamic</span>
      </NButton>
    </div>
    <label class="duration-control">
      <span class="group-label">Duration</span>
      <NInputNumber :value="transition.dur ?? 1" :min="0.25" :step="0.25" :precision="2"
        :disabled="disabled || !transition.ef" size="small" style="width: 108px"
        aria-label="Transition duration in seconds" @update:value="updateDuration">
        <template #suffix>s</template>
      </NInputNumber>
    </label>
    <div class="advance-controls" aria-label="Advance slide">
      <span class="group-label">Advance</span>
      <NButton size="small" :type="onClick ? 'primary' : 'default'" :secondary="onClick"
        :theme-overrides="onClick ? undefined : {
          textColor: '#888888', textColorHover: '#888888', textColorPressed: '#888888', textColorFocus: '#888888',
          border: '1px solid #cccccc', borderHover: '1px solid #cccccc', borderPressed: '1px solid #cccccc', borderFocus: '1px solid #cccccc',
        }"
        :aria-pressed="onClick" :disabled="disabled" @click="updateTransition({ advClick: onClick ? 0 : 1 })">
        <template #icon><NIcon><Click /></NIcon></template>On Click
      </NButton>
      <NButton size="small" :type="afterEnabled ? 'primary' : 'default'" :secondary="afterEnabled"
        :theme-overrides="afterEnabled ? undefined : {
          textColor: '#888888', textColorHover: '#888888', textColorPressed: '#888888', textColorFocus: '#888888',
          border: '1px solid #cccccc', borderHover: '1px solid #cccccc', borderPressed: '1px solid #cccccc', borderFocus: '1px solid #cccccc',
        }"
        :aria-pressed="afterEnabled" :disabled="disabled" @click="toggleAfter">
        <template #icon><NIcon><Clock /></NIcon></template>After
      </NButton>
      <NInputNumber :value="afterSeconds" :min="0" :step="0.25" :precision="2"
        :disabled="disabled || !afterEnabled" size="small" style="width: 108px"
        aria-label="Advance after seconds" @update:value="updateSeconds">
        <template #suffix>s</template>
      </NInputNumber>
    </div>
  </div>
</template>

<script setup lang="ts">
import { markSlideMetadataDirty, getSlidesMultiSelected, getFileInfo, getSlideInfo, setSlidesSldState, setStaticSlidesFileMetadataDirty } from "shared-vuejs/editor";

import { computed, h, ref, watch } from "vue";
import { NButton, NDropdown, NIcon, NInputNumber } from "naive-ui";
import { Activity, ArrowBack, ArrowBarRight, ArrowsDiagonal, ArrowsHorizontal, ArrowRight, Bolt, Book, ChevronDown, Circle, Click, Clock, Columns, Diamond, Eye, LayersIntersect, LayoutGrid, Plus, Scissors, SquareHalf, SquareOff, Star } from "@vicons/tabler";
import { Aperture, Blur, BorderAll, Box, Door, FlipHorizontal, Sticker, SwitchHorizontal, ZoomIn } from "@vicons/tabler";
import { piniaSlides } from "@/lib/common/store";

import { saveDexie } from "shared-vuejs/api/dbutils";

const effects = [
  { label: "None", value: "", icon: SquareOff },
  { label: "Morph", value: "morph", icon: ArrowsDiagonal },
  { label: "Fade", value: "fade", icon: SquareHalf },
  { label: "Page Turn", value: "pageCurlDouble", icon: Book },
  { label: "Push", value: "push", icon: ArrowRight },
];
const additionalEffects = [
  { label: "Cut", value: "cut", icon: Scissors },
  { label: "Wipe", value: "wipe", icon: ArrowBarRight },
  { label: "Split", value: "split", icon: ArrowsHorizontal },
  { label: "Reveal", value: "reveal", icon: Eye },
  { label: "Random Bars", value: "randomBar", icon: Columns },
  { label: "Circle", value: "circle", icon: Circle },
  { label: "Diamond", value: "diamond", icon: Diamond },
  { label: "Plus", value: "plus", icon: Plus },
  { label: "Cover", value: "cover", icon: LayersIntersect },
  { label: "Uncover", value: "pull", icon: ArrowBack },
  { label: "Flash", value: "flash", icon: Bolt },
];
const basicOptions = computed(() => additionalEffects.map(effect => ({
  label: effect.label,
  key: effect.value,
  icon: () => h(NIcon, { size: 20 }, { default: () => h(effect.icon) }),
  props: { 'aria-checked': transition.value.ef === effect.value },
})));
const basicSelected = computed(() => additionalEffects.some(effect => effect.value === transition.value.ef));
const excitingEffects = [
  { label: "Cube", value: "prism", icon: Box },
  { label: "Doors", value: "doors", icon: Door },
  { label: "Zoom", value: "warp", icon: ZoomIn },
  { label: "Flip", value: "flip", icon: FlipHorizontal },
  { label: "Switch", value: "switch", icon: SwitchHorizontal },
  { label: "Wheel", value: "wheel", icon: Aperture },
  { label: "CheckerBoard", value: "checker", icon: BorderAll },
  { label: "Peel Off", value: "peelOff", icon: Sticker },
  { label: "Dissolve", value: "dissolve", icon: Blur },
  { label: "Comb", value: "comb", icon: Columns },
  { label: "Fall Over", value: "fallOver", icon: FlipHorizontal },
  { label: "Drape", value: "drape", icon: Door },
  { label: "Wind", value: "wind", icon: ArrowsHorizontal },
  { label: "Honeycomb", value: "honeycomb", icon: LayoutGrid },
  { label: "Glitter", value: "glitter", icon: Star },
  { label: "Vortex", value: "vortex", icon: Aperture },
  { label: "Curtains", value: "curtains", icon: Door },
  { label: "Prestige", value: "prestige", icon: Star },
  { label: "Fracture", value: "fracture", icon: Diamond },
  { label: "Crush", value: "crush", icon: ArrowsHorizontal },
  { label: "Airplane", value: "airplane", icon: ArrowRight },
  { label: "Origami", value: "origami", icon: Sticker },
  { label: "Ripple", value: "ripple", icon: Circle },
  { label: "Shred", value: "shred", icon: Scissors },
  { label: "Gallery", value: "gallery", icon: LayersIntersect },
];
const excitingOptions = computed(() => excitingEffects.map(effect => ({
  label: effect.label,
  key: effect.value,
  icon: () => h(NIcon, { size: 20 }, { default: () => h(effect.icon) }),
  props: { 'aria-checked': transition.value.ef === effect.value },
})));
const excitingSelected = computed(() => excitingEffects.some(effect => effect.value === transition.value.ef));
const transition = ref<any>({});
const afterSeconds = ref(5);
const disabled = computed(() => !piniaSlides().slideId || piniaSlides().masterView);
const onClick = computed(() => Number(transition.value.advClick ?? 1) === 1);
const afterEnabled = computed(() => transition.value.advTm != null && transition.value.advTm !== "");

watch(() => [piniaSlides().slideId, piniaSlides().sldState], () => {
  const slide = getFileInfo()?.slides?.find(item => item.id === piniaSlides().slideId);
  transition.value = { ...(slide?.transition || {}) };
  if (transition.value.ef === 'box') transition.value.ef = 'prism';
  if (transition.value.ef === 'zoom') transition.value.ef = 'warp';
  afterSeconds.value = afterEnabled.value ? Number(transition.value.advTm) : 5;
}, { immediate: true });

function updateTransition(patch: Record<string, any>) {
  if (disabled.value) return;
  const selectedIds = new Set(getSlidesMultiSelected()?.length
    ? getSlidesMultiSelected()
    : [piniaSlides().slideId]);
  const slides = getFileInfo()?.slides?.filter(item => selectedIds.has(item.id));
  if (!slides?.length) return;
  for (const slide of slides) {
    const updated = { dur: 1, advClick: 1, ...slide.transition, ...patch };
    slide.transition = updated;
    if (getSlideInfo()?.id === slide.id) {
      getSlideInfo().transition = updated;
      markSlideMetadataDirty();
    }
    if (piniaSlides().slideId === slide.id) transition.value = { ...updated };
  }
  setStaticSlidesFileMetadataDirty(true);
  setSlidesSldState(Math.random());
  void saveDexie();
}
function toggleAfter() {
  updateTransition({ advTm: afterEnabled.value ? null : afterSeconds.value });
}
function updateSeconds(value: number | null) {
  if (value == null || !Number.isFinite(value)) return;
  afterSeconds.value = value;
  updateTransition({ advTm: value });
}
function updateDuration(value: number | null) {
  if (value == null || !Number.isFinite(value) || value < 0.25) return;
  updateTransition({ dur: value });
}
</script>

<style scoped>
.transition-toolbar { display: flex; align-items: center; gap: 18px; overflow-x: auto; color: #172923; }
.effects { display: flex; gap: 6px; padding: 2px 8px; flex-shrink: 0; }
.effect-button { height: 54px; min-width: 64px; }
.effect-content { display: flex; flex-direction: column; align-items: center; gap: 3px; font-size: 11px; }
.advance-controls { display: flex; align-items: center; gap: 8px; padding-left: 18px; border-left: 1px solid #ddd; flex-shrink: 0; }
.group-label { font-size: 12px; margin-right: 4px; }
.duration-control { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
</style>
