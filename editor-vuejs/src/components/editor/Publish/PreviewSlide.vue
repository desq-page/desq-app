<template>
  <NModal
    v-model:show="piniaInfo().openPreviewModal"
    transform-origin="center"
    transition-delay="0"
    :mask-closable="false"
    preset="dialog"
    title=""
    :closable="false"
    :style="{
      cursor: !disabled ? 'auto' : 'wait',
      width: '96dvw',
      height: '96dvh',
      overflow: 'hidden',
      touchAction: 'none',
      padding: '0 10px',
    }"
    :content-style="{
      height: 'calc(100% - 20px)',
    }"
    :show-icon="false"
  >
    <div
      :style="{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }"
    >
      <div class="tools">
        <NFlex
          justify="space-between"
          align="center"
          style="width: 100%"
          :wrap="false"
        >
          <NFlex align="center" :wrap="false">
            <!-- <NFlex v-if="piniaResize().windowWidth > 900">
              <n-radio-group v-model:value="viewType" name="radiogroup">
                <n-radio-button value="desktop" style="padding: 0">
                  <NButton
                    :bordered="false"
                    style="pointer-events: none"
                    size="small"
                  >
                    <template #icon>
                      <n-icon size="20"><Desktop /></n-icon>
                    </template>
                    <span v-if="piniaResize().windowWidth > 900">Original</span>
                  </NButton>
                </n-radio-button>
                <n-radio-button value="mobile" style="padding: 0">
                  <NButton
                    :bordered="false"
                    style="pointer-events: none"
                    size="small"
                  >
                    <template #icon>
                      <n-icon size="20"><MobileAlt /></n-icon>
                    </template>
                    <span v-if="piniaResize().windowWidth > 900">Portrait</span>
                  </NButton>
                </n-radio-button>
              </n-radio-group>
            </NFlex> -->
            <div v-if="piniaResize().windowWidth > 1024">
              <!-- <n-checkbox
                :checked="getFileInfo().publish?.white"
                @update:checked="(checked) => updatePublish('white', checked)"
                style="--n-border: 1px solid #888"
                class="guide-checkbox"
              >
                White viewport background
              </n-checkbox> -->

              <n-checkbox
                :checked="getFileInfo().publish?.webPage"
                @update:checked="
                  (checked) => updatePublish('webPage', checked)
                "
                style="--n-border: 1px solid #888; margin-left: 20px"
                class="guide-checkbox"
              >
                Scrolling Webpage
              </n-checkbox>
              <!-- <NTooltip
                :style="{
                  maxWidth: '400px',
                }"
                placement="right-end"
              >
                <template #trigger><span class="guide">ℹ️</span></template>
                Show as document page and scrollable instead of presentation slide
              </NTooltip> -->
              <label class="max-width-setting">
                Max width
                <NSelect
                  :value="getFileInfo().publish?.maxWidth || '1290px'"
                  :disabled="!getFileInfo().publish?.webPage"
                  :options="maxWidthOptions"
                  size="small"
                  style="width: 110px"
                  @update:value="(value) => updatePublish('maxWidth', value)"
                />
              </label>
              <!-- <n-checkbox
                :checked="getFileInfo().publish?.stretchMobile"
                @update:checked="
                  (checked) => updatePublish('stretchMobile', checked)
                "
                style="--n-border: 1px solid #888; margin-left: 20px"
                v-if="viewType == 'mobile'"
              >
                Use landscape size for mobile
              </n-checkbox> -->
              <!-- <NTooltip
          :style="{
            maxWidth: '400px',
          }"
          placement="right-end"
          v-if="viewType == 'mobile'"
          class="guide-info"
        >
          <template #trigger><span class="guide">ℹ️</span></template>
          Show original landcape aspect ratio on mobile screen
        </NTooltip> -->
              <!-- <n-checkbox
                :checked="getFileInfo().publish?.singleURL"
                @update:checked="
                  (checked) => updatePublish('singleURL', checked)
                "
                style="--n-border: 1px solid #888; margin-left: 20px"
                class="guide-checkbox"
              >
                Use single URL
              </n-checkbox> -->
              <!-- <NTooltip
                :style="{
                  maxWidth: '400px',
                }"
                placement="right-end"
                class="guide-info"
              >
                <template #trigger><span class="guide">ℹ️</span></template>
                Use only one URL for whole file after publishing instead of
                separate URL for each slide.
              </NTooltip> -->
            </div>
          </NFlex>
          <NFlex :wrap="false">
            <NButton @click="openPlayerTab" type="primary" size="small">
              <template #icon>
                <NIcon size="20"><DeviceDesktop /></NIcon>
              </template>
              <span v-if="piniaResize().windowWidth > 900">Preview</span>
            </NButton>
            <!-- <NButton @click="openFullScreen" type="primary" size="small">
              <template #icon>
                <NIcon size="20"><PresentationAnalytics /></NIcon>
              </template>
              <span v-if="piniaResize().windowWidth > 900">Present</span>
            </NButton> -->
            <NButton
              :disabled="disabled"
              type="primary"
              @click="piniaInfo().openPublishModal = true"
              size="small"
            >
              <template #icon>
                <NIcon size="20"><Globe24Regular /></NIcon>
              </template>
              <span v-if="piniaResize().windowWidth > 900">Publish...</span>
            </NButton>
            <NButton
              @click="() => closePreview()"
              quaternary
              size="small"
            >
              <template #icon>
                <NIcon :size="26"><CloseOutlined /></NIcon>
              </template>
            </NButton>
          </NFlex>
        </NFlex>
      </div>
      <div
        ref="viewer"
        style="
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          width: 100%;
          height: calc(100% - 34px);
          margin-top: 20px;
        "
      >
        <MobileFrame
          ref="ifr"
          :url="previewUrl"
          :viewType="viewType"
          v-if="piniaInfo().openPreviewModal"
        />
      </div>
      <div class="naviBottom" v-if="!getFileInfo().publish?.webPage">
        <!-- <div style="width: 150px">&nbsp;</div> -->
        <div>
          <NButton @click="moveBackward" type="primary" size="small">⇦</NButton>
          <span>&nbsp;</span>
          <n-gradient-text :size="18" type="success">
            {{ slideIndex + "/" + getFileInfo().slides.length }}
          </n-gradient-text>
          <span>&nbsp;</span>
          <NButton @click="moveForward" type="primary" size="small">⇨</NButton>
        </div>
        <!-- <NButton
          :disabled="disabled"
          secondary
          type="primary"
          @click="showVariables"
          size="small"
        >
          <template #icon>
            <NIcon size="20"><Bug24Regular /></NIcon>
          </template>
          <span v-if="piniaResize().windowWidth > 900">Show Variables</span>
        </NButton> -->
      </div>
    </div>
  </NModal>
  <PublishSlide />
  <ShowVariables />
</template>
<script setup lang="ts">
import { updateFile, getSlidesCalcSlideIndex, getFileInfo } from "shared-vuejs/editor";

import {
  NModal,
  NButton,
  NIcon,
  NFlex,
  NCheckbox,
  NTooltip,
  NGradientText,
  NSelect,
} from "naive-ui";
import { onMounted, ref, watch } from "vue";
import { piniaInfo, piniaResize } from "@/lib/common/store";

import {
  Bug24Regular,
  Globe24Regular,
} from "@vicons/fluent";

import {
  genPlayerUrl,
  openPlayer,
} from "shared-vuejs/api/play";
// import SessionCheck from "@/components/common/SessionCheck.vue";
import { saveDexie } from "shared-vuejs/api/dbutils";
import { exportFile } from "shared-vuejs/api/html";
import MobileFrame from "./MobileFrame.vue";
import { genId } from "shared-vuejs/api/utility";

import PublishSlide from "./PublishSlide.vue";
import { DeviceDesktop, PresentationAnalytics } from "@vicons/tabler";
import { CloseOutlined } from "@vicons/material";
import ShowVariables from "./ShowVariables.vue";


const disabled = ref(false);
const maxWidthOptions = ['1290px', '1600px', '100%'].map((value) => ({ label: value, value }));

const previewUrl = ref("" as any);

const viewType = ref("desktop");
const slideIndex = ref(-1);

const ifr = ref(null as any);
const viewer = ref();

const layoutType = ref("slide"); // getFileInfo().publish?.scroll ? "scroll" : "slide"

onMounted(() => {
  window.addEventListener("message", (e: MessageEvent) => {
    if (e.source === ifr.value?.ifr?.contentWindow && e.data?.slideIndex) {
      slideIndex.value = e.data?.slideIndex;
      // selectSlide(getFileInfo().slides[slideIndex.value - 1]);
    }
  });
});

watch(
  [() => piniaInfo().openPreviewModal, layoutType, viewType],
  async (oldVal, newVal) => {
    if (piniaInfo().openPreviewModal) {
      if (oldVal[0] !== newVal[0]) {
        slideIndex.value = getSlidesCalcSlideIndex();
      }
      setTimeout(refreshPlayer, 100);
    }
  },
);

function closePreview() {
  viewType.value = "desktop";
  piniaInfo().openPreviewModal = false
}

function refreshPlayer() {
  previewUrl.value = "";
  if (!piniaInfo().openPreviewModal) return;
  if (slideIndex.value <= 0) {
    slideIndex.value = getSlidesCalcSlideIndex();
  }

  setTimeout(() => {
    // wait for the slide HTML export to finish
    previewUrl.value = genPlayerUrl({
      slideIndex: slideIndex.value,
      layoutType: layoutType.value,
      // presentation: viewType.value == "desktop",
      refresh: genId(), // just to clear cache
    });
  }, 1000);
}

async function updatePublish(prop: string, val: boolean | string) {
  updateFile({
    publish: {
      ...getFileInfo().publish,
      [prop]: val,
    },
  });
  // await updateDexie("files", getFileInfo().id, {
  //   publish: getFileInfo().publish,
  // });

  await saveDexie();
  await exportFile();
  if (prop !== "singleURL") {
    setTimeout(() => {
      refreshPlayer();
    }, 100);
  }
}

function openPlayerWindow(scroll, presentation?, production?) {
  openPlayer({
    slideIndex: getSlidesCalcSlideIndex(),
    layoutType: scroll ? "" : "slide",
    // presentation: viewType.value == "desktop",
    production,
  });
  piniaInfo().openPreviewModal = false;
  // disabled.value = false;
}

function moveForward() {
  ifr.value?.postMessage({ cmd: "moveForward" });
}

function moveBackward() {
  ifr.value?.postMessage({ cmd: "moveBackward" });
}

function openPlayerTab() {
  piniaInfo().loadingBar = "";
  openPlayerWindow(getFileInfo().publish?.scroll, undefined, false);
  setTimeout(closePreview, 1);
}

function openFullScreen() {
  viewer.value.requestFullscreen();
}

function showVariables() {
  const vars = ifr.value?.ifr?.contentWindow.getVars();
  piniaInfo().openShowVarsModal = vars;
}
</script>

<style scoped>
.guide {
  cursor: default;
}

.max-width-setting {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-left: 16px;
  font-size: 12px;
  vertical-align: middle;
}

.publishInfo {
  padding: 10px;
  max-width: 50vw;
  background-color: antiquewhite;
}

.setting-title {
  font-weight: bold;
  margin-top: 20px;
}

.naviBottom {
  display: flex;
  width: 100%;
  justify-content: center;
  align-items: center;
  gap: 10px;
}

</style>
<style>
.guide-checkbox .n-checkbox__label {
  padding: 0 4px;
}
</style>
