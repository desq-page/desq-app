<template>
  <div>
    <LayoutHeader label="Gradient Type" />

    <n-radio-group
      :value="target?.gradFill?.lin ? 'L' : 'R'"
      name="radiogroup"
      :on-update:value="changeGradType"
    >
      <n-radio value="L" label="Linear" />
      <n-radio value="R" label="Radial" />
    </n-radio-group>

    <LayoutHeader label="Stop Colors" />

    <div class="grad-stop-outer">
      <div
        class="grad-stop-inner"
        v-for="(gradStop, grdIdx) in sortedGs"
        :key="grdIdx"
      >
        <NSelect
          v-bind:value="gradStop.$_pos / 1000"
          :options="gradPosOptions"
          class="grad-pos"
          :on-update:value="(val) => changeGradStopPos(val, grdIdx)"
          :disabled="
            false /*grdIdx == 0 || grdIdx == gradStops.length - 1 && gradPos[grdIdx] == 100*/
          "
        />
        <span class="pct">%</span>
        <SlideColorPicker
          :cur-color="mapStopColor(gradStop)"
          :on-change="(val) => changeGradStopColor(val, grdIdx)"
          show-alpha
        />
        <ToolbarItem
          :icon="AddTwotone"
          v-if="grdIdx == 0"
          :on-click="addStop"
        />
        <ToolbarItem
          :icon="ClearOutlined"
          v-if="(grdIdx > 0) & (grdIdx < sortedGs.length - 1)"
          :on-click="() => deleteStop(grdIdx)"
        />
      </div>
    </div>

    <LayoutHeader label="Direction" />

    <div class="gradPreset">
      <template v-if="target?.gradFill?.path">
        <div
          class="gradPresetItem radial"
          :class="{
            selected: checkRadialSelected(gradPreset),
          }"
          :style="{
            background: genGradBg(gradPreset.name),
          }"
          @click="(e) => saveRadialPos(gradPreset.radialPos)"
          v-for="gradPreset in gradRadialPreset"
          :key="gradPreset.name"
        ></div>
      </template>
      <template v-else>
        <div
          v-for="gradPreset in gradLinearPreset"
          :key="gradPreset.name"
          class="gradPresetItem"
          :class="{
            selected: gradPreset.rot == target?.gradFill?.lin?.$_ang / 60000,
          }"
          :style="{
            background: genGradBg(gradPreset.name),
          }"
          @click="(e) => saveLinearRot(gradPreset.rot)"
        >
          {{ gradPreset.rot + "°" }}
        </div>
      </template>
    </div>

    <div v-if="!target?.gradFill?.path" style="margin-bottom: 40px">
      <RangeSlider
        :value="target?.gradFill?.lin?.$_ang / 60000 || 0"
        :min="0"
        :max="360"
        :step="5"
        :on-input="saveLinearRot"
        :on-change="saveLinearRot"
        :format-tooltip="(val) => `${val}°`"
        :show-tooltip="false"
        tooltip-placement="bottom"
        :style="{
          padding: '20px 20px 0 0px',
          width: '90%',
          height: '20px',
        }"
      />
    </div>
  </div>
</template>
<script setup lange="ts">
import { getTheme } from "shared-vuejs/editor";

import { piniaSelect, piniaShapes, piniaSlides } from "@/lib/common/store";
import { NRadioGroup, NRadio, NSelect } from "naive-ui";
import RangeSlider from "@/components/common/RangeSlider.vue";
import { computed } from "vue";
import ToolbarItem from "../Toolbars/ToolbarItem.vue";
import { AddTwotone, ClearOutlined } from "@vicons/material";
import LayoutHeader from "@/components/common/Layouts/LayoutHeader.vue";
import { color2array, mapStyleThemeColor } from "shared-vuejs/api/colorUtils";
import { round } from "shared-vuejs/api/utility";

import { deepUnref } from "@/components/vue-utils/unref";
import SlideColorPicker from "@/components/common/SlideColorPicker.vue";

const props = defineProps({
  type: String,
  target: Object,
  onChange: Function,
});

const gradPosOptions = [];

for (let i = 0; i <= 100; i += 5) {
  gradPosOptions.push({
    value: i,
    label: i,
  });
}

var gradLinearPreset = [
  { name: "right", rot: 0 },
  { name: "bottom right", rot: 45 },
  { name: "bottom", rot: 90 },
  { name: "bottom left", rot: 135 },
  { name: "left", rot: 180 },
  { name: "top left", rot: 225 },
  { name: "top", rot: 270 },
  { name: "top right", rot: 315 },
];
var gradRadialPreset = [
  { name: "top left", radialPos: { t: 0, l: 0, b: 1, r: 1 } },
  { name: "top center", radialPos: { t: 0, l: 0, b: 1, r: 0 } },
  { name: "top right", radialPos: { t: 0, l: 1, b: 1, r: 0 } },
  { name: "left center", radialPos: { t: 0, l: 0, b: 0, r: 1 } },
  { name: "center", radialPos: { t: 1, l: 1, b: 1, r: 1 } },
  { name: "right center", radialPos: { t: 0, l: 1, b: 0, r: 0 } },
  { name: "bottom left", radialPos: { t: 1, l: 0, b: 0, r: 1 } },
  { name: "bottom center", radialPos: { t: 1, l: 0, b: 0, r: 0 } },
  { name: "bottom right", radialPos: { t: 1, l: 1, b: 0, r: 0 } },
];

const sortedGs = computed(() => {
  const sorted = deepUnref(props.target?.gradFill?.gsLst?.gs) || [];
  return sorted.slice().sort((a, b) => +a.$_pos - +b.$_pos);
});

function mapStopColor(gradStop) {
  const rgb = mapStyleThemeColor(gradStop.uniClr, getTheme());
  return rgb;
}

function checkRadialSelected(gradPreset) {
  let fillToRect = props.target.gradFill.path.fillToRect;
  if (!fillToRect) {
    fillToRect = {
      $_t: 100000,
      $_l: 100000,
      $_b: 100000,
      $_r: 100000,
    };
  }
  if (
    fillToRect.$_b / 100000 == gradPreset.radialPos.b &&
    fillToRect.$_t / 100000 == gradPreset.radialPos.t &&
    fillToRect.$_l / 100000 == gradPreset.radialPos.l &&
    fillToRect.$_r / 100000 == gradPreset.radialPos.r
  ) {
    return true;
  } else {
    return false;
  }
}

function getSelectedPara() {
  if (!piniaSelect().editingInfo) return null;
  const paraId = piniaSelect().editingInfo.paraId;
  const shpId = piniaSelect().selShpFormat?.id;
  const shpInfo = VShapes.getShapeDeep(shpId);
  const paras = shpInfo.t.paras;
  const para = paras.find((p) => p.id == paraId);
  return { paras, para };
}

function deleteStop(stopIdx) {
  const stops = sortedGs.value;
  stops.splice(stopIdx, 1);
  if (props.onChange)
    props.onChange({
      ...deepUnref(props.target.gradFill),
      gsLst: {
        gs: stops,
      },
    });
}

function addStop() {
  const stops = sortedGs.value;
  stops.splice(1, 0, {
    uniClr: {
      $_otag: "srgbClr",
      $_val: "ffffff",
    },
    $_pos: 10000, // 10%
  });
  if (props.onChange)
    props.onChange({
      ...deepUnref(props.target.gradFill),
      gsLst: {
        gs: stops,
      },
    });
}

function saveLinearRot(val) {
  if (props.onChange)
    props.onChange({
      ...deepUnref(props.target.gradFill),
      lin: {
        $_ang: val * 60000,
      },
    });
}

function saveRadialPos(val) {
  if (props.onChange)
    props.onChange({
      ...props.target.gradFill,
      path: {
        $_path: "circle",
        fillToRect: {
          $_t: val.t * 100000,
          $_l: val.l * 100000,
          $_b: val.b * 100000,
          $_r: val.r * 100000,
        },
      },
    });
}

function changeGradStopColor(val, idx) {
  const stops = sortedGs.value;
  const color = color2array(val);
  const [red, green, blue] = color;
  const currentAlpha = stops[idx].uniClr?.alpha?.$_val;
  const alpha =
    color[3] ?? (currentAlpha == null ? 1 : currentAlpha / 100000);
  stops[idx].uniClr = {
    $_otag: "srgbClr",
    $_val: [red, green, blue]
      .map((channel) => Math.round(channel).toString(16).padStart(2, "0"))
      .join(""),
    alpha: {
      $_val: round(alpha * 100000),
    },
  };
  if (props.onChange)
    props.onChange({
      ...deepUnref(props.target.gradFill),
      gsLst: {
        gs: stops,
      },
    });
}

function changeGradStopPos(val, idx) {
  const stops = sortedGs.value;
  stops[idx].$_pos = val * 1000;
  if (props.onChange)
    props.onChange({
      ...deepUnref(props.target.gradFill),
      gsLst: {
        gs: stops,
      },
    });
}

function changeGradType(val) {
  let newGrad;
  const gradFill = deepUnref(props.target.gradFill)
  if (val == "L") {
    newGrad = {
      ...gradFill,
      lin: {
        ...gradFill.lin,
        $_ang: gradFill?.lin?.$_ang || 90 * 60000,
      },
      path: null,
    };
  } else {
    newGrad = {
      ...gradFill,
      lin: null,
      path: {
        $_path: "circle",
      },
    };
  }

  if (props.onChange) props.onChange(newGrad);
}

function genGradBg(gradPreset) {
  let bg = "";
  const colors = ["cccccc", "444444"]
    .map((c, idx) => `#${c} ${40 * (idx + 1)}%`)
    .join(",");
  if (!props.target?.gradFill?.path) {
    bg = `linear-gradient(to ${gradPreset}, ${colors})`;
  } else {
    bg = `radial-gradient(circle at ${gradPreset}, ${colors})`;
  }
  return bg;
}
</script>
<style scoped>
.gradPreset {
  display: flex;
  justify-content: flex-start;
  flex-wrap: wrap;
  gap: 10px;
}

.gradPresetItem {
  width: 40px;
  height: 40px;
  border: 1px solid black;
  cursor: pointer;
  font-size: 12px;
  display: flex;
  justify-content: center;
  align-items: center;
  color: rgb(183, 68, 68);
  text-shadow: 1px 1px 1px white;
}

.gradPresetItem.selected {
  outline: 2px solid red;
}

.grad-stop-inner {
  display: flex;
  align-items: center;
}

.grad-stop-inner .pct {
  margin: 0 10px 0 2px;
  font-size: 14px;
  color: #888;
}

.grad-pos {
  width: 70px;
  text-align: right;
}

.demo {
  width: 100px;
  height: 100px;
  position: relative;
}
</style>
