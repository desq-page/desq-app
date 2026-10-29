<template>
  <div
    :class="$style['right-container']"
    :style="rightContainerPos"
    @contextmenu.prevent
    @click="
      () => {
        piniaInfo().toggleNavi(!piniaInfo().showNavi);
      }
    "
  >
    <NIcon
      :size="piniaResize().windowWidth < 769 ? 24 : 28"
      :style="{
        // top: piniaResize().windowWidth < 769 ? 0 : '5px',
      }"
      ><component
        :is="
          piniaResize().NAVI_WIDTH
            ? piniaResize().windowWidth < 769
              ? ChevronDoubleDown20Filled
              : ChevronDoubleLeft20Filled
            : LayoutSidebar
        "
    /></NIcon>
    <!-- <ToolbarItem
      quaternary
      :icon="
        piniaResize().NAVI_WIDTH
          ? piniaResize().windowWidth < 769
            ? ChevronDoubleDown20Filled
            : ChevronDoubleRight20Filled
          : StackedScrolling1
      "
      :size="28"
      :onClick="() => (piniaInfo().showNavi = !piniaInfo().showNavi)"
      :tooltip="piniaInfo().showNavi ? undefined : 'Slides'"
    /> -->
  </div>
</template>

<script setup lang="ts">
import { piniaInfo, piniaResize } from "@/lib/common/store";

import { computed, useCssModule, watch } from "vue";
import {
  ChevronDoubleDown20Filled,
  ChevronDoubleLeft20Filled,
} from "@vicons/fluent";
import { NIcon } from "naive-ui";
import { LayoutSidebar } from "@vicons/tabler";
import { ref } from "vue";
import { useResizeObserver } from "@vueuse/core";
import g from "shared-vuejs/api/global";

const $style = useCssModule();
const rightContainerPos = ref(null as any)

useResizeObserver(document.body, updatePos)

watch([() => piniaResize().NAVI_WIDTH, () => piniaResize().TASKPANE_WIDTH], () => {
  updatePos();
});

function updatePos() {
if (piniaResize().windowWidth < 769) {
    rightContainerPos.value = {
      left: "-5px",
      width: "28px",
      bottom:
        (piniaResize().NAVI_WIDTH ? piniaResize().NAVI_WIDTH + 8 : 5) + piniaResize().TASKPANE_WIDTH + "px",
    };
  } else {
    rightContainerPos.value = {
      left: piniaResize().NAVI_WIDTH
        ? piniaResize().NAVI_WIDTH - 2 + "px"
        : "0px",
      width: piniaResize().NAVI_WIDTH ? "25px" : "30px",
      top: (g.TOOLBARTOP_HEIGHT + 4) + "px",
      paddingRight:  piniaResize().NAVI_WIDTH ? '5px' : '0px',
    };
  }
}
</script>

<style module>
.right-container {
  position: absolute;
  box-shadow:
    1px -1px 1px 0px rgba(149, 146, 146, 0.5),
    1px 2px 1px 0px rgba(149, 146, 146, 0.5);
  border: 1px solid #e0e0e0;
  background: #efefef;
  border-radius: 4px;
  border-left: none;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: right 0.05s;
  z-index: 100;
  cursor: pointer;
}

@media screen and (max-width: 768px) {
  .right-container {
    box-shadow: none;
  }
}

.right-container:hover {
  color: green;
  /* background-color: #e0e0e0; */
}
</style>
