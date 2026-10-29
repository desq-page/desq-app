<template>
  <NDropdown
    trigger="click"
    placement="bottom-start"
    :options="options"
    @select="selectWindow"
    @update:show="
      (show) => {
        if (show) loadLocalFiles();
      }
    "
  >
    <span role="button" tabindex="0" aria-haspopup="menu">Window</span>
  </NDropdown>
</template>

<script setup lang="ts">
import { computed, h, onBeforeUnmount, onMounted, shallowRef } from "vue";
import { NDropdown, NIcon } from "naive-ui";
import { Layers } from "@vicons/carbon";
import { Open24Regular, SlideLayout24Regular } from "@vicons/fluent";
import { getFileInfo } from "shared-vuejs/editor";
import { getAllDexie } from "shared-vuejs/api/db";
import { editMaster } from "shared-vuejs/api/master";
import { toggleTaskPane } from "@/lib/main/utils";
import { piniaSlides } from "@/lib/common/store";
// import g from "shared-vuejs/api/global";

const localFiles = shallowRef<any[]>([]);
const icon = (component) => () =>
  h(NIcon, { size: 22 }, { default: () => h(component) });
const options = computed(() => [
  // {
  //   label: () => h('span', { style: { color: g.themeOverrides.common.primaryColor } }, 'Workspace'),
  //   key: "workspace",
  //   icon: () => h(NIcon, { size: 22, color: g.themeOverrides.common.primaryColor }, { default: () => h(Home) }),
  // },
  { label: "Layers", key: "layers", icon: icon(Layers) },
  { label: "Page Master", key: "master", icon: icon(SlideLayout24Regular) },
  { type: "divider", key: "files-divider" },
  ...localFiles.value.map((file) => ({
    label: `${!file.name || file.name === "No name" ? "Blank" : file.name} (${String(file.id).slice(-4)})${file.id === getFileInfo()?.id ? " — current" : ""}`,
    key: `file:${file.id}`,
    icon: icon(Open24Regular),
  })),
]);

async function loadLocalFiles() {
  const files = [...(await getAllDexie("files"))];
  localFiles.value = files.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

function selectWindow(key: string) {
  if (key === "workspace") location.replace("/work");
  else if (key === "layers") toggleTaskPane("arrange");
  else if (key === "master") {
    if (!piniaSlides().masterView) editMaster();
  } else if (key.startsWith("file:")) location.replace("/edit/" + key.slice(5));
}

const refreshOnFocus = () => void loadLocalFiles();
onMounted(() => {
  void loadLocalFiles();
  window.addEventListener("focus", refreshOnFocus);
});
onBeforeUnmount(() => window.removeEventListener("focus", refreshOnFocus));
</script>
