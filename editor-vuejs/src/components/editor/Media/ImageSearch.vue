<template>
  <div>
    <div>
      <textarea
        :disabled="isSearching"
        class="prompt"
        v-model="keyword"
        placeholder="Enter keyword or prompt"
        @keydown.stop
        :style="{
          cursor: isSearching ? 'wait' : 'auto',
        }"
        @input="refreshKeyword()"
        @focus="(e) => (e.target as any)?.select()"
        @keyup.enter="(e) => searchImages((e.target as any)?.value)"
        @contextmenu.stop
      ></textarea>
    </div>

    <div class="warning" v-if="showWarning">
      To generate new images, a free Segmind API key required. Sign up at
      <a href="https://segmind.com" target="_new">Segmind.com</a> and goto
      console to create API key, then enter it here: <br /><input
        @blur="saveKey"
        @keyup.enter="saveKey"
      />
    </div>

    <NSpin size="large" v-if="isSearching" class="nSpinOn" />

    <div
      class="searchResult"
      v-if="resultGroup.length > 0"
      ref="searchResultBox"
    >
      <!-- <div style="margin: 15px">
        Drag over shape to replace

        <NSwitch
          :value="piniaInfo().allowDragToReplace"
          :on-update:value="
            () =>
              (piniaInfo().allowDragToReplace = !piniaInfo().allowDragToReplace)
          "
          style="margin-left: 20px"
        />
      </div> -->
      <img class="generatedImage" v-if="generatedImage" :src="generatedImage" />
      <div
        v-for="(grp, grpIdx) in resultGroup"
        :key="grpIdx"
        class="img-row"
        :style="{
          width: '336px',
          height: grp.height + 'px',
        }"
      >
        <div
          :data-id="img?.id"
          :data-img="img?.src || img?.compressedUrl || img?.url"
          :title="img?.prompt || img?.title"
          v-for="img in grp"
          :key="img?.id"
          :style="{
            height: img?.height * grp.ratio + 'px',
            width: img?.width * grp.ratio + 'px',
            cursor: 'pointer',
          }"
          @click="
            (evt) => {
              // clickFunc(evt, img);
            }
          "
          draggable="true"
          @dragstart="
            (e) =>
              dragShapeOnStart(
                e,
                {
                  ...img,
                  title: keyword,
                },
                'img',
              )
          "
          @drag.self="(e) => dragShapeOnDrag(e)"
          @dragend="(e) => dragShapeOnEnd(e, img)"
        >
          <img
            crossorigin="anonymous"
            :src="img?.srcSmall || img?.bigThumbnailUrl || img?.thumbnail"
            :style="{
              height: img?.height * grp.ratio + 'px',
              width: img?.width * grp.ratio + 'px',
              pointerEvents: 'none',
            }"
          />
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { NSpin, NSwitch } from "naive-ui";
import { nextTick, ref, watch } from "vue";
import {
  dragShapeOnStart,
  dragShapeOnDrag,
  dragShapeOnEnd,
} from "shared-vuejs/api/dragAutoshapes";
import { piniaInfo, piniaSelect } from "@/lib/common/store";
import { round } from "shared-vuejs/api/utility";
import { createImage } from "shared-vuejs/api/gen";
import { searchImageUI } from "shared-vuejs/api/searchImages";

const keyword = ref("");
const resultGroup: any = ref([]);
const isSearching = ref(false);
const searchResultBox = ref();

const generatedImage = ref("");
const showWarning = ref(false);

getSelectedTopic();

watch(
  () => piniaSelect().selShpFormat,
  () => {
    getSelectedTopic();
  },
);

function isSearchDisabled() {
  return !!(isSearching.value || keyword.value?.trim()?.length < 3);
}
function getSelectedTopic() {
  keyword.value = sessionStorage.getItem("mediaSearch") || "";
}

async function generateSD() {
  if (keyword.value.trim().length < 3) return;
  const SegmindKey = localStorage.getItem("SegmindKey");
  if (!SegmindKey) {
    showWarning.value = true;
    return;
  }
  if (keyword.value) {
    isSearching.value = true;
    const shp = piniaSelect().selShpFormat;

    let w = 512,
      h = 512;

    if (shp) {
      if (shp.w > shp.h) {
        h = round(shp.h / (shp.w / 512));
      } else {
        w = round(shp.h / (shp.w / 512));
      }
    }

    await createImage(keyword.value, w, h);
    isSearching.value = false;
    showWarning.value = false;
  }
}

function createImageBing() {
  const url = `https://www.bing.com/images/create?FORM=GENILP`;

  window.open(url, "bing");
}

// function openGoogle() {
//   // if (keyword.value.trim().length < 3) return;
//   // const url = `https://www.google.com/search?site=imghp&tbm=isch&q=${keyword.value || "image"}&tbs=sur:cl&sa=X`;
//   const url = `https://www.google.com/search?site=imghp&tbm=isch&q=${keyword.value || "image"}`;
//   if (windowSearch && windowSearch.window) {
//     windowSearch.focus();
//   } else {
//     windowSearch = window.open(
//       url,
//       "google",
//       "noopener,noreferrer",
//       // `left=0,top=120,width=${screen.width / 2},height=${screen.height}`
//     );
//   }
// }

// function openLexica() {
//   // if (keyword.value.trim().length < 3) return;
//   // const url = `https://creator.nightcafe.studio/search/creations?q=${keyword.value}`;
//   // const url = `https://lexica.art/?q=${keyword.value}`;
//   const url = "https://civitai.com/search/images";
//   if (g.windowSearchAI && g.windowSearchAI.window) {
//     g.windowSearchAI.focus();
//   } else {
//     g.windowSearchAI = window.open(
//       url,
//       "lexica",
//       // `left=0,top=120,width=${screen.width / 2},height=${screen.height}`,
//     );
//   }
// }

function refreshKeyword() {
  isSearching.value = false;
  sessionStorage.setItem("mediaSearch", keyword.value);
  // windowLexica = null;
  // windowSearch = null;
}

async function searchImages(prompt) {
  if (!prompt) {
    prompt = keyword.value;
  }
  if (!prompt) return;
  isSearching.value = true;

  const result = await searchImageUI(prompt);

  isSearching.value = false;

  if (!result) return;

  const _resultGrp: any = [];
  let curPos = 0;
  let curGrp: any = [];
  for (let imgIdx = 0; imgIdx < result.images.length; imgIdx++) {
    const img = result.images[imgIdx];
    if (img.prompt) {
      const filter = /.*(woman|female|girl|pretty|booty|body).*/gi;
      const filterResult = img.prompt.match(filter);
      if (filterResult?.length > 0) {
        continue;
      }
    }
    curGrp.push(img);
    if (img.width < img.height) {
      curPos += 1;
    } else if (img.width == img.height) {
      curPos += 1.5;
    } else if (img.width > img.height) {
      curPos += 2;
    } else {
      curPos++;
    }
    if (curPos >= 4) {
      if (curGrp && curGrp.length > 0) {
        // calculate group width + height
        let totalW = 0;
        const maxHeight = curGrp.reduce((mH, grpImg) => {
          if (grpImg.height > mH) {
            mH = grpImg.height;
          }
          return mH;
        }, 0);

        curGrp.forEach((grpImg) => {
          grpImg.width = grpImg.width * (maxHeight / grpImg.height);
          grpImg.height = maxHeight;
          totalW += grpImg.width;
        });

        curGrp.width = 320;
        curGrp.ratio = 320 / totalW;
        curGrp.height = maxHeight * curGrp.ratio;
        _resultGrp.push(curGrp);
      }
      curPos = 0;
      curGrp = [];
    }
  }
  resultGroup.value = _resultGrp;
  isSearching.value = false;
  nextTick(() => {
    searchResultBox.value.scrollTop = 0;
  });
}

function saveKey(e) {
  const key = e.target.value;
  if (key) {
    localStorage.setItem("SegmindKey", key);
    generateSD();
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

.guide {
  padding: 5px;
  min-width: 100px;
  /* background: white; */
  border-radius: 4px;
  font-size: 12px;
  margin: 10px 0 10px 0;
}

.media-button {
  width: 120px;
}
</style>
