<template>
  <div
    :class="{
      mobile: viewType == 'mobile',
      desktop: viewType == 'desktop',
    }"
  >
    <div class="content">
      <iframe :src="url" frameborder="0" allowfullscreen ref="ifr" :key="url" />
    </div>
  </div>
</template>
<script setup lange="ts">
import { ref } from "vue";
defineProps({
  url: String,
  viewType: {
    type: String,
    default: "mobile",
  },
});

const ifr = ref(null);

function postMessage(msg) {
  ifr.value.contentWindow.postMessage(msg, "*");
}

defineExpose({
  postMessage,
  ifr,
});
</script>
<style scoped>
/* The device with borders */
.desktop {
  position: relative;
  width: 100%;
  height: 100%;
  margin: auto;
  border: 1px black solid;
  /* border-radius: 4px; */
  overflow: hidden;
}

iframe {
  touch-action: none;
}

.mobile {
  position: relative;
  width: 40dvh;
  height: 100%;
  margin: auto;
  /* border: 2px #ccc solid; */
  /* border-radius: 4px; */
  overflow: hidden;
}

.content {
  width: 100%;
  height: 100%;
  background: black;
}
iframe {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
</style>
