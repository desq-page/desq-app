<script setup lang="ts">
import g from "shared-vuejs/api/global";
import ZoomToolbar from "./ZoomToolbar.vue";
import StatusBar from "./StatusBar.vue";
// import { piniaResize } from "@/lib/common/store.js";
import NaviToolbar from "../NaviBar/NaviToolbar.vue";
</script>

<template>
  <div class="toolbar-bottom">
    <div class="left">
      <NaviToolbar />
      <StatusBar />
    </div>
    <div class="right">
      <ZoomToolbar />
    </div>
  </div>
</template>
<style scoped>
.toolbar-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: v-bind("`${g.STATUSBAR_HEIGHT}px`");
  padding: 0 + px;
  z-index: 200;
  border-radius: 4px;
  background: rgba(240, 240, 240, 0.5);
  box-shadow: 1px -2px 1px 0px rgba(149, 146, 146, 0.5), 1px 2px 1px 0px rgba(149, 146, 146, 0.5);
}

.right {
  display: flex;
  align-items: center;
}
</style>
