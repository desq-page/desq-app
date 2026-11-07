<template>
  <ToolbarItem caption="Local JavaScript…" :icon="Code24Regular" :size="30" :color="g.themeOverrides?.common?.primaryColor" :onClick="() => scriptDialogOpen = true" />
  <ScriptCodeDialog v-if="scriptDialogOpen" v-model:show="scriptDialogOpen" />
  <ToolbarItem
    caption="Edit In Photopea..."
    :icon="ImageEdit20Regular"
    :size="30"
    :color="g.themeOverrides?.common?.primaryColor"
    n-padding="0"
    :onClick="
      () => {
        editInPhotopea(piniaSelect().selShpFormat);
      }
    "
    :disabled="
      !piniaSelect().selShpFormat ||
      !!piniaSelect().selShpFormat?.blipFill?.video ||
      piniaSelect().selShpFormat?.type == 'chart' ||
      piniaSelect().selShpFormat?.type == 'table'
    "
  />

  <ToolbarItem
    caption="Detect Text Regions"
    :icon="ImageEdit20Regular"
    :size="30"
    :disabled="!canDetectText() || extracting"
    :onClick="() => runImageExtraction(true)"
  />
  <ToolbarItem
    caption="Merge Selected Regions"
    :icon="ImageEdit20Regular"
    :size="30"
    :disabled="!canMergeRegions() || extracting"
    :onClick="mergeRegions"
  />
  <ToolbarItem
    caption="Extract Text"
    :icon="ImageEdit20Regular"
    :size="30"
    :disabled="!canExtractText() || extracting"
    :onClick="() => runImageExtraction(false)"
  />
  <ToolbarItem
    caption="Extract Text (Kites AOT)"
    :icon="ImageEdit20Regular"
    :size="30"
    :disabled="!canExtractText() || extracting"
    :onClick="() => runImageExtraction(false, undefined, 'aot')"
  />
  <ToolbarItem
    caption="Extract Vietnamese Text"
    :icon="ImageEdit20Regular"
    :size="30"
    :disabled="!canExtractText() || extracting"
    :onClick="() => runImageExtraction(false, 'vi-VN')"
  />

  <ToolbarItem
    quaternary
    :disabled="!piniaSelect().selShpFormat?.blipFill"
    caption="Remove Background"
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

  <ToolbarItem
    quaternary
    :disabled="!piniaSelect().selShpFormat?.blipFill"
    caption="Trace Outline"
    :icon="Person"
    :size="20"
    :color="g.themeOverrides?.common?.primaryColor"
    n-padding="0"
    :onClick="
      () => {
        traceImage(piniaSelect().selShpFormat);
      }
    "
  />
</template>

<script setup lang="ts">
import {ref} from 'vue';
import ScriptCodeDialog from '../editor/Dialogs/ScriptCodeDialog.vue';
const scriptDialogOpen=ref(false);
import { getShapeImage } from "shared-vuejs/api/downloadShape";
import { piniaInfo, piniaSelect } from "@/lib/common/store";
import {
  ImageEdit20Regular,
  Code24Regular,
  VideoBackgroundEffect20Filled,
} from "@vicons/fluent";
import ToolbarItem from "../editor/Toolbars/ToolbarItem.vue";
import g from "shared-vuejs/api/global";
import { rmbgUsingXenova } from "../editor/Toolbars/ToolbarUtils";
import { Person } from "@vicons/carbon";
import { getFileInfo, getShapeDeep, getSlidesSlideId } from "shared-vuejs/editor";
import { showError, showMessage } from "shared-vuejs/api/utils";
import { traceImage } from "shared-vuejs/api/svgUtils";

const extracting = ref(false);

function canDetectText() {
  const selection = piniaSelect();
  const shape = selection.selShpFormat;
  return selection.selShps.length === 1 && !selection.selGrpShps?.length &&
    shape?.type === 'image' && !shape.locked && !shape.video && !shape.audio && !!shape.blipFill?.blip;
}

function selectedOcrRegions() {
  const selection = piniaSelect();
  if (!selection.selShps.length || selection.selGrpShps?.length) return [];
  const regions = selection.selShps.map(id => getShapeDeep(id));
  return regions.every(shape => shape?.ocrRegion && !shape.locked) ? regions : [];
}

function canExtractText() {
  return selectedOcrRegions().length > 0;
}

function canMergeRegions() {
  const regions = selectedOcrRegions();
  const first = regions[0]?.ocrRegion;
  return regions.length > 1 && regions.every(({ ocrRegion }) =>
    ocrRegion.pictureId === first.pictureId && ocrRegion.source === first.source && ocrRegion.crop === first.crop);
}

async function mergeRegions() {
  if (extracting.value || !canMergeRegions()) return;
  const regions = selectedOcrRegions();
  const fileId = getFileInfo()?.id;
  const slideId = getSlidesSlideId();
  extracting.value = true;
  try {
    const { mergeImageTextRegions } = await import('./extract-image-text.mjs');
    if (getFileInfo()?.id !== fileId || getSlidesSlideId() !== slideId)
      throw new Error('The slide changed before the regions could be merged.');
    await mergeImageTextRegions(regions);
  } catch (error) {
    showError(error instanceof Error ? error.message : String(error), 'Merge text regions');
  } finally {
    extracting.value = false;
  }
}

async function runImageExtraction(detect: boolean, language?: string, engine = 'migan') {
  if (extracting.value) return;
  const shapes = detect
    ? (canDetectText() ? [piniaSelect().selShpFormat] : [])
    : selectedOcrRegions();
  if (!shapes.length) return;
  const fileId = getFileInfo()?.id;
  const slideId = getSlidesSlideId();
  const info = piniaInfo();
  extracting.value = true;
  info.loadingBar = 'Preparing image…';
  try {
    const { detectImageTextRegions, extractImageText } = await import('./extract-image-text.mjs');
    const progress = (message: string) => { info.loadingBar = message; };
    if (detect) {
      if (!await detectImageTextRegions(shapes[0], progress)) showMessage('No text regions were found.');
    } else {
      let unreadable = 0;
      for (const [index, shape] of shapes.entries()) {
        if (getFileInfo()?.id !== fileId || getSlidesSlideId() !== slideId)
          throw new Error('The slide changed during extraction.');
        const regionProgress = (message: string) =>
          progress(shapes.length > 1 ? `Region ${index + 1} of ${shapes.length} · ${message}` : message);
        if (!await extractImageText(shape, regionProgress, language, engine)) unreadable++;
      }
      if (unreadable) showMessage(shapes.length === 1
        ? 'No text was recognized in this region.'
        : `No text was recognized in ${unreadable} of ${shapes.length} selected regions.`);
    }
  } catch (error) {
    showError(error instanceof Error ? error.message : String(error), 'Image text extraction');
  } finally {
    info.loadingBar = '';
    extracting.value = false;
  }
}

async function editInPhotopea(shp) {
  const dataUrl = await getShapeImage(shp);
  piniaInfo().openImagePhotopea = dataUrl;
  // dataUrl = await blobToDataURL(dataUrl)
  // const url =
  //   "https://www.photopea.com#" +
  //   JSON.stringify({
  //     files: [dataUrl],
  //     // environment: {
  //     //   customIO: {
  //     //     save: "app.activeDocument.saveToOE('png')",
  //     //   },
  //     // },
  //   });
  // window.open(url, "photopea");
}
</script>
