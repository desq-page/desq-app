<template>
  <div style="padding: 40px 20px">
    <textarea
      :disabled="isSearching"
      class="prompt"
      v-model="keyword"
      :placeholder="placeholder"
      @keydown.stop
      :style="{
        cursor: isSearching ? 'wait' : 'auto',
        height: '200px',
      }"
      @input="
        () => {
          isSearching = false;
        }
      "
      @focus="(e) => (e.target as any)?.select()"
    ></textarea>

    <NFlex>
      <NButton
        type="primary"
        @click="generateLLM"
        :disabled="isSearching || !keyword"
        :style="{
          cursor: isSearching ? 'wait' : 'auto',
        }"
        v-if="piniaInfo().currentTaskPane == 'regenerateText'"
        >Regenerate</NButton
      >
      <NButton
        type="primary"
        @click="summarizeLLM"
        :disabled="isSearching || !keyword"
        :style="{
          cursor: isSearching ? 'wait' : 'auto',
        }"
        v-if="piniaInfo().currentTaskPane == 'summarizeText'"
        >Summarize</NButton
      >
    </NFlex>
  </div>

  <NSpin size="large" v-if="isSearching" class="nSpinOn" />
</template>
<script setup lang="ts">
import { NButton, NSpin, NFlex } from "naive-ui";
import { ref, watch } from "vue";

import { piniaInfo, piniaSelect } from "@/lib/common/store";
import { createOllama } from "shared-vuejs/api/gen";
// import {
//   piniaInfo,
//   piniaHandling,
//   piniaResize,
//   slideScale,
// } from "@/lib/common/store";
// import { globalToLocal } from "shared-vuejs/api/hitTest";
// import { getScrollXY } from "shared-vuejs/api/utility";
// import { animateAddShape } from "../AutoShapes/drawSpecialshapes";
// import g from "shared-vuejs/api/global";

const keyword = ref("");
const resultGroup: any = ref([]);
const isSearching = ref(false);
const searchResultBox = ref();
const placeholder = ref(`Enter an image description to generate`);

getSelectedTopic();

watch(
  () => piniaSelect().selShpFormat,
  () => {
    getSelectedTopic();
  },
);

function getSelectedTopic() {
  const shp = piniaSelect().selShpFormat;
  if (piniaInfo().currentTaskPane == "regenerateText") {
    if (shp?.t?.keyword) {
      keyword.value = shp.t.keyword; //`generate this image: ${title}, aspect ratio: width ${shp.w}, height ${shp.h}`;
    }
  } else {
    const textbox: any = document.querySelector(
      "#" + piniaSelect().selShpFormat?.id + " .textbox",
    );
    keyword.value = textbox?.innerText;
  }
}

function updateProgress(output) {
  console.log(output);
}

async function generateLLM() {
  if (keyword.value) {
    isSearching.value = true;
    await createOllama(keyword.value, "text", {}, null, updateProgress);
    isSearching.value = false;
  }
}

async function summarizeLLM() {
  if (keyword.value) {
    isSearching.value = true;
    await createOllama(keyword.value, "summarize", {}, null, updateProgress);
    isSearching.value = false;
  }
}
</script>
<style scoped>
.warning {
  background-color: orange;
  padding: 10px;
  border: 1px solid red;
  margin: 5px;
}
.searchResult {
  height: calc(100% - 120px);
  overflow: auto;
}

.img-row {
  display: flex;
  justify-content: space-around;
  margin-bottom: 4px;
}

.nSpinOn {
  position: absolute;
  left: calc(50% - 30px);
  top: calc(50% - 30px);
  z-index: 10;
}

.prompt {
  width: 100%;
  height: 80px;
}
</style>
