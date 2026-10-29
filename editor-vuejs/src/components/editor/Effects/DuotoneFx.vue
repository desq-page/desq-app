<template>
  <DialogBase
    :backLink="
      background
        ? 'slidepictureoptions'
        : piniaSelect().selShpFormat
          ? 'pictureoptions'
          : 'formatslide'
    "
    title="Duotone"
  >
    <ToolbarItemSwitch
      label="Use Duotone"
      :defaultVal="!!currentBlip()?.duotone"
      :onClick="(val) => enableDuotone(val)"
    />
    <div
      :class="{
        disabled: !currentBlip()?.duotone,
      }"
    >
      <div class="subtitle">Color 1</div>

      <SlideColorPicker
        :cur-color="
          mapStyleThemeColor(
            currentBlip()?.duotone?.uniClr?.[0],
            getTheme(),
            getMasterInfo().clrMap,
          ) || '#000000'
        "
        :on-change="(val) => updateColor(0, val)"
      />
      <div class="subtitle">Color 2</div>
      <SlideColorPicker
        :cur-color="
          mapStyleThemeColor(
            currentBlip()?.duotone?.uniClr?.[1],
            getTheme(),
            getMasterInfo().clrMap,
          ) || '#FFFFFF'
        "
        :on-change="(val) => updateColor(1, val)"
      />
    </div>
  </DialogBase>
</template>
<script setup lang="ts">
import { getShapeDeep, updateShape, getTheme, getLayoutInfo, getMasterInfo, getSlideInfo } from "shared-vuejs/editor";

import DialogBase from "@/components/common/Layouts/DialogBase.vue";
import { piniaSelect } from "@/lib/common/store";
import {
  array2hex,
  color2array,
  mapStyleThemeColor,
} from "shared-vuejs/api/colorUtils";
import ToolbarItemSwitch from "../Toolbars/ToolbarItemSwitch.vue";
import { saveDexie } from "shared-vuejs/api/dbutils";

import SlideColorPicker from "@/components/common/SlideColorPicker.vue";
import { getSlideBg } from "shared-vuejs/api/slideUtils";
import { updateCurrentSlideBackground } from "@/lib/main/slideBackground";
import { ref } from "vue";

const props = defineProps({ background: Boolean });
const backgroundBlip = ref(
  props.background
    ? getSlideBg(
        getSlideInfo(),
        getLayoutInfo(),
        getMasterInfo(),
        getTheme(),
      )?.blipFill?.blip
    : null,
);

function currentBlip() {
  return props.background ? backgroundBlip.value : piniaSelect().selShpFormat?.blipFill?.blip;
}

async function updateBackgroundDuotone(update) {
  const slideInfo = getSlideInfo();
  const slideBg = slideInfo?.bg || {};
  const bgPr = slideBg.bgPr || {};
  const currentBlipFill = bgPr.blipFill || getSlideBg(
    slideInfo,
    getLayoutInfo(),
    getMasterInfo(),
    getTheme(),
  )?.blipFill || {};
  const nextBg = {
    ...slideBg,
    bgPr: {
      ...bgPr,
      solidFill: null,
      gradFill: null,
      blipFill: {
        ...currentBlipFill,
        blip: update(currentBlipFill.blip || {}),
      },
    },
  };
  backgroundBlip.value = nextBg.bgPr.blipFill.blip;
  await updateCurrentSlideBackground(nextBg);
}

async function enableDuotone(checked) {
  console.log(checked);
  if (props.background) {
    await updateBackgroundDuotone((blip) => {
      const next = { ...blip };
      if (checked) {
        next.duotone = {
          uniClr: [
            { $_otag: "srgbClr", $_val: "000000" },
            { $_otag: "srgbClr", $_val: "FFFFFF" },
          ],
        };
      } else {
        delete next.duotone;
      }
      return next;
    });
    return;
  }
  const shpInfo = getShapeDeep(piniaSelect().selShpFormat?.id);
  if (checked) {
    shpInfo.blipFill.blip = {
      ...shpInfo.blipFill?.blip,
      duotone: {
        uniClr: [
          {
            $_otag: "srgbClr",
            $_val: "000000",
          },
          {
            $_otag: "srgbClr",
            $_val: "FFFFFF",
          },
        ],
      },
    };
  } else {
    delete shpInfo.blipFill?.blip?.duotone;
  }
  updateShape(shpInfo);
  saveDexie();
}

async function updateColor(index, val) {
  if (props.background) {
    await updateBackgroundDuotone((blip) => {
      const duotone = blip.duotone || { uniClr: [] };
      const uniClr = [...(duotone.uniClr || [])];
      uniClr[index] = {
        $_otag: "srgbClr",
        $_val: array2hex(color2array(val).slice(0, 3)).replace("#", "") || "FF0000",
      };
      return { ...blip, duotone: { ...duotone, uniClr } };
    });
    return;
  }
  const shpInfo = getShapeDeep(piniaSelect().selShpFormat?.id);
  shpInfo.blipFill.blip.duotone.uniClr[index] = {
    $_otag: "srgbClr",
    $_val: array2hex(color2array(val).slice(0, 3)).replace("#", "") || "FF0000",
  };
  updateShape(shpInfo);
  saveDexie();
}
</script>
<style>
.subtitle {
  font-weight: bold;
  margin-top: 10px;
  font-size: 14px;
}
</style>
