<script setup lang="ts">
import { getFileInfo, resetAllStores } from "shared-vuejs/editor";

import { defineAsyncComponent, onMounted } from "vue";

import { removePptxUndoHistory } from "shared-vuejs/api/undoHistory";

import { piniaInfo } from "@/lib/common/store";
const EditorAgent = defineAsyncComponent(() => import("@/components/editor/Agent/EditorAgent.vue"));
const NewFile = defineAsyncComponent(
  () => import("@/components/editor/Dialogs/NewFile.vue"),
);
import LoadingModule from "./LoadingModule.vue";
import StatusBar from "@/components/editor/Toolbars/StatusBar.vue";

const GenerateLLM = defineAsyncComponent(
  () => import("@/components/editor/Media/GenerateLLM.vue"),
);
const emit = defineEmits<{ ready: [] }>();
const openCreatedPresentation = (id: string) => location.assign('/edit/' + id);

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
  emit("ready");
});
</script>

<template>
  <GenerateLLM v-if="piniaInfo().openLLMModal" />
  <NewFile v-if="piniaInfo().openNewFileModal" />
  <EditorAgent v-if="piniaInfo().openEditorAgentModal" mode="new" @created="openCreatedPresentation" />
  <StatusBar />
  <LoadingModule />
</template>
