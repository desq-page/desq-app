<template>
  <ToolbarItem
    quaternary
    :icon="AddSquare24Regular"
    :options="newSlideOptions"
    :size="26"
    v-if="!piniaSlides().masterView"
    caption="New Page"
    :class="{ disabled: !!piniaInfo().useGrid }"
    :onClick="
      async () => {
        const slideId = await addSlide(
          { ...getFileInfo() },
          getSlideInfo().layoutid,
        );
        // await saveDexie();
        selectSlide(slideId);
      }
    "
  />

  <!-- <ToolbarItem
    quaternary
    :icon="SlideMultiple24Regular"
    :options="newSlideOptions"
    v-if="!piniaSlides().masterView && piniaResize().windowWidth >= 1024"
    :class="{ disabled: !!piniaInfo().useGrid }"
    :onClick="duplicateSlide"
    :size="30"
    caption="Duplicate Page"
  /> -->

  <!-- <ToolbarItem
    quaternary
    button-type="primary"
    v-if="piniaSlides().masterView"
    caption="Close Master"
    :onClick="
      (e) => {
        editMaster();
      }
    "
  /> -->
<!-- 
  <ToolbarItemDropdown
    quaternary
    :icon="MoreHorizontal32Filled"
    :options="slideOptions"
    :color="g.themeOverrides?.common?.primaryColor"
    tooltip="Menu..."
    :tooltipDelay="1000"
  /> -->

  <!-- <ToolbarItemDropdown
    quaternary
    :icon="MoreHorizontal32Filled"
    :options="slideOptions"
    popoverId="popover-slide-options"
    :xy="piniaInfo().curPopupXY || { x: 10000, y: 0 }"
    :color="g.themeOverrides?.common?.primaryColor"
  /> -->
  <!-- <ToolbarItem
    caption="Format Background"
    :icon="ColorBackground24Regular"
    :disabled="!!getInfoUseGrid()"
    :onClick="
      () => {
        deselectAll();
        toggleTaskPane('formatslide');
      }
    "
    :active="piniaInfo().currentTaskPane == 'formatslide'"
  /> -->
</template>
<script setup lang="ts">
import { getInfoUseGrid, getFileInfo, getSlideInfo } from "shared-vuejs/editor";

// import g from "shared-vuejs/api/global";
// import { insertSlideFunction } from "shared-vuejs/api/layout";
// import { insertMaster } from "shared-vuejs/api/slide";
import { piniaInfo, piniaSlides } from "@/lib/common/store";
// import { loadLayout } from "shared-vuejs/src/edlib/load/editor.pouchdb";
// import { insertLayout } from "shared-vuejs/api/slide";

import { AddSquare24Regular } from "@vicons/fluent";
import ToolbarItem from "../Toolbars/ToolbarItem.vue";

import { newSlideOptions } from "../NaviBar/NaviBarLib";

import { selectSlide } from "shared-vuejs/api/slide";
import { addSlide } from "shared-vuejs/api/load";
import g from "shared-vuejs/api/global";

</script>

<style scoped>
.navi-toolbar {
  bottom: 0px;
  display: flex;
  position: absolute;
  width: 100%;
  align-items: center;
  height: v-bind("`${g.STATUSBAR_HEIGHT}px`");
  border-top: 1px solid #ddd;
  /* background: #efefef; */
  z-index: 3;
  overflow: hidden;
  justify-content: space-between;
  padding: 0 10px;
  box-sizing: border-box;
}

@media screen and (max-width: 720px) {
  .navi-toolbar {
    justify-content: start;
    gap: 20px;
  }
}
</style>
