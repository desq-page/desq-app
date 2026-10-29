<script setup lang="ts">
import { getShapeDeep, updateShape, getSelectSelShpFormat, getTheme, getFileInfo, getLayoutInfo, getMasterInfo, getSlideInfo } from "shared-vuejs/editor";

import { getAllMediaPics, saveDexie } from "shared-vuejs/api/dbutils";
import {
  insertBlobImage,
} from "shared-vuejs/api/insertBlob";
import { piniaSelect } from "@/lib/common/store";
import { VideoBackgroundEffect20Filled } from "@vicons/fluent";
import { gid } from "shared-vuejs/api/utility";
import { rmbgUsingXenova } from "../Toolbars/ToolbarUtils";
import { Opacity, Person } from "@vicons/carbon";
import { traceImage } from "shared-vuejs/api/svgUtils";
import g from "shared-vuejs/api/global";
// import LocalMedia from "../Media/LocalMedia.vue";
import ToolbarItem from "../Toolbars/ToolbarItem.vue";
import { NFlex, NTooltip } from "naive-ui";
import LayoutHeader from "@/components/common/Layouts/LayoutHeader.vue";
// import DetachPicture from "./DetachPicture.vue";
import { replaceColor } from "shared-vuejs/api/replace-color";

import { genImgCrop } from "shared-vuejs/api/genUtils";
import { updateBlipFillCrop } from "shared-vuejs/api/calcHandleBox";
import ShapeTransparency from "../AutoShapes/ShapeTransparency.vue";
import {
  // shapeTabbarItems,
  // subBgTabbarItems,
  subTabbarItems,
} from "../Selection/ShapeTabbarOptions";
import DialogBase from "@/components/common/Layouts/DialogBase.vue";
import { PhotoTwotone } from "@vicons/material";
import { toggleTaskPane } from "@/lib/main/utils";
import RangeSlider from "@/components/common/RangeSlider.vue";
import LocalMedia from "./LocalMedia.vue";
import { Image24Regular, PaintBucket24Filled } from "@vicons/fluent";
import { getSlideBg } from "shared-vuejs/api/slideUtils";
import { updateCurrentSlideBackground } from "@/lib/main/slideBackground";
import { onBeforeUnmount, onMounted, ref } from "vue";
import { off, on } from "shared-vuejs/events";

const props = defineProps({ background: Boolean });
const bgPictureSubTabbarItems = [
  { tooltip: "Fill", taskpane: "formatslide", icon: PaintBucket24Filled },
  { tooltip: "Picture", taskpane: "slidepictureoptions", icon: Image24Regular },
];
const backgroundOpacity = ref(100);
const backgroundBrightness = ref(100);
const backgroundContrast = ref(100);

function getSlideBackground() {
  return getSlideBg(
    getSlideInfo(),
    getLayoutInfo(),
    getMasterInfo(),
    getTheme(),
  );
}

function syncBackgroundControls(blip = getSlideBackground()?.blipFill?.blip) {
  if (!blip) return;
  backgroundOpacity.value = (blip.alphaModFix?.$_amt ?? 100000) / 1000;
  backgroundBrightness.value = (blip.lum?.$_bright || 0) / 1000 + 100;
  backgroundContrast.value = (blip.lum?.$_contrast || 0) / 1000 + 100;
}

const handleBackgroundSlideLoaded = () => {
  if (props.background) syncBackgroundControls();
};
onMounted(() => {
  if (props.background) syncBackgroundControls();
  on("slideLoaded", handleBackgroundSlideLoaded);
});
onBeforeUnmount(() => off("slideLoaded", handleBackgroundSlideLoaded));

async function updateBackgroundBlip(update, shouldSave = false) {
  const slideInfo = getSlideInfo();
  const slideBg = slideInfo?.bg || {};
  const bgPr = slideBg.bgPr || {};
  const currentBlipFill = bgPr.blipFill || getSlideBackground()?.blipFill || {};
  const blipFill = {
    ...currentBlipFill,
    blip: update(currentBlipFill.blip || {}),
  };
  if (props.background) syncBackgroundControls(blipFill.blip);
  const nextBg = {
    ...slideBg,
    bgPr: {
      ...bgPr,
      solidFill: null,
      gradFill: null,
      blipFill,
    },
  };
  await updateCurrentSlideBackground(nextBg, shouldSave);
}

async function makeTransparent(origColor) {
  const img = gid(getSelectSelShpFormat()?.id)?.querySelector("image");
  const blob = await replaceColor(
    img,
    origColor || "#FFFFFF",
    "rgba(255,255,255,0)",
  );
  insertBlobImage(blob, undefined);
}

// function setImageSlideBg() {
//   if (piniaSelect().selShpFormat?.blipFill) {
//     const i = { ...piniaSelect().selShpFormat?.blipFill };
//     if (!i.imgW) {
//       i.imgW = piniaSelect().selShpFormat?.w;
//       i.imgH = piniaSelect().selShpFormat?.h;
//     }
//     piniaSlides().updateSlide({
//       ...piniaSlides().slideInfo,
//       bg: {
//         ...piniaSlides().slideInfo.bg,
//         i,
//       },
//     });
//     deleteShape();
//     saveDexie();
//   }
// }

function setShapePicture(e, img) {
  const shp = getShapeDeep(getSelectSelShpFormat()?.id);
  console.log(e, img);
  if (shp) {
    // let iX =0, iY =0, iW = 100, iH = 100;
    // if (shp.i?.tile) {
    //   iX = shp.i.iX;
    //   iY = shp.i.iY;
    //   iW = shp.i.iW;
    //   iH = shp.i.iH;
    // } else {
    //   iX = round3((-(newW - shp?.w) / 2 / shp?.w) * 100 || 0);
    //   iW = round3(((newW - shp?.w + shp?.w) / shp?.w) * 100 || 100);
    //   iY = round3((-(newH - shp?.h) / 2 / shp?.h) * 100 || 0);
    //   iH = round3(((newH - shp?.h + shp?.h) / shp?.h) * 100 || 100);
    // }
    const isPic = shp.$_otag == "pic" || shp.ph?.$_type == "pic";
    const { iX, iY, iW, iH } = genImgCrop(
      img.width,
      img.height,
      getSelectSelShpFormat(),
    );
    const blip = {
      $_w: img.width,
      $_h: img.height,
      $_target: img.id,
    };
    if (!isPic) {
      shp.blipFill = {
        blip: {
          ...shp.blipFill.blip,
          ...blip,
        },
      };
      updateBlipFillCrop(shp, iX, iY, iW, iH);
    } else {
      shp.blipPr = {
        blip: {
          ...shp.blipPr.blip,
          ...blip,
        },
      };
      updateBlipFillCrop(shp, iX, iY, iW, iH, true);
    }

    if (isPic) {
      shp.$_otag = "pic";
    }

    updateShape(shp);
    saveDexie();
  }
  e.preventDefault();
}

function getBrighnessContrastLabel(eff) {
  if (eff == '$_contrast') {
    return 'Contrast'
  } else {
    return 'Brightness'
  }
}

function updateBrightnessContrast(eff, val) {
  if (props.background) {
    void updateBackgroundBlip((blip) => ({
      ...blip,
      lum: { ...blip.lum, [eff]: (val - 100) * 1000 },
    }));
    return;
  }
  const shp = getShapeDeep(getSelectSelShpFormat()?.id);
  shp.blipFill.blip = {
    ...shp.blipFill.blip,
    lum: {
      ...shp.blipFill.blip?.lum,
      [eff]: (val - 100) * 1000,
    }
  };
  
  updateShape(shp);
}

async function setImage(image) {
  let target = image;
  if (!target) {
    const mediaColl = await getAllMediaPics(getFileInfo()?.id);
    target = mediaColl?.[0]?.name || "image1.png";
  }
  if (props.background) {
    await updateBackgroundBlip((blip) => ({ ...blip, $_target: target }), true);
    return;
  }
  const shp = getShapeDeep(getSelectSelShpFormat().id)

  shp.blipFill = {
    ...shp.blipFill,
    blip: {
       ...shp.blipFill.blip,
      $_target: target,
    }
  }

  updateShape(shp);
  saveDexie();
}

function pasteImage() {

}

</script>

<template>
  <DialogBase
    :shape-only="!background"
    :title="background ? 'Format Background' : 'Format Shape'"
    :sub-tabbar-items="background ? bgPictureSubTabbarItems : subTabbarItems"
  >
  <template v-if="background">
    <LocalMedia
      title="Change Picture"
      preview
      :clickFunc="(_evt, img) => setImage(img.id || img?.src)"
      :clipboard-func="pasteImage"
    />
    <LayoutHeader label="Picture Transparency" />
    <RangeSlider
      :value="backgroundOpacity"
      :on-input="(val) => updateBackgroundBlip((blip) => ({
        ...blip,
        alphaModFix: { $_amt: Math.round(val * 1000) },
      }))"
      :on-change="saveDexie"
      :min="0"
      :max="100"
      :style="{ padding: '10px 20px 0 0', width: '100%', height: '20px' }"
    />
    <template v-for="eff in ['$_bright', '$_contrast']" :key="eff">
      <LayoutHeader :label="getBrighnessContrastLabel(eff)" />
      <RangeSlider
        :value="eff === '$_bright' ? backgroundBrightness : backgroundContrast"
        :on-input="(val) => updateBrightnessContrast(eff, val)"
        :on-change="saveDexie"
        :min="0"
        :max="200"
        :marks="{ 100: '' }"
        :step="10"
      />
    </template>
    <LayoutHeader
      label="Duotone..."
      :icon="PhotoTwotone"
      icon-color="#FF0000"
      :arrow="true"
      :on-click="() => toggleTaskPane('slidebackgroundduotone')"
    />
  </template>
  <template v-else>
  <LocalMedia
    title="Change Picture"
    preview
    :clickFunc="
      (evt, img) => {
        console.log(evt, img);
        setImage(img.id || img?.src);
      }
    "
    :clipboard-func="pasteImage"
  />

  <LayoutHeader label="Picture Options" />
  <NFlex
    vertical
    v-if="
      piniaSelect().selShpFormat?.blipFill &&
      piniaSelect().selShps.length == 1
    "
  >
    <ToolbarItem
      quaternary
      v-if="piniaSelect().selShpFormat?.blipFill"
      label="(AI) Erase Image BG"
      labelGap="15px"
      :icon="VideoBackgroundEffect20Filled"
      :size="30"
      :color="g.themeOverrides?.common?.primaryColor"
      n-padding="0"
      :onClick="
        () => {
          // rmbgBgsub();
          // rmbgUsingImgly();
          // rmbgUsingModernRembg();
          rmbgUsingXenova();
        }
      "
    />
    <div class="guide-toolbar-item">
      <ToolbarItem
        quaternary
        v-if="piniaSelect().selShpFormat?.blipFill"
        label="Trace Image Outline"
        labelGap="15px"
        :icon="Person"
        :size="30"
        :color="g.themeOverrides?.common?.primaryColor"
        n-padding="0"
        :onClick="
          () => {
            traceImage(piniaSelect().selShpFormat);
          }
        "
      />
      <NTooltip
        :style="{
          maxWidth: '400px',
        }"
        placement="right-end"
      >
        <template #trigger>ℹ️</template>
        Create shape silhouette.
      </NTooltip>
    </div>
    <div class="guide-toolbar-item">
      <ToolbarItem
        quaternary
        v-if="piniaSelect().selShpFormat?.blipFill"
        label="Make white color transparent"
        labelGap="15px"
        :icon="Opacity"
        :size="30"
        :color="g.themeOverrides?.common?.primaryColor"
        n-padding="0"
        :onClick="
          () => {
            makeTransparent('#FFFFFF');
          }
        "
      />
      <ToolbarItem
        quaternary
        v-if="piniaSelect().selShpFormat?.blipFill"
        label="Make black color transparent"
        labelGap="15px"
        :icon="Opacity"
        :size="30"
        :color="g.themeOverrides?.common?.primaryColor"
        n-padding="0"
        :onClick="
          () => {
            makeTransparent('#000000');
          }
        "
      />
      <NTooltip
        :style="{
          maxWidth: '400px',
        }"
        placement="right-end"
      >
        <template #trigger>ℹ️</template>
        Turn one color to transparent (currently only for WHITE).
      </NTooltip>
    </div>
  </NFlex>
  <LayoutHeader label="Picture Transparency" />
  <ShapeTransparency />

  <template v-for="eff in ['$_bright', '$_contrast']">
    <LayoutHeader :label="getBrighnessContrastLabel(eff)" />
    <RangeSlider
      :value="(piniaSelect().selShpFormat?.blipFill?.blip?.lum?.[eff] || 0) / 1000 + 100"
      :on-input="(val) => updateBrightnessContrast(eff, val)"
      :on-change="saveDexie"
      :min="0"
      :max="200"
      :marks="{ 100: '' }"
      :step="10"
    />
  </template>
  <LayoutHeader
    label="Duotone..."
    :icon="PhotoTwotone"
    iconColor="#FF0000"
    :arrow="true"
    :onClick="() => toggleTaskPane('duotonefx')"
    v-if="
      piniaSelect().selShpFormat?.blipFill ||
      piniaSelect().selShpFormat?.spPr?.blipFill
    "
  />
  <!-- <LayoutHeader label="Grayscale" />
  <NSwitch
    :value="!!piniaSelect().selShpFormat?.blipFill?.blip?.grayscl"
    :on-update:value="
      () =>
        (piniaSelect().selShpFormat.blipFill.blip.grayscl = { $_val: 1 })
    "
    style="margin-right: 10px"
  /> -->


  </template>
</DialogBase>
</template>
