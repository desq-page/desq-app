<template>
  <LayoutHeader
    :label="title || 'Local Media'"
    arrow
    :clearBackground="false"
    @click="openMediaTab"
    arrowLabel="Manage..."
    v-if="preview"
  >
  </LayoutHeader>
  <NFlex
    :style="{
      marginTop: '10px',
      marginBottom:  '10px',
    }"
  >
    <FileUpload
      buttonType="primary"
      ghost
      label="Upload..."
      :icon="SdStorageOutlined"
    />

    <ToolbarItem
      buttonType="primary"
      ghost
      bordered
      @click="piniaInfo().openMediaOnline = true"
      class="media-button"
      label="Online..."
    />
    <ToolbarItem
      buttonType="primary"
      ghost
      bordered
      @click="processPasteReplace()"
      class="media-button"
      label="📋 Clipboard"
    />
    <ToolbarItemDropdown
      buttonType="primary"
      ghost
      :options="deleteOptions"
      :icon="TrashX"
      :size="20"
      label="Clean up..."
      v-if="!preview && resultGroup.length > 0"
    />
  </NFlex>

  <div v-if="!clickFunc && resultGroup.length > 0" class="taskpane-guide">Drag to slide to insert</div>

  <div v-show="( !hideSamples || piniaInfo().currentTaskPane == 'localmediatab') && resultGroup.length > 0">
    <NSpin size="large" v-if="isSearching" class="nSpinOn" />
    <div class="searchResult" ref="searchResultBox">
      <div v-for="(grp, grpIdx) in resultGroup" :key="grpIdx" class="img-row">
        <div
          :data-id="img?.id"
          :data-img="img?.src"
          :title="img?.title"
          v-for="img in grp"
          :key="img?.id"
          class="img-item"
          :style="{
            height: img?.height * grp.ratio + 'px',
            width: img?.width * grp.ratio + 'px',
            opacity: img?.hidden ? 0 : 1,
            pointerEvents: img?.hidden ? 'none' : 'all',
          }"
          @click="
            (evt) => {
              clickFunc?.(evt, img);
            }
          "
          :draggable="!clickFunc"
          @dragstart="
            (e) =>
              dragShapeOnStart(
                e,
                {
                  ...img,
                  title: img?.title,
                },
                'img',
              )
          "
          @drag.self="(e) => dragShapeOnDrag(e)"
          @dragend="(e) => dragShapeOnEnd(e, img)"
        >
          <img
            crossorigin="anonymous"
            :src="img?.src"
            :width="img?.width"
            :height="img.height"
            :style="{
              height: img?.height * grp.ratio + 'px',
              width: img?.width * grp.ratio + 'px',
            }"
            v-if="
              !['.mp3', '.mp4', '.m4a', '.m4v'].some((ext) =>
                img?.src?.endsWith(ext),
              )
            "
          />
          <audio
            controls
            :src="img?.src"
            v-if="['.mp3', '.m4a'].some((ext) => img?.src?.endsWith(ext))"
            :style="{
              height: img?.height * grp.ratio + 'px',
              width: img?.width * grp.ratio + 'px',
            }"
          />
          <video
            controls
            :src="img?.src"
            v-if="['.mp4', '.m4v'].some((ext) => img?.src?.endsWith(ext))"
            :style="{
              height: img?.height * grp.ratio + 'px',
              width: img?.width * grp.ratio + 'px',
            }"
          />
        </div>
      </div>
    </div>
  </div>

  
</template>
<script setup lang="ts">
import { getShapeDeep, getSelectSelShpFormat, getFileInfo, setPendingCurrentTaskPaneProps } from "shared-vuejs/editor";

import { NFlex, NSpin } from "naive-ui";
import { nextTick, onMounted, ref, watch } from "vue";
import {
  dragShapeOnStart,
  dragShapeOnDrag,
  dragShapeOnEnd,
} from "shared-vuejs/api/dragAutoshapes";
import { piniaInfo, piniaSelect, piniaSlides } from "@/lib/common/store";
import { whereEqualDexie } from "shared-vuejs/api/db";
import { getBaseHref } from "shared-vuejs/api/get-file";
import { showError, showMessage } from "shared-vuejs/api/utils";
import { toggleTaskPane } from "@/lib/main/utils.js";
import LayoutHeader from "@/components/common/Layouts/LayoutHeader.vue";
import { SdStorageOutlined } from "@vicons/material";
import { Globe24Regular, Warning24Regular } from "@vicons/fluent";
import { TrashX } from "@vicons/tabler";
import FileUpload from "./FileUpload.vue";
import ToolbarItemDropdown from "../Toolbars/ToolbarItemDropdown.vue";
import ToolbarItem from "../Toolbars/ToolbarItem.vue";

import { getClipboardContents, pasteShape } from "shared-vuejs/api/clipboard.js";
import { getAllMediaPics } from "shared-vuejs/api/dbutils.js";

const props = defineProps({
  preview: Boolean,
  title: String,
  clickFunc: Function,
  hideSamples: Boolean,
  clipboardFunc: Function,
});

const resultGroup: any = ref([]);
const isSearching = ref(false);
const searchResultBox = ref();
const reloading = ref(false);

onMounted(searchImages);

watch(
  () => piniaSelect().selShpFormat,
  () => {
    if (piniaSelect().selShpFormat?.blipFill) {
      const previewImg = searchResultBox.value.querySelector(
        `[data-id='${piniaSelect().selShpFormat?.blipFill.blip.$_target}']`,
      );
      if (!previewImg) {
        searchImages();
      }
    }
  },
);

function openMediaTab() {
  piniaInfo().setLastTaskPane(piniaInfo().currentTaskPane);
  setPendingCurrentTaskPaneProps({
    clickFunc: props.clickFunc,
  })
  toggleTaskPane("localmediatab");
}

async function searchImages() {
  let mediaColl = await getAllMediaPics(getFileInfo()?.id);

  if (props.preview) {
    mediaColl = mediaColl?.slice(0, 3);
  }
  const media = mediaColl; //await mediaColl.toArray();

  const result = {
    images: media.map((m) => ({
      id: m.name,
      src: getBaseHref(getFileInfo().id) + "media/" + m.name,
      title: m.name,
      width: m.name.includes(".mp3") ? 40 : m.w || 100,
      height: m.name.includes(".mp3") ? 40 : m.h || 100,
    })),
  };

  if (!result) return;

  const _resultGrp: any = [];
  let curPos = 0;
  let curGrp: any = [];
  for (let imgIdx = 0; imgIdx < result.images.length; imgIdx++) {
    const img = result.images[imgIdx];
    curGrp.push(img);
    if (img.width < img.height) {
      curPos += 1;
    } else if (img.width == img.height) {
      curPos += 1.5;
    } else if (img.width > img.height) {
      curPos += 1.9;
    } else {
      curPos++;
    }
    if (curPos >= 4 || imgIdx == result.images.length - 1) {
      if (curGrp && curGrp.length > 0) {
        if (curGrp.length == 1) {
          // push a fake hidden image to fill
          curGrp.push({
            width: 1280,
            height: 720,
            hidden: true,
          });
        }

        if (curGrp.length == 2) {
          // push a fake hidden image to fill
          curGrp.push({
            width: 1280,
            height: 720,
            hidden: true,
          });
        }
        // calculate group width + height
        let totalW = 0;
        const maxHeight = curGrp.reduce((mH, grpImg) => {
          if (grpImg.height > mH) {
            mH = grpImg.height;
          }
          return mH;
        }, 0);

        const maxW = 290;

        curGrp.forEach((grpImg) => {
          grpImg.width = grpImg.width * (maxHeight / grpImg.height);
          grpImg.height = maxHeight;
          totalW += grpImg.width;
        });

        curGrp.width = maxW;
        curGrp.ratio = maxW / totalW;
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
    if (searchResultBox.value) {
      searchResultBox.value.scrollTop = 0;
    }
  });
}

async function processPasteReplace() {
  const { clpImage } = await getClipboardContents();
  if (clpImage) {
    if (props.clipboardFunc) {
      await props.clipboardFunc(clpImage);
    } else {
      const shp = getShapeDeep(getSelectSelShpFormat()?.id);
      pasteShape(null, shp);
    }
  } else {
    showMessage("No picture in clipboard", 3000)
  }
}

const deleteOptions = [
  {
    label: "Delete unused media?",
    onClick: async () => {
      reloading.value = true;
      const { deleteUnusedMedia } = await import("shared-vuejs/api/unzipPPTX");
      await deleteUnusedMedia(getFileInfo().id);
      showMessage("Unused media are cleaned up.", 1000);
      reloading.value = false;
      searchImages();
    },
    icon: Warning24Regular,
    color: "red",
  },
];
</script>
<style scoped>
.searchResult {
  width: 100%;
}
.warning {
  background-color: orange;
  padding: 10px;
  border: 1px solid red;
  margin: 5px;
}

.img-row {
  display: flex;
  margin-bottom: 4px;
  justify-content: space-between;
}

.img-item {
  background-color: #ececec;
  border-radius: 2px;
  cursor: pointer;
  max-height: 100px;
  min-width: 50px;
}

.img-item img {
  max-height: 100px;
  pointer-events: none;
  object-fit: contain;
  min-width: 50px;
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

/* audio::-webkit-media-controls-volume-slider {
  display: none !important;
}

audio::-webkit-media-controls-timeline-container {
  display: none !important;
}

audio::-webkit-media-controls-time-remaining-display {
  display: none !important;
}

audio::-webkit-media-controls-timeline {
  display: none !important;
} */
</style>
