<script setup lang="ts">
import { getFileInfo, resetAllStores } from "shared-vuejs/editor";

import { defineAsyncComponent, onMounted } from "vue";
import { useDialog } from "naive-ui";
import DashboardPage from "./DashboardPage.vue";

import { removePptxUndoHistory } from "shared-vuejs/api/undoHistory";
import g from "shared-vuejs/api/global";

const NewFile = defineAsyncComponent(
  () => import("@/components/editor/Dialogs/NewFile.vue"),
);
import LoadingModule from "./LoadingModule.vue";
import StatusBar from "@/components/editor/Toolbars/StatusBar.vue";

const GenerateLLM = defineAsyncComponent(
  () => import("@/components/editor/Media/GenerateLLM.vue"),
);
g.globalDialog = useDialog();

onMounted(async () => {
  const fileId = getFileInfo()?.id || sessionStorage.getItem("fileId");
  if (fileId) {
    try {
      await removePptxUndoHistory(fileId);
    } catch (error) {
      console.error("Unable to clear PPTX undo snapshots when leaving the editor", error);
    }
    if (sessionStorage.getItem("fileId") === fileId) {
      sessionStorage.removeItem("fileId");
    }
  }
  resetAllStores();
});
</script>

<template>
  <DashboardPage />
  <GenerateLLM />
  <NewFile />
  <StatusBar />
  <LoadingModule />
</template>
