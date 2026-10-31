<template>
  <div
    class="eff-info"
    :class="{
      disabled: disabled || !effInfo,
    }"
  >
    <div class="eff-title">
      <ToolbarItem
        text
        :icon="
          effInfo?.type == 1
            ? StarArrowRightStart24Regular
            : effInfo?.type == 2
              ? StarEmphasis24Regular
              : effInfo?.type == 3
                ? StarArrowRightEnd24Regular
                : effInfo?.type == 4
                  ? StarEdit24Regular
                  : effInfo?.type == 5
                    ? PlayCircle24Regular
                    : undefined
        "
        :size="20"
        buttonSize="tiny"
        :color="
          effInfo?.type == 1
            ? 'green'
            : effInfo?.type == 2
              ? '#FFA500'
              : effInfo?.type == 3
                ? 'red'
                : effInfo?.type == 4
                  ? 'purple'
                  : effInfo?.type == 5
                    ? 'blue'
                    : ''
        "
        :style="{
          cursor: 'default',
          marginLeft: '-10px',
          width: '100px',
        }"
        :label="effInfo?.type == 4 ? 'Motion' : effInfo?.l || 'None selected'"
      />

      <NFlex :size="0" inline :wrap="false">
        <ToolbarItem
          quaternary
          buttonType="primary"
          buttonSize="small"
          :active="tab == 'timing'"
          :onClick="() => (tab = 'timing')"
          label="Timing"
        />
        <ToolbarItem
          quaternary
          buttonType="primary"
          buttonSize="small"
          :active="tab == 'opts'"
          :onClick="() => (tab = 'opts')"
          label="Options"
        />
      </NFlex>
    </div>

    <template v-if="tab == 'timing'">
      <div class="anim-field">
        <span>Trigger By</span>
        <select @change="(e) => updateTrigger((e?.target as any)?.value || '')">
          <option value="" :selected="!effData?.eff?.trs">Main Sequence</option>
          <option disabled>----------Shapes--------</option>
          <template v-for="shp in getSlideInfo().shapes" :key="shp.id">
            <option :value="shp.id" :selected="effData?.eff?.trs == shp.id" class="anim-option">
              {{ shp.children && shp.container ? "Container: " : "" }}
              {{ clipName(shp.name) }}
            </option>
            <template v-if="shp.children && shp.container">
              <option
                v-for="cshp in shp.children"
                :key="cshp.id"
                :value="cshp.id"
                :selected="effData?.eff?.trs == cshp.id"
              >
                ⇒ {{ clipName(cshp.name) }}
              </option>
            </template>
          </template>
          <!-- <option disabled>----------Set Condition--------</option>
          <option
            value="var:condition"
            :selected="effData?.eff?.trs == 'var:condition'"
            class="anim-option"
          >
            + New Condition
          </option> -->
          <!-- <option
            v-for="vr in varList"
            :key="vr"
            :value="'var:' + vr"
            :selected="effData?.eff?.trs == 'var:' + vr"
          >
            {{ vr }}
          </option> -->
        </select>
      </div>
      <div class="anim-field">
        <span>Start</span>
        <NRadioGroup
          size="small"
          :value="effData?.eff?.tr"
          @change="
            (e) =>
              updateEff?.({
                tr: +(e?.target as any)?.value || 1,
              })
          "
        >
          <NRadioButton :value="1" size="small">
            <NTooltip>
              <template #trigger>
                <NIcon><MousePointer /></NIcon>
              </template>
              On Click
            </NTooltip>
          </NRadioButton>
          <NRadioButton :value="2" size="small">
            <NTooltip>
              <template #trigger>
                <NIcon><Equals /></NIcon>
              </template>
              With Previous
            </NTooltip>
          </NRadioButton>
          <NRadioButton :value="3" size="small">
            <NTooltip>
              <template #trigger>
                <NIcon><Clock /></NIcon>
              </template>
              After Previous
            </NTooltip>
          </NRadioButton>
        </NRadioGroup>
        <!-- <select
          @change="
            (e) =>
              updateEff?.({
                tr: +(e?.target as any)?.value || 1,
              })
          "
        >
          <option value="1" :selected="effData?.eff?.tr == 1">On click</option>
          <option value="2" :selected="effData?.eff?.tr == 2">
            With previous
          </option>
          <option value="3" :selected="effData?.eff?.tr == 3">
            After previous
          </option>
        </select> -->
      </div>
      <div class="anim-field">
        <span>Duration</span>
        <RangeSlider
          :value="effData?.eff?.du"
          :min="0"
          :step="0.1"
          :max="10"
          :onInput="
            (val) =>
              updateEff?.({
                du: val,
              })
          "
          :style="{
            maxWidth: '200px',
          }"
        />
      </div>
      <div class="anim-field">
        <span>Delay</span>
        <RangeSlider
          :value="effData?.eff?.dl"
          :min="0"
          :max="10"
          :step="0.1"
          :onInput="
            (val) =>
              updateEff?.({
                dl: val,
              })
          "
          :style="{
            maxWidth: '200px',
          }"
        />
      </div>
    </template>
    <template v-if="tab == 'opts'">
      <div class="anim-field" v-if="effInfo?.pv">
        <span>{{ effInfo?.pn || "Property" }}</span>
        <SlideColorPicker
          :cur-color="effData?.eff?.bh?.[0]?.color || '#ffffff'"
          :on-change="(val) => updatePropval(val || '#ffffff')"
          v-if="effInfo?.pv == 'color'"
        />
        <select
          @change="(e) => updatePropval((e?.target as any)?.value || 0)"
          v-else
        >
          <option
            v-for="pv in effInfo?.pv"
            :key="pv.v"
            :value="pv.v"
            :selected="effData?.eff?.prv == pv.v"
          >
            {{ pv.l }}
          </option>
        </select>
      </div>
      <div class="anim-field" v-if="isSmartArt">
        <span>SmartArt Animation</span>
        <select
          :value="effData?.eff?.smartArtAnimation ?? 'one'"
          @change="(e) => updateSmartArt?.((e.target as HTMLSelectElement).value)"
        >
          <option value="one">As one object</option>
          <option value="allAtOnce">All at once</option>
          <option value="oneByOne">One by one</option>
          <option value="levelAtOnce">By level once</option>
          <option value="levelOneByOne">By level one by one</option>
        </select>
      </div>
      <div class="anim-field" v-else>
        <span>Text Animation</span>
        <div class="text-animation-options">
          <select
            :value="effData?.eff?.u ?? 0"
            @change="(e) => updateTextAnimation(Number((e.target as HTMLSelectElement).value))"
          >
            <option :value="0">All at once</option>
            <option :value="2">By word</option>
            <option :value="1">By letters</option>
          </select>
          <NCheckbox
            :checked="!!effData?.eff?.p"
            :disabled="!hasParagraphs"
            :on-update:checked="(checked) => updateParagraphs?.(checked)"
          >by para</NCheckbox>
        </div>
      </div>
      <div class="anim-field">
        <span>Repeat</span>
        <select
          @change="
            (e) =>
              updateEff?.({
                rp: (e.target as any)?.value,
              })
          "
          :value="effData?.eff?.rp ?? 1"
        >
          <option
            v-for="opt in repeatOptions"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }}
          </option>
        </select>
      </div>
      <div class="anim-field">
        <span>Rewind</span>
        <NCheckbox
          :checked="effData?.eff?.rw ? true : false"
          :on-update:checked="
            (val) =>
              updateEff?.({
                rw: val ? 1 : 0,
              })
          "
        />
      </div>
      <div v-if="effData?.eff?.bh?.some((behavior) => behavior.ty === 'play')" class="anim-field">
        <span>Stop media</span>
        <select :value="effData?.eff?.mediaStop ?? ((Number(effData?.eff?.bh?.find((behavior) => behavior.ty === 'play')?.rp) > 1) ? 'span' : 'slide')"
          @change="(e) => updateEff?.({ mediaStop: (e.target as HTMLSelectElement).value })">
          <option value="click">On click</option>
          <option value="slide">End of slide</option>
          <option value="span" :disabled="isVideoMedia">Span across slides</option>
        </select>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { getFileInfo, getSlideInfo, getShapeDeep } from "shared-vuejs/editor";

// import ComboBox from "@/components/common/ComboBox.vue";

import RangeSlider from "@/components/common/RangeSlider.vue";
import defAnimList from "./arrAnimList";
import { effectTimingPatch } from "shared-vuejs/api/animUtils";
import {
  NCheckbox,
  NFlex,
  NIcon,
  NRadioButton,
  NRadioGroup,
  NTooltip,
} from "naive-ui";
import { computed, ref } from "vue";
import { Clock, Equals, MousePointer } from "@vicons/fa";
import {
  PlayCircle24Regular,
  StarArrowRightEnd24Regular,
  StarArrowRightStart24Regular,
  StarEdit24Regular,
  StarEmphasis24Regular,
} from "@vicons/fluent";
import ToolbarItem from "../Toolbars/ToolbarItem.vue";

import SlideColorPicker from "@/components/common/SlideColorPicker.vue";

const props = defineProps({
  effData: Object,
  updateEff: Function,
  updateParagraphs: Function,
  updateSmartArt: Function,
  disabled: Boolean,
  triggerId: String,
  varList: Array as any,
  selectedGrp: Number,
});

const isSmartArt = computed(() => getShapeDeep(props.effData?.eff?.sh)?.type === "diagram");
const isVideoMedia = computed(() => !!getShapeDeep(props.effData?.eff?.sh)?.video);

const hasParagraphs = computed(() => {
  const id = props.effData?.eff?.sh;
  return !!id && !!getShapeDeep(id)?.txBody?.p;
});

function updateTextAnimation(u) {
  props.updateEff?.({
    u,
    ltr: u > 0 ? (props.effData?.eff?.ltr || 0.05) : 0,
  });
}

const repeatOptions = [
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 3, label: "3" },
  { value: 4, label: "4" },
  { value: 5, label: "5" },
  { value: 10, label: "10" },
  { value: 20, label: "20" },
  { value: -1, label: "Until next click" },
  { value: 0, label: "Until end of slide" },
];

// const vars = computed(() => {
//   const vars = getFileInfo().vars?.split(";");
//   return vars?.map((vr) => vr.split("=")[0].trim());
// });

const tab = ref("timing");

const effInfo = computed(() => findEffectInfo(props.effData));

function clipName(name) {
  if (name?.length > 30) {
    return name.slice(0, 30) + "...";
  } else {
    return name;
  }
}

function findEffectInfo(effData) {
  if (!effData) return null;
  const list = defAnimList[effData.type - 1];
  // console.log(list);
  return {
    ...list?.[effData?.eff?.presetID],
    type: effData.type,
  };
}

function updatePropval(val) {
  const sourceInfo = findEffectInfo(props.effData);
  props.updateEff?.((effect) => {
    const defInfo = findEffectInfo({ type: Number(effect.grp) + 1, eff: effect });
    if (!defInfo?.bh || defInfo.pv !== sourceInfo?.pv &&
        !(Array.isArray(defInfo.pv) && Array.isArray(sourceInfo?.pv))) return null;
    // Resolve each selected effect's own preset rather than copying the
    // focused effect's behavior into unrelated animations.
    const defaults = Array.isArray(defInfo.bh) ? defInfo.bh : defInfo.bh[val];
    if (!defaults) return null;
    if (Array.isArray(defInfo.pv) && !defInfo.pv.some(option => String(option.v) === String(val))) return null;
    const bh = JSON.parse(JSON.stringify(defaults));
    if (defInfo.pv === "color" && bh[0]) bh[0].color = val;
    if ((effect.cls === "entr" || effect.grp == 0) && bh[0]?.ty !== "set") {
      bh.unshift({ ty: "set", sp: 1, dl: 0, du: 0, cm: "visibility", v: 1 });
    } else if ((effect.cls === "exit" || effect.grp == 2) && bh.at(-1)?.ty !== "set") {
      const span = Math.max(0, ...bh.map(item => (Number(item.dl) || 0) +
        (Number(item.du) || 0) * ((item.rv ?? effect.rv) ? 2 : 1)));
      bh.push({ ty: "set", sp: 1, dl: span, du: 0, cm: "visibility", v: 0 });
    }
    const timing = effectTimingPatch({ ...effect, bh }, { du: effect.du });
    return { prv: val, bh: timing.bh || bh };
  });
}

function updateTrigger(val) {
  props.updateEff?.({
    trs: val,
  });
}
</script>
<style scoped>
.eff-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.eff-info {
  margin-top: 5px;
  margin-left: -15px;
  max-height: min(70vh, 420px);
  overflow-y: auto;
  width: calc(100% - 32px);
  bottom: 5px;
  position: absolute;
  background: white;
  border-radius: 4px;
  border: 1px solid #ccc;
  padding: 10px;
}

.anim-field {
  margin: 10px 0;
  font-size: 14px;
  display: flex;
  justify-content: space-between;
}

.text-animation-options {
  display: flex;
  align-items: center;
  gap: 8px;
}

select {
  height: 22px;
}
</style>
