<template>
  <div class="statusBar" :style="statusbarPos">
    <div
      class="statusMessage"
      v-if="piniaInfo().statusMessage"
      :class="{
        statusRed: piniaInfo().statusMessage.type == 'error',
        statusGreen: piniaInfo().statusMessage.type !== 'error',
      }"
    >
      <span>&nbsp;</span>
      {{ piniaInfo().statusMessage.text }}
      <!-- <NButton type="primary" class="statusDone" @click="done">OK</NButton> -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { getFileInfo } from "shared-vuejs/editor";

import { piniaInfo, piniaResize, piniaSlides } from "@/lib/common/store";

import { computed } from "vue";
// import { watchEffect } from "vue";

const statusbarPos = computed(() => {
  if (piniaResize().windowWidth < 769 && getFileInfo()?.id) {
    return {
      bottom:
        piniaResize().INSERTPANE_WIDTH +
        piniaResize().TASKPANE_WIDTH +
        piniaResize().NAVI_WIDTH +
        "px",
      width: `100vw`,
    };
  } else {
    return {
      left: getFileInfo()?.id
        ? piniaResize().INSERTPANE_WIDTH + piniaResize().NAVI_WIDTH + "px"
        : 0,
      width: getFileInfo()?.id
        ? `calc(100vw - ${piniaResize().INSERTPANE_WIDTH}px - ${piniaResize().NAVI_WIDTH + 1}px - ${piniaResize().TASKPANE_WIDTH + 1}px)`
        : "100vw",
    };
  }
});

// let timeout;

// watchEffect(() => {
//   const time = piniaInfo().statusMessage?.time || 10000;
//   if (timeout) clearTimeout(timeout);
//   timeout = setTimeout(function () {
//     piniaInfo().statusMessage = null;
//   }, time);
// });

// function done() {
//   piniaInfo().statusMessage = null;
// }
</script>

<style scoped>
.statusBar {
  /* width: 100vw; */
  /* height: 30px; */
  z-index: 99;
  position: absolute;
  bottom: 0px;
  pointer-events: none;
}

.statusMessage {
  background: rgba(68, 255, 0, 0.3);
  color: black;
  font-size: 14px;
  text-align: left;

  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 0 10px;
}

.statusDone {
  float: right;
  margin-right: 10px;
  cursor: pointer;
}
.statusGreen {
  /*background-color: white;*/
  /* background-color: #b9d6f6; */
}

.statusRed {
  background-color: rgb(243, 228, 228);
  color: red;
}
</style>
