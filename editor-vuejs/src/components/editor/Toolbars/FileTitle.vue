<script setup lang="ts">
import { getFileInfo } from "shared-vuejs/editor";

import { piniaResize, piniaSlides } from "@/lib/common/store";
import { toggleTaskPane } from "@/lib/main/utils";

</script>

<template>
  <div
    class="top-title-cover"
    :style="{
      cursor: 'pointer',
      marginTop: '2px',
    }"
    @click="toggleTaskPane('settings')"
    v-if="piniaResize().windowWidth >= 769"
  >
    <span class="top-title">
      {{ getFileInfo().title }}
    </span>
  </div>
</template>
<style scoped>
.top-title {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  user-select: none;
  -webkit-user-select: none;
  font-size: 16px;
  /* background: #f3f3f3; */
  padding: 3px 10px;
  /* border: none; */
  /* border-radius: 3px; */
  text-decoration: underline;
  color: var(--n-primary-color);
  font-weight: bold;
  /* border-bottom: 1px solid blue; */
}

.top-title-cover {
  display: flex;
}
</style>
