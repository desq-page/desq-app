<template>
  <div class="field">
    <div class="subtitle">Presets</div>
    <div style="width: 100%" v-if="target == 'shape'">
      <div
        class="refl-sample"
        :class="{
          selected: reflType == 'none',
        }"
        @click="setReflType('none')"
      >
        None
      </div>
      <div
        class="refl-sample refl-preview"
        style="
          -webkit-box-reflect: below 1px -webkit-gradient(linear, right top, right
                bottom, from(transparent), color-stop(65%, transparent), to(rgba(0, 0, 0, 0.4)));
        "
        :class="{
          selected: reflType !== 'none' && size <= 45,
        }"
        @click="
          setReflType('refl', { size: 35, dist: 0, transparency: 50, blur: 0 })
        "
      >
        Tight
      </div>
      <div
        class="refl-sample refl-preview"
        style="
          -webkit-box-reflect: below 4px -webkit-gradient(linear, right top, right
                bottom, from(transparent), color-stop(45%, transparent), to(rgba(0, 0, 0, 0.4)));
        "
        :class="{
          selected: reflType !== 'none' && size > 45 && size <= 75,
        }"
        @click="
          setReflType('refl', { size: 55, dist: 4, transparency: 50, blur: 0 })
        "
      >
        Half
      </div>
      <div
        class="refl-sample refl-preview"
        style="
          -webkit-box-reflect: below 8px -webkit-gradient(linear, right top, right
                bottom, from(transparent), color-stop(10%, transparent), to(rgba(0, 0, 0, 0.4)));
        "
        :class="{
          selected: reflType !== 'none' && size > 75,
        }"
        @click="
          setReflType('refl', { size: 90, dist: 8, transparency: 50, blur: 0 })
        "
      >
        Full
      </div>
    </div>
    <div v-if="target == 'text'" class="refl-sample-text">
      <div
        :class="{
          selected: reflType == 'none',
        }"
        @click="setReflType('none')"
      >
        A
      </div>
      <div
        style="
          -webkit-box-reflect: below 1px -webkit-gradient(linear, right top, right
                bottom, from(transparent), color-stop(65%, transparent), to(rgba(0, 0, 0, 0.4)));
          display: inline-block;
        "
        :class="{
          selected: reflType !== 'none' && size <= 45,
        }"
        @click="
          setReflType('refl', { size: 35, dist: 0, transparency: 50, blur: 0 })
        "
      >
        A
      </div>
      <div
        style="
          -webkit-box-reflect: below 4px -webkit-gradient(linear, right top, right
                bottom, from(transparent), color-stop(45%, transparent), to(rgba(0, 0, 0, 0.4)));
          display: inline-block;
        "
        :class="{
          selected: reflType !== 'none' && size > 45 && size <= 75,
        }"
        @click="
          setReflType('refl', { size: 55, dist: 4, transparency: 50, blur: 0 })
        "
      >
        A
      </div>
      <div
        style="
          -webkit-box-reflect: below 8px -webkit-gradient(linear, right top, right
                bottom, from(transparent), color-stop(10%, transparent), to(rgba(0, 0, 0, 0.4)));
          display: inline-block;
        "
        :class="{
          selected: reflType !== 'none' && size > 75,
        }"
        @click="
          setReflType('refl', { size: 90, dist: 8, transparency: 50, blur: 0 })
        "
      >
        A
      </div>
    </div>
  </div>

  <template v-if="reflType !== 'none'">
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
              reflType == 'none' ||
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

    <LayoutHeader label="Size" clear-background>
      <template #extra>
        <input
          type="range"
          class="input-range"
          :value="size"
          :min="0"
          :max="100"
          @input="
            (e) => saveProp('size', +(e.target as HTMLInputElement)?.value)
          "
          :class="{
            disabled:
              reflType == 'none' ||
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

    <LayoutHeader label="Distance" clear-background>
      <template #extra>
        <input
          type="range"
          class="input-range"
          :value="dist"
          :min="0"
          :max="100"
          @input="
            (e) => saveProp('dist', +(e.target as HTMLInputElement)?.value)
          "
          :class="{
            disabled:
              reflType == 'none' ||
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
              reflType == 'none' ||
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
  </template>
</template>

<script setup lang="ts">
import { getShapeDeep, updateShape } from "shared-vuejs/editor";

import LayoutHeader from "@/components/common/Layouts/LayoutHeader.vue";
import { saveDexie } from "shared-vuejs/api/dbutils";
import { piniaSelect } from "@/lib/common/store";
import { EMU } from "shared-vuejs/api/globalUtility";
import { onMounted, watch, ref } from "vue";
import {
  calcReflInfo,
  buildReflection,
  mapCssRefl,
} from "shared-vuejs/api/processEffects";

import { execEditorSurroundSpan } from "shared-vuejs/api/execCommand";

const props = defineProps({
  target: String,
});

const reflType = ref("none");
const transparency = ref(50);
const size = ref(50);
const dist = ref(0);
const blur = ref(0);

onMounted(() => updateReflection());

watch(
  [() => piniaSelect().selShpFormat?.id, () => piniaSelect().editingInfo?.refl],
  () => {
    updateReflection();
  },
);

function reset() {
  transparency.value = 50;
  size.value = 50;
  dist.value = 0;
  blur.value = 0;
}

function updateReflection() {
  let reflection, type;
  if (props.target == "shape") {
    reflection = piniaSelect().selShpFormat?.effectLst?.reflection;
    type = reflection ? "refl" : "none";
  } else {
    const reflStr = piniaSelect().editingInfo?.refl;
    reflection = mapCssRefl(reflStr);
    type = reflStr ? "refl" : "none";
  }

  if (reflection) {
    const reflInfo = calcReflInfo(reflection);
    transparency.value = reflInfo.transparency ?? 50;
    size.value = reflInfo.size ?? 50;
    dist.value = reflInfo.dist ?? 0;
    blur.value = reflInfo.blur ?? 0;
  } else {
    reset();
  }

  reflType.value = type;
}

function setReflType(type, presetOptions?: any) {
  reflType.value = type;
  if (type == "none") {
    reset();
    saveReflection({});
  } else {
    if (presetOptions) {
      if (presetOptions.size !== undefined) size.value = presetOptions.size;
      if (presetOptions.dist !== undefined) dist.value = presetOptions.dist;
      if (presetOptions.transparency !== undefined)
        transparency.value = presetOptions.transparency;
      if (presetOptions.blur !== undefined) blur.value = presetOptions.blur;
    }
    const stA = Math.round((100 - transparency.value) * 1000);
    saveReflection({
      $_algn: "bl",
      $_dir: 5400000,
      $_dist: Math.round(dist.value * EMU),
      $_endPos: Math.round(size.value * 1000),
      $_stA: stA,
      $_blurRad: Math.round(blur.value * EMU),
      $_sy: -100000,
      $_rotWithShape: "0",
    });
  }
  saveDexie();
}

function saveProp(prop, val) {
  switch (prop) {
    case "transparency":
      transparency.value = val;
      saveReflection({
        $_stA: Math.round((100 - val) * 1000),
      });
      break;
    case "size":
      size.value = val;
      saveReflection({
        $_endPos: Math.round(val * 1000),
      });
      break;
    case "dist":
      dist.value = val;
      saveReflection({
        $_dist: Math.round(val * EMU),
      });
      break;
    case "blur":
      blur.value = val;
      saveReflection({
        $_blurRad: Math.round(val * EMU),
      });
      break;
    default:
      break;
  }
}

function saveReflection(val?) {
  if (props.target == "text") {
    const existingRefl = piniaSelect().editingInfo?.refl;
    const reflInfo = mapCssRefl(existingRefl);
    const reflData = {
      ...reflInfo,
      dist: dist.value,
      size: size.value,
      transparency: transparency.value,
      blur: blur.value,
      ...val,
    };
    const reflCss = buildReflection(reflData, piniaSelect().editingInfo?.sz);
    if (reflType.value == "none") {
      execEditorSurroundSpan(
        {
          "--refl": "",
          "-webkit-box-reflect": "",
        },
        undefined,
        false,
      );
    } else {
      execEditorSurroundSpan(
        {
          "--refl": reflCss["--refl"],
          "-webkit-box-reflect": reflCss["-webkit-box-reflect"],
          display: "inline-block",
        },
        undefined,
        false,
      );
    }
    saveDexie();
  } else {
    const curShp = getShapeDeep(piniaSelect().selShpFormat?.id);
    if (!curShp) return;
    if (reflType.value == "none") {
      delete curShp.effectLst?.reflection;
    } else {
      curShp.effectLst = {
        ...curShp.effectLst,
        reflection: {
          $_algn: "bl",
          $_dir: 5400000,
          $_sy: -100000,
          $_rotWithShape: "0",
          ...curShp.effectLst?.reflection,
          $_dist: Math.round(dist.value * EMU),
          $_endPos: Math.round(size.value * 1000),
          $_stA: Math.round((100 - transparency.value) * 1000),
          $_blurRad: Math.round(blur.value * EMU),
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

.refl-sample {
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

.refl-sample-text {
  display: flex;
  justify-content: space-around;
  width: 200px;
  font-size: 40px;
}

.refl-sample.selected,
.refl-sample-text .selected {
  outline: 2px solid red;
  outline-offset: 4px;
}
</style>
