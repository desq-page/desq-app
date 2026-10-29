<template>
  <div
    :style="{
      width: '100%',
    }"
  >
    <div
      class="navi"
      @scroll="onScroll"
      :style="{ height: height + 'px' }"
      ref="navi"
      @mouseup="showSlideContextMenu"
    >
      <ThumbTable :start="start" :end="end" />
    </div>
  </div>
</template>
<script setup lang="ts">
import { getSlidesMasterView } from "shared-vuejs/editor";

// import { hideActiveMenu } from "shared-vuejs/api/layout";
import { ref } from "vue";
import ThumbTable from "./ThumbTable.vue";
import { useDebounceFn } from "@vueuse/core";
import {
  activeSlideHeight,
  activeSlideWidth,
} from "shared-vuejs/api/slide";
import {
  showSlideContextMenu,
} from "@/lib/main/contextmenu";

import { piniaResize } from "@/lib/common/store.js";

const start = ref(0);
const end = ref(10);

const navi = ref();

defineProps({
  height: Number,
});

// function showContextMenu(e) {
//   if (e.button == 2) {
//      setTimeout(() => {
//       piniaInfo().curPopupXY = { x: e.pageX, y: e.pageY + 10 };
//       piniaInfo().curPopupId = "popover-slide-options";
//     }, 100);
//   }
// }

function onScroll(e) {
  // hideActiveMenu();
  if (!getSlidesMasterView()) {
    useDebounceFn(() => updateThumbPos(e), 300)();
  }
}

function updateThumbPos(e) {
  if (!e.target) return;
  const thumbHeight =
    (piniaResize().THUMBWIDTH * activeSlideHeight()) / activeSlideWidth() + 10;
  const currentSldIdx = Math.round(e.target.scrollTop / thumbHeight) || 0;
  const lastSldIdx =
    currentSldIdx + Math.round(e.target.offsetHeight / thumbHeight) + 15 || 16;

  start.value = Math.max(0, currentSldIdx - 15 || 0);
  end.value = Math.max(lastSldIdx, 15);
}
</script>
<style scoped>
.navi {
  width: 100%;
  height: 100%;
  overflow-y: scroll;
  top: 0;
  position: absolute;
  background-color: #efefef;
  color: black;
  /* border-left: 1px solid #ccc; */
  /* Hide scrollbar track, show only thumb */
  scrollbar-color: rgba(0,0,0,0.4) transparent; /* thumb and track */
}

/* WebKit scrollbar styling */
.navi::-webkit-scrollbar {
  width: 25px;
  height: 20px;
}
.navi::-webkit-scrollbar-track {
  background: transparent;
}
.navi::-webkit-scrollbar-thumb {
  background-color: rgba(0,0,0,0.4);
  border-radius: 4px;
  width: 12px;
  border: 4px solid transparent; /* creates space around thumb */
}
</style>
