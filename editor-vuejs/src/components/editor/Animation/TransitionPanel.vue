<template>
  <DialogBase :tabbar-items="animationTabbarItems" bottom-border>
    <LayoutHeader label="Type" />
    <div class="trans-cont">
      <n-radio
        class="trans-item"
        :checked="!transition"
        value=""
        name="basic-demo"
        @change="handleChange"
      >
        None
      </n-radio>
      <n-radio
        class="trans-item"
        :checked="transition === 'fade'"
        value="fade"
        name="basic-demo"
        @change="handleChange"
      >
        Fade
      </n-radio>
      <n-radio
        class="trans-item"
        :checked="transition === 'morph'"
        value="morph"
        name="basic-demo"
        label="Morph"
        @change="handleChange"
      />
      <n-radio
        class="trans-item"
        :checked="transition === 'pageCurlDouble'"
        value="pageCurlDouble"
        name="basic-demo"
        @change="handleChange"
      >
        Page Turn
      </n-radio>
      <n-radio
        class="trans-item"
        :checked="transition === 'push'"
        value="push"
        name="basic-demo"
        label="Push"
        @change="handleChange"
      />
      <n-radio
        v-for="option in additionalTransitions"
        :key="option.value"
        class="trans-item"
        :checked="transition === option.value"
        :value="option.value"
        name="basic-demo"
        :label="option.label"
        @change="handleChange"
      />
    </div>

    <template v-if="['wipe', 'cover', 'pull', 'reveal', 'split'].includes(transition)">
      <LayoutHeader label="Direction" />
      <NSelect :value="direction" :options="directionOptions" @update:value="updateDirection" />
    </template>
    <template v-if="['split', 'randomBar'].includes(transition)">
      <LayoutHeader label="Orientation" />
      <NSelect :value="orientation" :options="[{ label: 'Horizontal', value: 'horz' }, { label: 'Vertical', value: 'vert' }]" @update:value="updateOrientation" />
    </template>

    <LayoutHeader label="Duration (sec.)" />

    <RangeSlider
      :value="transitionTime"
      :min="0.25"
      :max="10"
      :step="0.25"
      :on-input="updateTransitionTime"
      :on-change="saveTransitionTime"
      :style="{
        marginTop: '10px',
      }"
      :disabled="!transition"
      :marks="{ 1: '', 2: '', 3: '', 4: '', 5: '', 6: '', 7: '', 8: '', 9: '' }"
    />

    <LayoutHeader label="Advance" />

    <ToolbarItemSwitch
      :default-val="!!clickToAdvance"
      label="On mouse click"
      :onClick="updateClickToAdvance"
    />

    <div class="field-info">
      <ToolbarItemSwitch
        :default-val="autoAdvance !== ''"
        label="After (sec.)"
        :onClick="() => updateAutoadvance(autoAdvance === '' ? 0 : '')"
      />
      <br />
      <RangeSlider
        :value="autoAdvance || 0"
        :min="0"
        :step="0.25"
        :max="10"
        :disabled="autoAdvance === ''"
        :onInput="
          (val) => {
            autoAdvance = val;
            updateMultiple();
          }
        "
        :style="{
          maxWidth: '100px',
          margin: '10px 0 0 -50px',
        }"
      />
    </div>
  </DialogBase>
</template>
<script setup lang="ts">
import { markSlideMetadataDirty, getSlidesCalcSlideIndex, getSlidesMultiSelected, getSlidesSlideId, getFileInfo, getSlideInfo, setSlidesSldState, setStaticSlidesFileMetadataDirty } from "shared-vuejs/editor";

import RangeSlider from "@/components/common/RangeSlider.vue";
import { piniaSlides } from "@/lib/common/store";
import { NRadio, NSelect } from "naive-ui";
import { computed, onMounted, ref, watch } from "vue";
import ToolbarItemSwitch from "../Toolbars/ToolbarItemSwitch.vue";
import DialogBase from "@/components/common/Layouts/DialogBase.vue";
import LayoutHeader from "@/components/common/Layouts/LayoutHeader.vue";
import { animationTabbarItems } from "./animationTabbar";
import { saveDexie } from "shared-vuejs/api/dbutils";


const additionalTransitions = [
  { label: 'Cut', value: 'cut' }, { label: 'Wipe', value: 'wipe' },
  { label: 'Split', value: 'split' }, { label: 'Reveal', value: 'reveal' },
  { label: 'Random Bars', value: 'randomBar' }, { label: 'Circle', value: 'circle' },
  { label: 'Diamond', value: 'diamond' }, { label: 'Plus', value: 'plus' },
  { label: 'Cover', value: 'cover' }, { label: 'Uncover', value: 'pull' },
  { label: 'Flash', value: 'flash' },
];
const direction = ref('l');
const orientation = ref('horz');
const directionOptions = computed(() => transition.value === 'split'
  ? [{ label: 'In', value: 'in' }, { label: 'Out', value: 'out' }]
  : [{ label: 'Left', value: 'l' }, { label: 'Right', value: 'r' },
    ...(transition.value === 'reveal' ? [] : [{ label: 'Up', value: 'u' }, { label: 'Down', value: 'd' }]),
    ...(['cover', 'pull'].includes(transition.value) ? [
      { label: 'Up Left', value: 'lu' }, { label: 'Up Right', value: 'ru' },
      { label: 'Down Left', value: 'ld' }, { label: 'Down Right', value: 'rd' },
    ] : [])]);
function updateDirection(value) { direction.value = value; updateMultiple(); }
function updateOrientation(value) { orientation.value = value; updateMultiple(); }

const transition = ref("");
const transitionTime = ref(1);
const clickToAdvance = ref(0);
const autoAdvance = ref("");

onMounted(updateTran);

watch(
  () => [piniaSlides().slideId, piniaSlides().sldState],
  () => {
    setTimeout(updateTran, 100);
  },
);

function updateTran() {
  const fileInfo = getFileInfo();

  const tr = fileInfo.slides[getSlidesCalcSlideIndex() - 1]?.transition; // getSlideInfo()?.transition;
  transition.value = tr?.ef
    ? (['fade', 'morph', 'pageCurlDouble', 'push', ...additionalTransitions.map(option => option.value)].includes(tr.ef) ? tr.ef : 'fade')
    : null;
  direction.value = tr?.dir || (tr?.ef === 'split' ? 'out' : 'l');
  orientation.value = tr?.orient || (tr?.ef === 'randomBar' ? tr?.dir : '') || 'horz';
  transitionTime.value = tr?.dur || 1;
  clickToAdvance.value = tr?.advClick ?? 0;
  autoAdvance.value = tr?.advTm ?? "";
}

function handleChange(e) {
  transition.value = e.target.value;
  direction.value = transition.value === "split" ? "out" : "l";
  updateMultiple();
}

function updateMultiple() {
  let sldList = getSlidesMultiSelected();

  if (sldList.length == 0) {
    sldList = [getSlidesSlideId()];
  }

  const fileInfo = getFileInfo();

  // const fileId = fileInfo.id;
  sldList.forEach(async (sldId) => {
    const sldInfo = fileInfo.slides.find((sld) => sld.id == sldId);
    const tran = genNewTransition(
      transitionTime.value,
      transition.value,
      clickToAdvance.value,
      autoAdvance.value,
      sldInfo.transition,
    );

    sldInfo.transition = tran;
    if (getSlideInfo()?.id === sldId) {
      getSlideInfo().transition = tran;
      markSlideMetadataDirty();
    }
  });

  setStaticSlidesFileMetadataDirty(true);

  saveDexie();

  setSlidesSldState(Math.random());
}

function genNewTransition(dur, ef, advClick, auto, existing) {
  return {
    ...existing, //copy exisitng
    ef,
    ...(['wipe', 'cover', 'pull', 'reveal', 'split'].includes(ef) ? { dir: direction.value } : {}),
    ...(['split', 'randomBar'].includes(ef) ? { orient: orientation.value } : {}),
    dur,
    advClick,
    advTm: auto === "" ? null : auto ?? null,
  };
}

function updateTransitionTime(val) {
  transitionTime.value = val;
  updateMultiple();
}

function updateAutoadvance(val) {
  autoAdvance.value = val;
  updateMultiple();
}

function updateClickToAdvance(val) {
  clickToAdvance.value = val ? 1 : 0;
  updateMultiple();
}

function saveTransitionTime(val) {
  transitionTime.value = val;
  updateMultiple();
}
</script>
<style scoped>
.trans-cont {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 10;
}

.trans-item {
  margin: 5px 0;
}

.field-info {
  font-size: 14px;
  display: flex;
  justify-content: start;
  align-items: center;
}
</style>
