<template>
  <div class="field">
    <div class="subtitle">Type</div>
    <div style="width: 100%" v-if="target == 'shape'">
      <div
        class="shadow-sample"
        :class="{
          selected: shdwType == 'none',
        }"
        @click="setShadowType('none')"
      >
        None
      </div>
      <div
        class="shadow-sample"
        style="box-shadow: inset 4px 4px black"
        :class="{
          selected: shdwType == 'inner',
        }"
        @click="setShadowType('inner')"
      >
        Inner
      </div>
      <div
        class="shadow-sample"
        style="box-shadow: 4px 4px 4px black"
        :class="{
          selected: shdwType == 'outer',
        }"
        @click="setShadowType('outer')"
      >
        Outer
      </div>
    </div>
    <div v-if="target == 'text'" class="shadow-sample-text">
      <div
        :class="{
          selected: shdwType == 'none',
        }"
        @click="setShadowType('none')"
      >
        A
      </div>
      <div
        style="text-shadow: 4px 4px 4px black"
        :class="{
          selected: shdwType == 'outer',
        }"
        @click="setShadowType('outer')"
      >
        A
      </div>
    </div>
  </div>
  <!-- <div
    class="shadow-sample"
    style="
      filter: drop-shadow(2px 2px 2px blue) drop-shadow(2px -2px 2px blue)
        drop-shadow(-2px -2px 2px blue) drop-shadow(-2px 2px 2px blue);
    "
    :class="{
      selected: shadowType == 'glow',
    }"
    @click="setShadowType('glow')"
  >
    Glow
  </div> -->
  <!-- <div
    class="shadow-sample"
    style="
      filter: drop-shadow(0px 4px 2px blue);
    "
    :class="{
      selected: shadowType == 'perspective',
    }"
    @click="setShadowType('perspective')"
  >
    Perspective
  </div> -->
  <template v-if="shdwType !== 'none'">
    <div class="field">
      <div class="subtitle">Color</div>
      <div style="width: 80%">
        <SlideColorPicker
          :cur-color="color"
          :on-change="setShadowColor"
          show-alpha
          :class="{
            disabled:
              target == 'text' && !piniaSelect().editingInfo?.selectionText,
          }"
        />
      </div>
    </div>

    <LayoutHeader label="Blur" clear-background>
      <template #extra>
        <input
          type="range"
          class="input-range"
          :value="blur"
          :min="0"
          :max="50"
          @input="
            (e) => saveProp('blur', +(e.target as HTMLInputElement)?.value)
          "
          :class="{
            disabled:
              shdwType == 'none' ||
              (target == 'text' && !piniaSelect().editingInfo?.selectionText),
          }"
        />
        <input
          :value="blur"
          :size="3"
          @change="
            (e) => saveProp('blur', +(e.target as HTMLInputElement)?.value)
          "
        />
      </template>
    </LayoutHeader>

    <LayoutHeader label="Distance" clear-background>
      <template #extra>
        <input
          type="range"
          class="input-range"
          :value="dist"
          :min="0"
          :max="50"
          @input="
            (e) => saveProp('dist', +(e.target as HTMLInputElement)?.value)
          "
          :class="{
            disabled:
              shdwType == 'none' ||
              (target == 'text' && !piniaSelect().editingInfo?.selectionText),
          }"
        />
        <input
          :value="dist"
          :size="3"
          @change="
            (e) => saveProp('dist', +(e.target as HTMLInputElement)?.value)
          "
        />
      </template>
    </LayoutHeader>

    <LayoutHeader label="Angle" clear-background>
      <template #extra>
        <input
          type="range"
          class="input-range"
          :value="angle"
          :min="0"
          :max="359"
          @input="
            (e) => saveProp('angle', +(e.target as HTMLInputElement)?.value)
          "
          :class="{
            disabled:
              shdwType == 'none' ||
              (target == 'text' && !piniaSelect().editingInfo?.selectionText),
          }"
        />
        <input
          :value="angle"
          :size="3"
          @change="
            (e) => saveProp('angle', +(e.target as HTMLInputElement)?.value)
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
import { onMounted, watch } from "vue";
import {
  calcShdwInfo,
  genShadowCss,
  mapCssShdw,
} from "shared-vuejs/api/processEffects";

import { execEditorSurroundSpan } from "shared-vuejs/api/execCommand";
import { ref } from "vue";
import { array2hex, color2array } from "shared-vuejs/api/colorUtils";
import SlideColorPicker from "@/components/common/SlideColorPicker.vue";

onMounted(() => updateShadow());

watch(
  [() => piniaSelect().selShpFormat?.id, () => piniaSelect().editingInfo?.shdw],
  () => {
    updateShadow();
  },
);

const props = defineProps({
  target: String,
});

const shdwType = ref("none");
const blur = ref(0);
const dist = ref(0);
const angle = ref(0);
const color = ref("");

function reset() {
  color.value = "#000000FF";
  blur.value = 10;
  dist.value = 10;
  angle.value = 45;
}

function updateShadow() {
  console.log("updated");
  let shadow, type;
  if (props.target == "shape") {
    const outerShdw = piniaSelect().selShpFormat?.effectLst?.outerShdw;
    const innerShdw = piniaSelect().selShpFormat?.effectLst?.innerShdw;
    const glow = piniaSelect().selShpFormat?.effectLst?.glow;

    shadow = glow || outerShdw || innerShdw;

    type = innerShdw ? "inner" : outerShdw ? "outer" : "none";
  } else {
    const shdwStr = piniaSelect().editingInfo?.shdw;
    shadow = mapCssShdw(shdwStr);
    type = shdwStr ? "outer" : "none";
  }
  if (shadow) {
    const shadowInfo = calcShdwInfo(
      shadow,
      getTheme(),
      getMasterInfo().clrMap,
    );

    color.value = shadowInfo?.color || "#000000FF";
    blur.value = shadowInfo?.blur ?? 1;
    dist.value = shadowInfo?.dist ?? 0;
    angle.value = shadowInfo?.angle ?? 0;
  } else {
    reset();
  }

  shdwType.value = type;
}

function setShadowType(type) {
  shdwType.value = type;
  if (type == "none") {
    reset();
    saveShadow({});
  } else {
    reset();
    const colorArr = color2array(color.value);
    saveShadow({
      uniClr: {
        $_otag: "srgbClr",
        $_val: array2hex(colorArr.slice(0, 3), true),
        alpha: { $_val: Math.round((colorArr[3] ?? 1) * 100000) },
      },
      // opacity: shadow?.opacity ?? 1,
      $_blurRad: (blur.value ?? 5) * EMU,
      $_dist: (dist.value ?? 5) * EMU,
      $_dir: (angle.value || 45) * 60000,
    });
  }
  saveDexie();
}

function setShadowColor(val) {
  color.value = val;
  val = color2array(val);
  saveShadow({
    uniClr: {
      $_otag: "srgbClr",
      $_val: array2hex(val.slice(0, 3), true),
      alpha: { $_val: Math.round((val[3] ?? 1) * 100000) },
    },
  });
  saveDexie();
}

function saveProp(prop, val) {
  let rawProp;
  switch (prop) {
    case "opacity":
      break;
    case "blur":
      rawProp = "$_blurRad";
      blur.value = val;
      val = val * EMU;
      break;
    case "dist":
      rawProp = "$_dist";
      dist.value = val;
      val = val * EMU;
      break;
    case "angle":
      rawProp = "$_dir";
      angle.value = val;
      val = val * 60000;
      break;
    default:
      break;
  }
  saveShadow({
    [rawProp]: val,
  });
}

function saveShadow(val?) {
  if (props.target == "text") {
    const existingShadow = piniaSelect().editingInfo.shdw;
    const shadowInfo = mapCssShdw(existingShadow);
    const shadowData = {
      ...shadowInfo,
      ...val,
    };
    const shadowCss = genShadowCss(
      shadowData,
      getTheme(),
      undefined,
    );
    if (shdwType.value == "none") {
      execEditorSurroundSpan(
        {
          "--shdw": "",
          "text-shadow": "",
        },
        undefined,
        false,
      );
    } else {
      execEditorSurroundSpan(
        {
          "--shdw": shadowCss["--shdw"],
          "text-shadow": shadowCss["text-shadow"],
          "caret-color": shadowCss["caret-color"],
        },
        undefined,
        false,
      );
    }
    saveDexie();
  } else {
    const curShp = getShapeDeep(piniaSelect().selShpFormat?.id);
    if (shdwType.value == "none") {
      delete curShp.effectLst?.outerShdw;
      delete curShp.effectLst?.innerShdw;
      delete curShp.effectLst?.glow;
    } else {
      if (shdwType.value == "inner") {
        delete curShp.effectLst?.outerShdw;
      } else if (shdwType.value == "outer") {
        delete curShp.effectLst?.innerShdw;
      } else if (shdwType.value == "glow") {
        // delete curShp.effectLst?.innerShdw;
      }
      const shdtype = shdwType.value + "Shdw";
      curShp.effectLst = {
        ...curShp.effectLst,
        [shdtype]: {
          ...curShp.effectLst?.[shdtype],
          ...val,
        },
      };
    }
    updateShape(curShp);
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

.shadow-sample {
  width: 60px;
  height: 30px;
  border: 1px solid #ccc;
  margin: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background-color: white;
}

.shadow-sample-text {
  display: flex;
  justify-content: space-around;
  width: 200px;
  font-size: 40px;
}

.shadow-sample.selected, .shadow-sample-text .selected {
  outline: 2px solid red;
  outline-offset: 4px;
}
</style>
