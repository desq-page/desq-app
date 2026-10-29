<template>
  <NModal
    v-model:show="piniaInfo().openMediaOnline"
    transform-origin="center"
    transition-delay="0"
    :mask-closable="false"
    preset="dialog"
    title="Preview"
    :closable="true"
    :style="{
      // cursor: 'auto',
      // left: '30px',
      // width: 'calc(100vw - 60px)',
      // maxWidth: '100vw',
      // height: 'calc(100vh - 60px)',
      // overflow: 'hidden',
      // padding: 0,
      // margin: 0,
    }"
  >
    <template #header>
      <div>Online Media</div>
    </template>
     <div class="taskpane-guide">Search and copy image. Then click CLIPBOARD to paste on slide.</div>
    <NFlex vertical justify="space-around" align="start" :size="10">
      <MediaOnlineLink title="Unsplash..." url="https://unsplash.com" />
      <MediaOnlineLink title="Openverse..." url="https://openverse.org" />
      <MediaOnlineLink title="Open Clipart..." url="https://openclipart.org" />
      <MediaOnlineLink title="Clip Safari..." url="https://clipsafari.com" />
      <MediaOnlineLink title="SVG Repo..." url="https://www.svgrepo.com" />
    </NFlex>
  </NModal>
</template>
<script setup lang="ts">
import { NFlex, NModal } from "naive-ui";
import { piniaInfo } from "@/lib/common/store";
import MediaOnlineLink from "./MediaOnlineLink.vue";
</script>

<style scoped>

</style>
