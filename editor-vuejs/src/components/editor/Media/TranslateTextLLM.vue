<template>
  <div style="padding: 10px">
    Translate selected text to:
    <select v-model="language">
      <option>English</option>
      <option>French</option>
      <option>Spanish</option>
      <option>German</option>
      <option>Chinese</option>
      <option>Japanese</option>
      <option>Korean</option>
      <option>Vietnamese</option>
      <option>Arabic</option>
    </select>

    <NFlex>
      <NButton
        type="primary"
        @click="translateLLM"
        :disabled="isSearching || !keyword"
        :style="{
          cursor: isSearching ? 'wait' : 'auto',
        }"
        >Translate</NButton
      >
    </NFlex>
  </div>

  <NSpin size="large" v-if="isSearching" class="nSpinOn" />
</template>
<script setup lang="ts">
import { NFlex, NButton, NSpin } from "naive-ui";
import { ref, watch } from "vue";

import { piniaSelect } from "@/lib/common/store";
import { createOllama } from "shared-vuejs/api/gen";
import { toggleTaskPane } from "@/lib/main/utils";

const keyword = ref("");
const isSearching = ref(false);
const language = ref("English");

getSelectedTopic();

watch(
  () => piniaSelect().selShpFormat,
  () => {
    if (!piniaSelect().selShpFormat?.t) {
      toggleTaskPane("shape");
    }
  },
);

function getSelectedTopic() {
  const shp = piniaSelect().selShpFormat;
  if (shp?.t?.keyword) {
    const title = shp.t.keyword;
    keyword.value = title; //`generate this image: ${title}, aspect ratio: width ${shp.w}, height ${shp.h}`;
  }
}

function updateProgress(output) {
  console.log(output);
}

async function translateLLM() {
  const textbox: any = document.querySelector(
    "#" + piniaSelect().selShpFormat?.id + " .textbox",
  );
  const text = textbox?.innerText;
  if (text) {
    isSearching.value = true;
    await createOllama(
      text,
      "translate",
      { language: language.value },
      null,
      updateProgress,
    );
    isSearching.value = false;
  }
}
</script>
<style scoped>
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
