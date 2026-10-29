<template>
  <div class="field">
    <div class="subtitle">Presets</div>
    <div style="width: 100%" v-if="target == 'shape'">
      <div
        class="glow-sample"
        :class="{
          selected: glowType == 'none',
        }"
        @click="setGlowType('none')"
      >
        None
      </div>
      <div
        class="glow-sample"
        style="box-shadow: 0 0 5px 2px #e67e22"
        :class="{
          selected: glowType !== 'none' && size <= 8,
        }"
        @click="setGlowType('glow', 5)"
      >
        5pt
      </div>
      <div
        class="glow-sample"
        style="box-shadow: 0 0 9px 3px #e67e22"
        :class="{
          selected: glowType !== 'none' && size > 8 && size <= 15,
        }"
        @click="setGlowType('glow', 11)"
      >
        11pt
      </div>
      <div
        class="glow-sample"
        style="box-shadow: 0 0 14px 4px #e67e22"
        :class="{
          selected: glowType !== 'none' && size > 15,
        }"
        @click="setGlowType('glow', 18)"
      >
        18pt
      </div>
    </div>
    <div v-if="target == 'text'" class="glow-sample-text">
      <div
        :class="{
          selected: glowType == 'none',
        }"
        @click="setGlowType('none')"
      >
        A
      </div>
      <div
        style="text-shadow: 0 0 6px #e67e22"
        :class="{
          selected: glowType !== 'none' && size <= 8,
        }"
        @click="setGlowType('glow', 5)"
      >
        A
      </div>
      <div
        style="text-shadow: 0 0 12px #e67e22"
        :class="{
          selected: glowType !== 'none' && size > 8 && size <= 15,
        }"
        @click="setGlowType('glow', 11)"
      >
        A
      </div>
      <div
        style="text-shadow: 0 0 18px #e67e22"
        :class="{
          selected: glowType !== 'none' && size > 15,
        }"
        @click="setGlowType('glow', 18)"
      >
        A
      </div>
    </div>
  </div>

  <template v-if="glowType !== 'none'">
    <div class="field">
      <div class="subtitle">Color</div>
      <div style="width: 80%">
        <SlideColorPicker
          :cur-color="color"
          :on-change="setGlowColor"
          show-alpha
          hide-clear
          :use-system-picker="false && !ue.android"
          :class="{
            disabled:
              target == 'text' && !piniaSelect().editingInfo?.selectionText,
          }"
        />
      </div>
    </div>

    <LayoutHeader label="Size" clear-background>
      <template #extra>
        <input
          class="input-range"
          type="range"
          :value="size"
          :min="0"
          :max="100"
          @input="
            (e) => saveProp('size', +(e.target as HTMLInputElement)?.value)
          "
          :class="{
            disabled:
              glowType == 'none' ||
              (target == 'text' && !piniaSelect().editingInfo?.selectionText),
          }"
        />
        <input
          :value="size"
          :size="3"
          @change="
            (e) => saveProp('size', +(e.target as HTMLInputElement)?.value)
          "
        />
      </template>
    </LayoutHeader>

    <LayoutHeader label="Transparency" clear-background>
      <template #extra>
        <input
          type="range"
          class="input-range"
          :value="transparency"
          :min="0"
          :max="100"
          @input="
            (e) =>
              saveProp('transparency', +(e.target as HTMLInputElement)?.value)
          "
          :class="{
            disabled:
              glowType == 'none' ||
              (target == 'text' && !piniaSelect().editingInfo?.selectionText),
          }"
        />
        <input
          :value="transparency"
          :size="3"
          @change="
            (e) =>
              saveProp('transparency', +(e.target as HTMLInputElement)?.value)
          "
        />
      </template>
    </LayoutHeader>
  </template>
</template>

<script setup lang="ts">
import { getShapeDeep, updateShape, getTheme, getMasterInfo } from "shared-vuejs/editor";

import LayoutHeader from "@/components/common/Layouts/LayoutHeader.vue";
import { saveDexie } from "shared-vuejs/api/dbutils";
import { piniaSelect } from "@/lib/common/store";
import { EMU, ue } from "shared-vuejs/api/globalUtility";
import { onMounted, watch, ref } from "vue";
import {
  calcShdwInfo,
  genGlowCss,
  mapCssGlow,
} from "shared-vuejs/api/processEffects";

import { execEditorSurroundSpan } from "shared-vuejs/api/execCommand";
import { array2hex, color2array } from "shared-vuejs/api/colorUtils";
import SlideColorPicker from "@/components/common/SlideColorPicker.vue";

const props = defineProps({
  target: String,
});

const glowType = ref("none");
const size = ref(0);
const transparency = ref(0);
const color = ref("");

onMounted(() => updateGlow());

watch(
  [() => piniaSelect().selShpFormat?.id, () => piniaSelect().editingInfo?.glow],
  () => {
    updateGlow();
  },
);

function reset() {
  color.value = "#E67E22FF";
  size.value = 10;
  transparency.value = 40;
}

function updateGlow() {
  let glow, type;
  if (props.target == "shape") {
    glow = piniaSelect().selShpFormat?.effectLst?.glow;
    type = glow ? "glow" : "none";
  } else {
    const glowStr = piniaSelect().editingInfo?.glow;
    glow = mapCssGlow(glowStr);
    type = glowStr ? "glow" : "none";
  }

  if (glow) {
    const glowInfo = calcShdwInfo(
      glow,
      getTheme(),
      getMasterInfo().clrMap,
    );

    color.value = glowInfo?.color || "#E67E22FF";
    size.value = glowInfo?.rad ?? (Math.round((glow.$_rad || 0) / EMU) || 8);
    if (
      glow.uniClr?.alpha?.$_val !== undefined &&
      glow.uniClr?.alpha?.$_val !== null
    ) {
      transparency.value = Math.round(
        (1 - glow.uniClr.alpha.$_val / 100000) * 100,
      );
    } else {
      const colArr = color2array(color.value);
      const a = colArr[3] !== undefined ? colArr[3] : 1;
      transparency.value = Math.round((1 - a) * 100);
    }
  } else {
    reset();
  }

  glowType.value = type;
}

function setGlowType(type, defaultSize?) {
  glowType.value = type;
  if (type == "none") {
    reset();
    saveGlow({});
  } else {
    if (defaultSize) {
      size.value = defaultSize;
    }
    const colorArr = color2array(color.value);
    const alphaVal = Math.round((1 - transparency.value / 100) * 100000);
    saveGlow({
      uniClr: {
        $_otag: "srgbClr",
        $_val: array2hex(colorArr.slice(0, 3), true),
        alpha: { $_val: alphaVal },
      },
      $_rad: (size.value || 8) * EMU,
    });
  }
  saveDexie();
}

function setGlowColor(val) {
  color.value = val;
  const colArr = color2array(val);
  if (colArr[3] !== undefined && colArr[3] !== null) {
    transparency.value = Math.round((1 - colArr[3]) * 100);
  }
  const alphaVal = Math.round((1 - transparency.value / 100) * 100000);
  saveGlow({
    uniClr: {
      $_otag: "srgbClr",
      $_val: array2hex(colArr.slice(0, 3), true),
      alpha: { $_val: alphaVal },
    },
  });
  saveDexie();
}

function saveProp(prop, val) {
  switch (prop) {
    case "size":
      size.value = val;
      saveGlow({
        $_rad: val * EMU,
      });
      break;
    case "transparency": {
      transparency.value = val;
      const colorArr = color2array(color.value);
      colorArr[3] = (1 - val / 100);
      color.value = array2hex(colorArr, true);
      const alphaVal = Math.round((1 - val / 100) * 100000);
      saveGlow({
        uniClr: {
          $_otag: "srgbClr",
          $_val: array2hex(colorArr.slice(0, 3), true),
          alpha: { $_val: alphaVal },
        },
      });
      break;
    }
    default:
      break;
  }
}

function saveGlow(val?) {
  if (props.target == "text") {
    const existingGlow = piniaSelect().editingInfo?.glow;
    const glowInfo = mapCssGlow(existingGlow);
    const glowData = {
      ...glowInfo,
      ...val,
    };
    const glowCss = genGlowCss(glowData, getTheme(), undefined);
    if (glowType.value == "none") {
      execEditorSurroundSpan(
        {
          "--glow": "",
          "text-shadow": "",
        },
        undefined,
        false,
      );
    } else {
      execEditorSurroundSpan(
        {
          "--glow": glowCss["--glow"],
          "text-shadow": glowCss["fitext-shadowlter"],
        },
        undefined,
        false,
      );
    }
    saveDexie();
  } else {
    const curShp = getShapeDeep(piniaSelect().selShpFormat?.id);
    if (!curShp) return;
    if (glowType.value == "none") {
      delete curShp.effectLst?.glow;
    } else {
      curShp.effectLst = {
        ...curShp.effectLst,
        glow: {
          ...curShp.effectLst?.glow,
          ...val,
        },
      };
    }
    updateShape(curShp);
    saveDexie();
  }
}
</script>

<style scoped>
.field {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.subtitle {
  margin-bottom: 5px;
  margin-left: 5px;
  font-size: 14px;
  font-weight: bold;
}

.glow-sample {
  width: 50px;
  height: 30px;
  border: 1px solid #ccc;
  margin: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background-color: white;
  font-size: 12px;
}

.glow-sample-text {
  display: flex;
  justify-content: space-around;
  width: 200px;
  font-size: 40px;
}

.glow-sample.selected,
.glow-sample-text .selected {
  outline: 2px solid red;
  outline-offset: 4px;
}
</style>
