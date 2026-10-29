<template>
  <div
    :class="$style.slidecontainer"
    @contextmenu.prevent
    @pointerdown.capture="dismissShapeContextMenu"
  >
    <div id="wcvCont"></div>
    <ShapeMenuDropdown useContext />
    <SlideContentOptions />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, useCssModule, watch, onMounted, onBeforeUnmount } from "vue";
import { piniaInfo, piniaResize, piniaSelect } from "@/lib/common/store";

import g from "shared-vuejs/api/global";

import SlideContentOptions from "./Toolbars/SlideContentOptions.vue";
import ShapeMenuDropdown from "./Toolbars/ShapeMenuDropdown.vue";
import { gid } from "shared-vuejs/api/utility";
import WorkCanvasLib from "shared-vuejs/api/WorkCanvasLib";
import { useResizeObserver } from "@vueuse/core";
// import SlideEdit from "./SlideEdit.vue";

function dismissShapeContextMenu(event: PointerEvent) {
  if (
    event.button === 0 &&
    event.target instanceof Element &&
    event.target.closest("#workcanvas") &&
    piniaInfo().curPopupId === "shape-toolbar-popup"
  ) {
    piniaInfo().setCurPopup("");
  }
}

let cleanupWorkCanvas: (() => void) | undefined;

onMounted(() => {
  const placeholder = gid("wcvCont");
  if (!placeholder) return;
  const canvas = WorkCanvasLib.create();
  placeholder.replaceWith(canvas.element);
  cleanupWorkCanvas = canvas.cleanup;
});

onBeforeUnmount(() => {
  cleanupWorkCanvas?.();
  cleanupWorkCanvas = undefined;
});

const panScroll = ref("pan-x pan-y");

watch([piniaSelect()], () => {
  // console.log(piniaHandling().handlingInfo);
  if (g.globalTouch) {
    if (piniaSelect().selShps.length > 0) {
      panScroll.value = "none";
    } else {
      panScroll.value = "pan-x pan-y";
    }
  }
});

const workcanvasHeight = computed(() => {
  if (piniaResize().windowWidth < 769) {
    return `calc(100% - ${piniaResize().TASKPANE_WIDTH + piniaResize().INSERTPANE_WIDTH + piniaResize().NAVI_WIDTH}px)`;
  } else {
    return "100%";
  }
});

watch(piniaResize(), () => {
  recalcResize();
});

useResizeObserver(document.body, () => {
  recalcResize();
});

function recalcResize() {
  piniaResize().windowWidth = window.innerWidth;
  piniaResize().windowHeight = window.innerHeight;
  let workcanvasW, workcanvasH, workcanvasX, workcanvasY;
  if (piniaResize().windowWidth < 769) {
    workcanvasW = piniaResize().windowWidth;
    workcanvasH =
      piniaResize().windowHeight -
      piniaResize().NAVI_WIDTH -
      piniaResize().TASKPANE_WIDTH -
      piniaResize().INSERTPANE_WIDTH -
      g.TOOLBARTOP_HEIGHT;
    workcanvasX = 0;
    workcanvasY = piniaResize().NAVI_WIDTH;
  } else {
    workcanvasW =
      piniaResize().windowWidth -
      piniaResize().NAVI_WIDTH -
      piniaResize().TASKPANE_WIDTH -
      piniaResize().INSERTPANE_WIDTH;
    workcanvasH =
      piniaResize().windowHeight - g.TOOLBARTOP_HEIGHT - g.STATUSBAR_HEIGHT;
    workcanvasX = piniaResize().NAVI_WIDTH;
    workcanvasY = 0;
  }
  piniaResize().workcanvasW = workcanvasW;
  piniaResize().workcanvasH = workcanvasH;
  piniaResize().workcanvasX = workcanvasX;
  piniaResize().workcanvasY = workcanvasY;
  WorkCanvasLib.resizeCanvas({
    workcanvasX,
    workcanvasY,
    workcanvasW,
    workcanvasH,
  });
}

const $style = useCssModule();
</script>

<style module>
.slidecontainer {
  width: 100vw;
  height: v-bind("workcanvasHeight");
  z-index: 0;
  left: 0;
  top: 0;
  font-size: 18px;
  background-color: #ececec;
  overflow: hidden;
  position: absolute;
  transition: all 0.2s;
  display: flex;
  justify-content: center;
  /* box-shadow: 0 1px 1px 1px rgba(0, 0, 0, 0.3); */
}
</style>
