<template>
  <ToolbarItemDropdown
    quaternary
    :options="windowOptions"
    label="Window"
    :size="26"
    :disabled="!!piniaInfo().useGrid"
    :style="{ marginTop: '-5px' }"
  />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef } from "vue";
import { Application, Layers } from "@vicons/carbon";
import { Open24Regular, SlideLayout24Regular } from "@vicons/fluent";
import { getFileInfo } from "shared-vuejs/editor";
import { getAllDexie } from "shared-vuejs/api/db";
import { editMaster } from "shared-vuejs/api/master";
import { toggleTaskPane } from "@/lib/main/utils";
import { piniaInfo, piniaSlides } from "@/lib/common/store";
import ToolbarItemDropdown from "./ToolbarItemDropdown.vue";

const localFiles = shallowRef<any[]>([]);
const windowOptions = computed(() => [
  { label: "Layers", key: "layers", icon: Layers, onClick: () => toggleTaskPane("arrange") },
  {
    label: "Page Master",
    key: "master",
    icon: SlideLayout24Regular,
    onClick: () => { if (!piniaSlides().masterView) editMaster(); },
  },
  { type: "divider", key: "files-divider" },
  ...localFiles.value.map((file) => ({
    label: `${!file.name || file.name === "No name" ? "Blank" : file.name} (${String(file.id).slice(-4)})${file.id === getFileInfo()?.id ? " — current" : ""}`,
    key: `file:${file.id}`,
    icon: Open24Regular,
    onClick: () => location.replace("/edit/" + file.id),
  })),
]);

async function loadLocalFiles() {
  const files = [...(await getAllDexie("files"))];
  localFiles.value = files.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

const refreshOnFocus = () => void loadLocalFiles();
onMounted(() => {
  void loadLocalFiles();
  window.addEventListener("focus", refreshOnFocus);
});
onBeforeUnmount(() => window.removeEventListener("focus", refreshOnFocus));
</script>
