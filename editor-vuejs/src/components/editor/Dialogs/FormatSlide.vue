<template>
  <DialogBase
    title="Format Background"
    :sub-tabbar-items="subTabbarItems"
    :fill-selectors="fillSelectors"
  >
    <!-- <LayoutHeader label="Slide Title" />
    <NInput
      :value="getSlideInfo()?.title || ''"
      @update:value="(val) => updateTitle(val)"
      placeholder="No title"
    /> -->

    <NCheckbox
      label="Show Master Graphics"
      :checked="!!getSlideInfo()?.showMaster"
      :on-update:checked="(val) => setShowMaster(val)"
    />

    <template v-if="sldBg.curFillTab == 'solidFill'">
      <LayoutHeader label="Background Color"></LayoutHeader>
      <SlideColorPicker
        :cur-color="
          mapStyleThemeColor(
            sldBg?.solidFill?.uniClr,
            getTheme(),
            getMasterInfo()?.clrMap,
          ) || '#ffffff'
        "
        :on-change="setBgSolidFill"
      />
    </template>
    <template v-if="sldBg.gradFill">
      <FillGradient :target="sldBg" :on-change="changeBgGradient" />
      <!-- <LayoutHeader label="Gradient Background" /> -->
      <!-- <ToolbarItem
        :icon="Gradient"
        label="Gradient Colors..."
        :onClick="
          (e) => {
            toggleTaskPane('slidegradient');
          }
        "
        bordered
      ></ToolbarItem> -->
    </template>
    <template v-if="sldBg.blipFill">
      <LocalMedia
        title="Change Picture"
        preview
        :clickFunc="
          (evt, img) => {
            console.log(evt, img);
            setBgImage(img.id || img?.src);
          }
        "
        :clipboard-func="pasteBg"
      />
      <!-- <div class="taskpane-guide">
        Select an image and set "use as slide background"
      </div> -->
      <!-- <NFlex vertical>
        <ToolbarItem
          quaternary
          label="Detach Image From Background"
          v-if="sldBg?.bgPr?.blipFill?.blip?.$_target"
          :icon="ImageNotSupportedSharp"
          :color="g.themeOverrides?.common?.primaryColor"
          n-padding="0"
          :onClick="detachBackground"
        />
      </NFlex> -->
    </template>
  </DialogBase>
</template>
<script setup lang="ts">
import { updateSlide, getSlidesMasterView, getSlidesMultiSelected, getSlidesSlideId, getTheme, getFileInfo, getLayoutInfo, getMasterInfo, getSlideInfo } from "shared-vuejs/editor";

// import DialogBase from "@/components/common/Layouts/DialogBase.vue";
import { piniaSlides } from "@/lib/common/store";
import LayoutHeader from "@/components/common/Layouts/LayoutHeader.vue";
import FillGradient from "../Selection/FillGradient.vue";
import { NCheckbox } from "naive-ui";

import {
  getAllMediaPics,
  loadSlideFromDexie,
  putSlideToDexie,
  saveDexie,
  saveThumb,
} from "shared-vuejs/api/dbutils";
import { mapStyleThemeColor } from "shared-vuejs/api/colorUtils";
import { ue } from "shared-vuejs/api/globalUtility";
import DialogBase from "@/components/common/Layouts/DialogBase.vue";
import StandardColors from "../../common/StandardColors.vue";
import { selectSlide } from "shared-vuejs/api/slide";
import LocalMedia from "../Media/LocalMedia.vue";
import { computed, onBeforeUnmount, watch } from "vue";
import { getSlideBg } from "shared-vuejs/api/slideUtils";

import { ref } from "vue";
import { PaintBucket24Filled } from "@vicons/fluent";
import { showMessage } from "shared-vuejs/api/utils.js";
import { getClipboardContents } from "shared-vuejs/api/clipboard.js";
import { processImage } from "shared-vuejs/api/upload.js";
import { crc32 } from "crc";
import { off, on } from "shared-vuejs/events";
import SlideColorPicker from "@/components/common/SlideColorPicker.vue";
import { refreshSlideBackground } from "@/lib/main/slideBackground";
import { Image24Regular } from "@vicons/fluent";

// function updateTitle(val) {
//   // const val = e.target.value;
//   console.log(val);
//   getStaticSlidesUpdateSlide()({
//     ...getSlideInfo(),
//     title: val,
//   });
//   saveDexie();
// }

const sldBg = ref(null as any);

updateCurrentBg();

const handleSlideLoaded = (event: Event) => {
  const { slideId } = (event as CustomEvent).detail;
  if (slideId === getSlideInfo()?.id) updateCurrentBg();
};
on("slideLoaded", handleSlideLoaded);
onBeforeUnmount(() => off("slideLoaded", handleSlideLoaded));

watch(() => piniaSlides().sldState, updateCurrentBg);

const fillSelectors = [
  {
    label: "Solid Background",
    isChecked: () => sldBg.value.curFillTab == "solidFill",
    onClick: () => {
      setBgSolidFill("FFFFFF");
    },
  },
  {
    label: "Gradient Background",
    isChecked: () => sldBg.value.curFillTab == "gradFill",
    onClick: () => {
      setBgGradient();
    },
  },
  {
    label: "Picture Background",
    isChecked: () => sldBg.value.curFillTab == "blipFill",
    onClick: () => {
      setBgImage();
    },
  },
];

const subTabbarItems = computed(() => [
  {
    tooltip: "Fill",
    taskpane: "formatslide",
    icon: PaintBucket24Filled,
  },
  {
    tooltip: "Picture",
    icon: Image24Regular,
    taskpane: "slidepictureoptions",
    show: !!sldBg.value?.blipFill,
  },
]);

function updateCurrentBg() {
  const bg = getSlideBg(
    getSlideInfo(),
    getLayoutInfo(),
    getMasterInfo(),
    getTheme(),
  );

  sldBg.value = {
    curFillTab: getFillTab(bg),
    ...bg,
  };
}

function getFillTab(bg) {
  if (bg?.gradFill) {
    return "gradFill";
  } else if (bg?.blipFill) {
    return "blipFill";
  } else {
    return "solidFill";
  }
}

async function setBgImage(image?) {
  let target = image;
  if (!target) {
    const mediaColl = await getAllMediaPics(getFileInfo()?.id);
    target = mediaColl?.[0]?.name || "image1.png";
  }
  updateBgFill({
    ...getSlideInfo().bg,
    bgPr: {
      gradFill: null,
      solidFill: null,
      blipFill: {
        blip: {
          $_target: target,
        },
      },
    },
    bgRef: null,
  });
}

function setBgSolidFill(color) {
  updateBgFill({
    ...getSlideInfo().bg,
    bgPr: {
      gradFill: null,
      blipFill: null,
      solidFill: {
        uniClr: {
          $_otag: "srgbClr",
          $_val: color.replace("#", "") || "FF0000",
        },
      },
    },
    bgRef: null,
  });
}

function setBgGradient() {
  updateBgFill({
    ...getSlideInfo().bg,
    bgPr: {
      solidFill: null,
      blipFill: null,
      gradFill: {
        gsLst: {
          gs: [
            {
              uniClr: { $_otag: "srgbClr", $_val: "FFFFFF" },
              $_pos: 0,
            },
            {
              uniClr: { $_otag: "srgbClr", $_val: "000000" },
              $_pos: 100000,
            },
          ],
        },
        path: {
          $_path: "circle",
        },
      },
    },
    bgRef: null,
  });
}

function changeBgGradient(newGradFill) {
  updateBgFill({
    ...getSlideInfo().bg,
    bgPr: {
      solidFill: null,
      blipFill: null,
      gradFill: newGradFill,
    },
  });
}

async function updateBgFill(bg) {
  let slides: any = [getSlidesSlideId()];
  if (getSlidesMultiSelected().length > 0) {
    slides = getSlidesMultiSelected();
  }

  let sldType = "slides";
  if (getSlidesMasterView()) {
    sldType = "slideLayouts";
  }

  const fileInfo = getFileInfo();
  for (const sldId of slides) {
    const isCurrentSlide = sldId === getSlidesSlideId() &&
      getSlideInfo()?.id === sldId;
    const sldInfo = isCurrentSlide
      ? getSlideInfo()
      : await loadSlideFromDexie(fileInfo.id, sldId, sldType);
    sldInfo.bg = bg;
    if (isCurrentSlide) {
      updateSlide(sldInfo);
      refreshSlideBackground();
    } else {
      await putSlideToDexie(fileInfo.id, sldInfo.id, sldInfo, sldType);
      await saveThumb(sldInfo.id);
    }
  }
  await saveDexie();
  updateCurrentBg();
}

async function pasteBg() {
  const { clpImage } = await getClipboardContents();
  if (clpImage) {
    const media = await processImage(clpImage, {
      name: "f" + crc32(await clpImage.arrayBuffer()).toString(16) + ".webp",
      fileId: getFileInfo().id,
    });
    if (media) {
      await updateBgFill({
        ...getSlideInfo().bg,
        bgPr: {
          ...getSlideInfo().bg?.bgPr,
          solidFill: null,
          gradFill: null,
          blipFill: {
            ...getSlideInfo().bg?.bgPr?.blipFill,
            blip: { $_target: media.name, $_w: media.w, $_h: media.h },
          },
        },
      });
    }
  } else {
    showMessage("No picture in clipboard", 3000);
  }
}

async function setShowMaster(val) {
  const sldInfo = getSlideInfo();
  sldInfo.showMaster = val;
  updateSlide(sldInfo);
  await saveDexie();
  selectSlide(getSlidesSlideId(), true);
  saveThumb(getSlidesSlideId());
}
</script>
<style scoped>
.subtitle {
  margin-top: 20px;
  margin-bottom: 5px;
  font-size: 14px;
  font-weight: bold;
}

/* .guide {
  font-size: 14px;
} */
</style>
