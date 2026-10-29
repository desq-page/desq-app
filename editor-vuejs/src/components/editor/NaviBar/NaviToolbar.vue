<template>
  <div class="navi-toolbar">
    <div v-if="!piniaSlides().masterView">
      <span style="font-size: 14px">Page </span>
      <input
        :style="{
          width: '28px',
          height: '14px',
          border: '1px solid #ccc',
          fontSize: '14px',
          textAlign: 'right',
        }"
        :value="piniaSlides().slideIndex"
        @change="(e) => gotoSlide((e.target as any).value)"
      />
      <span style="font-size: 14px"
        >&nbsp;of&nbsp;{{ getFileInfo()?.slides?.length }}</span
      >
    </div>
    <ToolbarItem
      v-if="!piniaSlides().masterView"
      :size="18"
      :icon="ArrowUp24Regular"
      :onClick="
        (e) => {
          gotoSlide(piniaSlides().slideIndex - 1);
        }
      "
    />
    <ToolbarItem
      v-if="!piniaSlides().masterView"
      :size="18"
      :icon="ArrowDown24Regular"
      :onClick="
        (e) => {
          gotoSlide(piniaSlides().slideIndex + 1);
        }
      "
    />
    <!-- <ToolbarItem
      quaternary
      :icon="AddSquare24Regular"
      label="Add Page"
      :options="newSlideOptions"
      v-if="!piniaSlides().masterView"
      :tooltip="'Add slide'"
      :class="{ disabled: !!piniaInfo().useGrid }"
      :onClick="
        async () => {
          const slideId = await addSlide(
            { ...getFileInfo() },
            piniaSlides().slideInfo.layoutid,
          );
          // await saveDexie();
          selectSlide(slideId);
        }
      "
    /> -->
    <!-- <ToolbarItem
      quaternary
      :icon="SlideMultiple24Regular"
      :options="newSlideOptions"
      v-if="!piniaSlides().masterView && piniaResize().windowWidth >= 1024"
      :tooltip="'Duplicate slide'"
      :class="{ disabled: !!piniaInfo().useGrid }"
      :onClick="duplicateSlide"
    /> -->

    <!-- <ToolbarItem
      quaternary
      button-type="primary"
      v-if="piniaSlides().masterView"
      label="Close Master"
      :onClick="
        (e) => {
          editMaster();
        }
      "
    />

    <ToolbarItemDropdown
      quaternary
      :icon="MoreHorizontal32Filled"
      :options="slideOptions"
      :color="g.themeOverrides?.common?.primaryColor"
      tooltip="Menu..."
      :tooltipDelay="1000"
    />

    <ToolbarItemDropdown
      quaternary
      :icon="MoreHorizontal32Filled"
      :options="slideOptions"
      popoverId="popover-slide-options"
      :xy="piniaInfo().curPopupXY || { x: 10000, y: 0 }"
      :color="g.themeOverrides?.common?.primaryColor"
    /> -->
  </div>
  <!-- <PopOver
    :show="showLayout"
    @closePopover="onClosePopover()"
    :el="insertSlideTarget"
  >
    <LayoutList />
  </PopOver> -->
</template>
<script setup lang="ts">
import { getSlidesMasterView, getFileInfo } from "shared-vuejs/editor";

// import g from "shared-vuejs/api/global";
import { nextTick } from "vue";
// import { insertSlideFunction } from "shared-vuejs/api/layout";
// import { insertMaster } from "shared-vuejs/api/slide";
import { piniaSlides } from "@/lib/common/store";
// import { loadLayout } from "shared-vuejs/src/edlib/load/editor.pouchdb";
// import { insertLayout } from "shared-vuejs/api/slide";

import { ArrowDown24Regular, ArrowUp24Regular } from "@vicons/fluent";
import ToolbarItem from "../Toolbars/ToolbarItem.vue";

import { getThumbDimension } from "./NaviBarLib";

import { selectSlide } from "shared-vuejs/api/slide";
import g from "shared-vuejs/api/global";


function gotoSlide(slideIndex) {
  if (slideIndex >= 1 && !getSlidesMasterView()) {
    const id = getFileInfo().slides[slideIndex - 1]?.id;
    if (id) {
      selectSlide(id);
      nextTick(() => {
        const [THUMBWIDTH, THUMBHEIGHT] = getThumbDimension();
        const navi = document.querySelector(".navi");
        if (navi) {
          navi.scrollTo(0, (slideIndex - 1) * THUMBHEIGHT);
        }
      });
    }
  }
}
</script>

<style scoped>
.navi-toolbar {
  bottom: 0px;
  display: flex;
  position: absolute;
  /* width: 100%; */
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
