<template>
  <div
    :class="[
      $style.menuHideBtn,
      piniaResize().windowWidth < 769 && $style.menuDown,
    ]"
    v-if="piniaInfo().currentTaskPane"
    @click="hideTaskPane()"
  >
    <NIcon
      :size="24"
      :style="{
        // top: piniaResize().windowWidth < 769 ? 0 : '5px',
      }"
      ><CloseFilled
    /></NIcon>
    <!-- <ToolbarItem
      quaternary
      :icon="
        piniaResize().windowWidth < 769
          ? ChevronDoubleDown20Filled
          : ChevronDoubleLeft20Filled
      "
      :on-click="() => hideTaskPane()"
    /> -->
  </div>
</template>

<script setup lang="ts">
import {  } from "shared-vuejs/editor";

import { piniaInfo, piniaResize } from "@/lib/common/store";

import { useCssModule } from "vue";
import { NIcon } from "naive-ui";
import { CloseFilled } from "@vicons/material";


const $style = useCssModule();

function hideTaskPane() {
  piniaInfo().setCurTaskPane("");
}

</script>

<style module>
.menuHideBtn {
  position: absolute;
  right: 4px;
  top: 6px; /*calc(50% - 24px);*/
  z-index: 10;
  background-color: white;
  border: 1px solid #ccc;
  width: 25px;
  height: 25px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  cursor: pointer;
  /* box-shadow:
    -1px -1px 1px 0px rgba(149, 146, 146, 0.5),
    1px 1px 1px 0px rgba(149, 146, 146, 0.5);*/
}

@media screen and (max-width: 768px) {
  .menuHideBtn {
    box-shadow: none;
  }
}

.menuHideBtn:hover {
  color: green;
  background-color: #e0e0e0;
}

.menuDown {
  top: 0;
  right: 0;
  width: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  background: transparent;
  border: none;
  color: black;
}
</style>
