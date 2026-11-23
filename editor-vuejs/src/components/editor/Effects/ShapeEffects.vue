<template>
  <!-- <SelectionToolbar /> -->
  <DialogBase
    shapeOnly
    title="Format Shape"
    :sub-tabbar-items="subTabbarItems"
  >
    <LayoutHeader label="Shadow" :arrow="false" />
    <ShadowComp target="shape" />
    <LayoutHeader label="Glow" :arrow="false" />
    <GlowComp target="shape" />
    <LayoutHeader label="Reflection" :arrow="false" />
    <ReflectionComp target="shape" />
    <template v-for="ef in effects" :key="ef.eff">
      <LayoutHeader :label="ef.name">
        <template #switch v-if="ef.switch">
          <NSwitch
            :value="
              !!piniaSelect().selShpFormat?.effectLst?.[ef.eff] ||
              !!piniaSelect().selShpFormat?.sp3d?.[ef.eff]
            "
            :on-update:value="enabled => setEffectEnabled(ef, enabled)"
            style="margin-right: 10px"
          />
        </template>
      </LayoutHeader>
      <RangeSlider
        :value="getCurValue(ef.eff)"
        :on-input="(val) => updateSlider(ef.eff, val)"
        :on-change="saveDexie"
        :min="ef.min ?? 0"
        :max="ef.max ?? 100"
        :marks="ef.marks"
        :step="ef.step ?? 10"
      />
    </template>
    <ThreeDEffects />
  </DialogBase>
</template>
<script setup lang="ts">
import { getSelectSelShpFormat } from "shared-vuejs/editor";

// import { applyShadow } from "shared-vuejs/api/layout";
// import ShapeSize from "./ShapeSize.vue";
import LayoutHeader from "@/components/common/Layouts/LayoutHeader.vue";
import { NSwitch } from "naive-ui";
import { piniaSelect } from "@/lib/common/store";
import DialogBase from "@/components/common/Layouts/DialogBase.vue";
import RangeSlider from "@/components/common/RangeSlider.vue";
import { applyToSelectedShapes } from "./selected-shape-effects";
import { saveDexie } from "shared-vuejs/api/dbutils";
import { round } from "shared-vuejs/api/utility";
import {
  // shapeTabbarItems,
  subTabbarItems,
} from "../Selection/ShapeTabbarOptions";
import { EMU } from "shared-vuejs/api/globalUtility";
import ShadowComp from "./ShadowComp.vue";
import GlowComp from "./GlowComp.vue";
import ReflectionComp from "./ReflectionComp.vue";
import ThreeDEffects from "./ThreeDEffects.vue";


const effects: any = [
  {
    name: "Soft Edge",
    eff: "softEdge",
    value: 8,
    min: 0,
    max: 100,
    step: 4,
  },
  // {
  //   name: "Bevel",
  //   eff: "bevel",
  //   value: {
  //     azimuth: 235,
  //     elevation1: 60,
  //     elevation2: 60,
  //     lightColor: "rgb(220,220,220)",
  //     specularConstant: 0.3,
  //     specularExponent: 82,
  //     surfaceScale: 2,
  //   },
  // },
  // {
  //   name: "Grayscale",
  //   eff: "grayscl",
  //   // switch: true,
  // },
  {
    name: "Blur",
    eff: "blur",
    step: 1,
  },
  // {
  //   name: "Brightness",
  //   eff: "brightness",
  //   min: 0,
  //   max: 200,
  //   marks: { 100: "" },
  // },
  // {
  //   name: "Contrast",
  //   eff: "contrast",
  //   min: 0,
  //   max: 200,
  //   marks: { 100: "" },
  // },
];

// ALSO check selection gid('selShapeLeft').disabled line 263 to 271 not working

function setEffectEnabled(effect, enabled: boolean) {
  const key = effect.eff;
  const property = key === "bevel" ? "sp3d" : "effectLst";
  if (applyToSelectedShapes(shape => {
    if (enabled) {
      shape[property] = { ...shape[property], [key]: structuredClone(effect.value) };
    } else {
      delete shape[property]?.[key];
    }
  })) saveDexie();
}

function getCurValue(eff) {
  let val;
  if (eff == "brightness" || eff == "contrast") {
    val = (getSelectSelShpFormat()?.effectLst?.[eff] ?? 1) * 100;
  } else if (eff == "blur" || eff == "softEdge") {
    val = getSelectSelShpFormat()?.effectLst?.[eff]?.$_rad / EMU || 0;
  } else if (eff == "reflection") {
    val = (getSelectSelShpFormat()?.effectLst?.[eff]?.$_dist || 0) / EMU;
  } else {
    val = (getSelectSelShpFormat()?.effectLst?.[eff] || 0) * 100;
  }
  return round(val);
}

function updateSlider(eff, val) {
  applyToSelectedShapes(shape => {
    const previous = shape.effectLst?.[eff];
    const effect = eff === "blur" || eff === "softEdge"
      ? { ...previous, $_rad: val * EMU }
      : val / 100;
    shape.effectLst = { ...shape.effectLst, [eff]: effect };
  });
}
</script>
