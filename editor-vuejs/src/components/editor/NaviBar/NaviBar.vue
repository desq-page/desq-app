<template>
  <div
    class="navibar"
    :style="navibarStyle"
    v-show="piniaInfo().showNavi && !documentMode"
    ref="navibar"
    @contextmenu.prevent
    @keydown.stop
    @keyup.down.stop="navigateDown"
    @keyup.up.stop="navigateUp"
    tabindex="1"
  >
    <NavigatorPanel v-if="!documentMode" :height="height" />
    <!-- <NaviToolbar /> -->
    <ToolbarItemDropdown
      quaternary
      :icon="MoreHorizontal32Filled"
      :options="slideOptions"
      :usePointerUp="true"
      popoverId="popover-slide-options"
      :xy="piniaInfo().curPopupXY || { x: 10000, y: 0 }"
      :color="g.themeOverrides?.common?.primaryColor"
      v-if="piniaInfo().curPopupId == 'popover-slide-options'"
    />
  </div>
</template>
<style scoped>
.navibar {
  position: absolute;
  z-index: 5;
  box-shadow: 1px -1px 1px 0px rgba(149, 146, 146, 0.5), 1px 2px 1px 0px rgba(149, 146, 146, 0.5);;
  border-right: 1px solid #ddd;
  border-top: 1px solid #ddd;
  outline: none;
}
</style>
<script setup lang="ts">
import { getSlidesCalcSlideIndex, getFileInfo, getSlideInfo } from "shared-vuejs/editor";

import NavigatorPanel from "./NavigatorPanel.vue";
import { isWordDocument } from "shared-vuejs/api/save-document";
import { useResizeObserver } from "@vueuse/core";
import { computed, nextTick, ref, watch } from "vue";
import g from "shared-vuejs/api/global";
import { piniaInfo, piniaResize, piniaSlides } from "@/lib/common/store";
import { selectSlide } from "shared-vuejs/api/slide";

import { getThumbDimension, slideOptions } from "./NaviBarLib";
import { hideEditor } from "shared-vuejs/api/updateText";
import { MoreHorizontal32Filled } from "@vicons/fluent";
import ToolbarItemDropdown from "../Toolbars/ToolbarItemDropdown.vue";
// import NaviToolbar from "./NaviToolbar.vue";


// const show = ref(true);
const height = ref(0);
const navibar = ref(null as any);
const navibarStyle = ref(null as any);
const documentMode = computed(() => {
  // File metadata is plain state; page/store notifications invalidate this view.
  piniaSlides().slideId;
  piniaSlides().sldState;
  return isWordDocument(getFileInfo(), [getSlideInfo()]);
});
watch(documentMode, value => {
  if (value) piniaInfo().toggleNavi(false);
}, { immediate: true });

const tH = g.TOOLBARTOP_HEIGHT;
const bH = g.STATUSBAR_HEIGHT;

// const naviWidth = ref(g.DEFAULT_RIGHTPANE_WIDTH);

watch(
  () => piniaInfo().showNavi,
  () => {
    if (
      piniaInfo().showNavi &&
      piniaResize().windowWidth <= 1024 &&
      piniaInfo().currentTaskPane !== "sizingpanel"
    ) {
      piniaInfo().setCurTaskPane("");
    }
    hideEditor();
    calcStyle();
  },
);

function calcStyle() {
  if (piniaResize().windowWidth < 769) {
    navibarStyle.value = {
      bottom: 0,
      width: `100vw`,
      height: `${piniaResize().NAVI_WIDTH}px`,
      left: 0,
    };
  } else {
    navibarStyle.value = {
      top: '1px', //`${g.TOOLBARTOP_HEIGHT}px`,
      width: `${piniaResize().NAVI_WIDTH}px`,
      height: `${height.value}px`,
      left: 0,
    };
  }
};

useResizeObserver(document.body, () => {
  if (piniaResize().windowWidth < 1024 && piniaResize().windowHeight > 769) {
    piniaInfo().toggleNavi(false);
  } else if (piniaResize().windowWidth > 1024) {
    piniaInfo().toggleNavi(true);
  }

  if (piniaResize().windowWidth < 769) {
    height.value = 350 - bH;
  } else {
    height.value = window.innerHeight - tH - bH;
  }

  calcStyle();
});

function navigateDown() {
  const slideIndex = getSlidesCalcSlideIndex();
  if (slideIndex <= getFileInfo().slides.length - 1) {
    scrollToSlide(slideIndex + 1);
  }
}

function navigateUp() {
  const slideIndex = getSlidesCalcSlideIndex();
  if (slideIndex >= 2) {
    scrollToSlide(slideIndex - 1);
  }
}

function scrollToSlide(idx) {
  const id = getFileInfo().slides[idx - 1]?.id;
  if (id) {
    selectSlide(id);
    nextTick(() => {
      const [THUMBWIDTH, THUMBHEIGHT] = getThumbDimension();
      console.log(idx, THUMBHEIGHT);
      // gid("thumb-" + id)?.scrollIntoViewIfNeeded();
      const navi = document.querySelector(".navi");
      if (navi) {
        navi.scrollTop = (idx - 1) * THUMBHEIGHT;
      }
      navibar.value?.focus();
    });
  }
}
</script>
