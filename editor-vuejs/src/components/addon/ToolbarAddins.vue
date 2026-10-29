<template>
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
import { getShapeImage } from "shared-vuejs/api/downloadShape";
import { piniaInfo, piniaSelect } from "@/lib/common/store";
import {
  ImageEdit20Regular,
  VideoBackgroundEffect20Filled,
} from "@vicons/fluent";
import ToolbarItem from "../editor/Toolbars/ToolbarItem.vue";
import g from "shared-vuejs/api/global";
import { rmbgUsingXenova } from "../editor/Toolbars/ToolbarUtils";
import { Person } from "@vicons/carbon";
import { traceImage } from "shared-vuejs/api/svgUtils";

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
