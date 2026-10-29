<template>
  <ToolbarItemDropdown
    :options="viewOptions"
    :icon="Orientation24Filled"
    :size="26"
    :label="piniaResize().windowWidth >= 769 ? '&nbsp;Adaptive Layout' : ''"
    button-size="small"
  />
</template>
<script setup lang="ts">
import { getFileInfo, setInfoUseGrid } from "shared-vuejs/editor";

import { MobileAlt } from "@vicons/fa";
import { piniaInfo, piniaResize, piniaSlides } from "@/lib/common/store";
import { computed, shallowRef, watch } from "vue";
import ToolbarItemDropdown from "./ToolbarItemDropdown.vue";
import { Orientation24Filled, SlideSize24Regular } from "@vicons/fluent";
import { deselectAll } from "shared-vuejs/api/handle";
import { DesktopWindowsRound } from "@vicons/material";
import { showMessage } from "shared-vuejs/api/utils";

import { selectSlide } from "shared-vuejs/api/slide.js";
import { toggleTaskPane } from "@/lib/main/utils.js";

const viewIcon = shallowRef(DesktopWindowsRound as any);
watch(
  () => piniaInfo().useGrid,
  () => {
    if (piniaInfo().useGrid) {
      if (piniaInfo().currentTaskPane !== "sizingpanel") {
        piniaInfo().setCurTaskPane("");
      }
      viewIcon.value = MobileAlt;
      showMessage(
        "Adaptive Layout Mode: adjust shape size and position to fit selected screen.",
        50000,
      );
    } else {
      showMessage("");
      viewIcon.value = DesktopWindowsRound;
    }
    // need to reselect to refresh
    selectSlide(piniaSlides().slideId, true);
  },
);

// const customSizes = computed(() => (getFileInfo().grids || []).map(useGrid => ({

//     label: useGrid.key,
//     icon: Instagram,
//     key: useGrid.key,
//     onClick: () => {
//       deselectAll();
//       piniaInfo().useGrid = useGrid.key;
//     },
//     disabled: piniaInfo().useGrid == useGrid.key,

// })))

const viewOptions: any = computed(() => [
  {
    label: "Original Layout",
    icon: DesktopWindowsRound,
    key: "landscape",
    onClick: () => {
      showMessage(null);
      deselectAll();
      setInfoUseGrid("");
    },
    disabled: !piniaInfo().useGrid,
  },
  {
    label:
      "Portrait Layout" +
      (piniaResize().slideWidth < piniaResize().slideHeight ? " (N/A)" : ""),
    icon: MobileAlt,
    key: "portrait",
    onClick: () => {
      deselectAll();
      setInfoUseGrid("m");
    },
    disabled:
      piniaInfo().useGrid == "m" ||
      piniaResize().slideWidth < piniaResize().slideHeight,
  },
  // {
  //   label: "Square",
  //   icon: Instagram,
  //   key: "instagram",
  //   onClick: () => {
  //     deselectAll();
  //     piniaInfo().useGrid = "ig";
  //   },
  //   disabled: piniaInfo().useGrid == "ig",
  // },
  // ...customSizes.value,
  {
    type: "divider",
  },
  {
    label: "Manage Variants...",
    icon: SlideSize24Regular,
    size: 26,
    key: "manage",
    onClick: () => {
      deselectAll();
      toggleTaskPane("sizingpanel");
    },
  },
]);
</script>
