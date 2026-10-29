<template>
  <DialogBase
    title="Insert Media"
    :icon="Image24Regular"
  >
    <LocalMedia title="Local Pictures" />
    <!-- <LayoutHeader label="Online Pictures" />

    <div class="taskpane-guide">{{ guide }}</div>

    <NFlex vertical justify="space-around" align="start" :size="10">
      <MediaOnlineLink title="Unsplash..." url="https://unsplash.com" />
      <MediaOnlineLink title="Openverse..." url="https://openverse.org" />
      <MediaOnlineLink title="Open Clipart..." url="https://openclipart.org" />
      <MediaOnlineLink title="Clip Safari..." url="https://clipsafari.com" />
      <MediaOnlineLink title="SVG Repo..." url="https://www.svgrepo.com" />
    </NFlex> -->


    <!-- <LayoutHeader label="Video Clips" />
    <NFlex>
      <NButton
        type="primary"
        ghost
        @click="openExternalSearch('https://www.videezy.com/', 'unsplash')"
        class="media-button"
      >
        Videezy...
      </NButton>
    </NFlex>
    <div class="taskpane-guide">Search, download clips then upload</div> -->
    <!-- <ImageSearch /> -->
  </DialogBase>
</template>
<script setup lang="ts">

import DialogBase from "@/components/common/Layouts/DialogBase.vue";
import LocalMedia from "./LocalMedia.vue";
import { addShapeRaw } from "shared-vuejs/api/draw";
import { genId } from "shared-vuejs/api/utility";
import { Image24Regular } from "@vicons/fluent";

function insertYoutubeVideo() {
  addShapeRaw({
    id: genId(),
    type: "video",
    x: 200,
    y: 100,
    w: 400,
    h: 300,
    i: {
      video: "https://www.youtube.com/embed/uHKfrz65KSU",
      iX: 0,
      iY: 0,
      iH: 100,
      iW: 100,
    },
  });
}

// const guide = "Search and copy image to clipboard";
</script>
<style scoped>
.warning {
  background-color: orange;
  padding: 10px;
  border: 1px solid red;
  margin: 5px;
}

.img-row {
  display: flex;
  justify-content: space-around;
  margin-bottom: 4px;
}

.nSpinOn {
  position: absolute;
  left: calc(50% - 25px);
  top: calc(50% - 25px);
  z-index: 10;
}

.prompt {
  width: calc(100% - 10px);
  height: 30px;
}

.generatedImage {
  width: 300px;
}

/* .guide {
  padding: 5px;
  min-width: 100px;
  border-radius: 4px;
  font-size: 12px;
  margin: 10px 0 10px 0;
} */

.media-button {
  /* width: 120px; */
}
</style>
