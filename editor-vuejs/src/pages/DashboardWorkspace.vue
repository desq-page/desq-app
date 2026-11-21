<script setup lang="ts">
import { defineAsyncComponent, ref } from "vue";
import { useDialog } from "naive-ui";
import g from "shared-vuejs/api/global";
import DashboardPage from "./DashboardPage.vue";

const DashboardEditorSupport = defineAsyncComponent(() => import("./DashboardEditorSupport.vue"));
const filesReady = ref(false);
const editorReady = ref(false);
g.globalDialog = useDialog();
</script>

<template>
  <DashboardPage :editor-ready="editorReady" @files-ready="filesReady = true" />
  <DashboardEditorSupport v-if="filesReady" @ready="editorReady = true" />
</template>
