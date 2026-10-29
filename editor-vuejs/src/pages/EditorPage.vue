<template>
  <div :class="$style.designermain" @dragover.self.prevent>
    <ToolbarTop />
    <StatusBar />
    <div
      ref="loadingBarTargetRef"
      :class="$style.dcontainer"
      :style="{
        top: g.TOOLBARTOP_HEIGHT + 'px',
        height:
          'calc(100% - ' + (g.TOOLBARTOP_HEIGHT + g.STATUSBAR_HEIGHT) + 'px)',
      }"
    >
      
      <CenterPane></CenterPane>
      <NaviBar></NaviBar>
      <TaskPane></TaskPane>
    </div>
    <ShowHideSlides />
    <ToolbarBottom />
  </div>
  <GenerateLLM />
  <PreviewSlide />
  <DataEditor />
  <ChangeLayout v-if="piniaSlides().changeLayout" />
  <PhotopeaIframe />
  <MediaOnline />
  <LoadingModule />
  <FormulaReference />
  <NewFile />
</template>

<script setup lang="ts">
import { updateShapes, getFileInfo } from "shared-vuejs/editor";

import ToolbarTop from "@/components/editor/Toolbars/ToolbarTop.vue";
// import ToolbarContent from "@/components/editor/Toolbars/ToolbarContent.vue";
import ToolbarBottom from "@/components/editor/Toolbars/ToolbarBottom.vue";
import ShowHideSlides from "@/components/editor/NaviBar/ShowHideSlides.vue";
import NaviBar from "@/components/editor/NaviBar/NaviBar.vue";
import CenterPane from "@/components/editor/CenterPane.vue";
import TaskPane from "@/components/editor/Insertion/TaskPane.vue";
import LoadingModule from "@/pages/LoadingModule.vue";
import "shared-vuejs/api/listeners";
import { ref, useCssModule, onMounted, onBeforeMount } from "vue";

import { piniaInfo, piniaSlides, piniaShapes } from "@/lib/common/store";
import StatusBar from "@/components/editor/Toolbars/StatusBar.vue";
import g from "shared-vuejs/api/global";
import { genId, gid } from "shared-vuejs/api/utility";
import { loadFile } from "shared-vuejs/api/load";
import PreviewSlide from "@/components/editor/Publish/PreviewSlide.vue";
import PhotopeaIframe from "@/components/editor/Dialogs/PhotopeaIframe.vue";

import { useRoute } from "vue-router";
import { displayFileTitle } from "shared-vuejs/api/utils";
import { useDialog } from "naive-ui";
import ChangeLayout from "@/components/editor/NaviBar/ChangeLayout.vue";
import DataEditor from "@/components/editor/Dialogs/DataEditor.vue";
import FormulaReference from "@/components/editor/Dialogs/FormulaReference.vue";
import { initSimpleClient } from "shared-vuejs/api/simple-client";
import { isDockerBackend } from "shared-vuejs/api/backend-config";
import { defineAsyncComponent } from "vue";

import MediaOnline from "@/components/editor/Media/MediaOnline.vue";
// import { initShareDb } from "shared-vuejs/src/edlib/common/connect/socket-sharedb";
// import { initJsonSync } from "shared-vuejs/src/edlib/common/sync/socket-jsonsync";

const GenerateLLM = defineAsyncComponent(
  () => import("@/components/editor/Media/GenerateLLM.vue"),
);
const NewFile = defineAsyncComponent(
  () => import("@/components/editor/Dialogs/NewFile.vue"),
);

const loadingBarTargetRef = ref(null);
g.globalDialog = useDialog();

onBeforeMount(async () => {
  let done = false;
  setTimeout(() => {
    if (!done) {
      piniaInfo().loadingBar = "Please wait...";
    }
  }, 300);
  // resetAllStores();
  const fileId = useRoute().params.id;
  let fileInfo = await loadFile(fileId);
  if (!fileInfo) {
    if (!isDockerBackend) {
      done = true;
      piniaInfo().loadingBar = "";
      piniaInfo().statusMessage = "This file is not available in this browser.";
      return;
    }
    // try to sync from server
    initSimpleClient(fileId);
    // wait a while for syncing then reload ?
    setTimeout(async () => {
      fileInfo = await loadFile(fileId);

      if (!fileInfo) {
        // location.replace("/");
      } else {
        done = true;
        updateUI();
      }
    }, 3000);
  } else {
    done = true;
    updateUI();
  }
});

function updateUI() {
  displayFileTitle(getFileInfo().name || getFileInfo().title);
  piniaInfo().loadingBar = "";
  piniaInfo().statusMessage = "";
  if (g.socket) {
    g.socket.close();
    g.socket = null;
  }
  // initWss();
  // initShareDb(fileInfo.id);
  // initJsonSync();
  initSimpleClient();
}

onMounted(async () => {
  window.addEventListener("message", async (e) => {
    // receive from external (like hub)
    if (e.data.cmd == "externalPPTX") {
      const pptxSettings: any = {};
      pptxSettings.fileName = e.data.file.name;
      pptxSettings.fileId = e.data.fileId || genId(10);
      pptxSettings.origin = e.origin;
      const { submitPPTX } = await import("shared-vuejs/api/unzipPPTX");
      submitPPTX(e.data.file, pptxSettings);
    } else if (e.data.cmd == "signaldb") {
      console.log(e.data.msg.shapes);
      updateShapes(e.data.msg.shapes);
    }
  });
});

const $style = useCssModule();
</script>

<style module>
.designermain,
.dcontainer {
  width: 100vw;
  background: white;
  left: 0;
  position: absolute;
  overflow: hidden;
  /*background:#26acde;*/
  touch-action: none;
  user-select: none;
}

.designermain {
  --move-handle-color: rgba(232, 90, 90, 0.5);
  --n-primary-color: v-bind("g.themeOverrides?.common?.primaryColor");
  top: 0;
  height: 100%;
}
</style>
<style>
html {
  overflow: hidden;
}
</style>
