<template>
  <NTooltip
    placement="top"
    :style="{
      display: tooltip ? 'block' : 'none',
    }"
  >
    <template #trigger>
      <div
        class="template"
        :class="{
          selected: selected,
        }"
        @click="setTemplate?.(tpl)"
        @dblclick="openTemplate(tpl)"
      >
        <img
          :src="`/templates/${tpl}.jpg`"
          width=""
          :style="{
            objectFit: 'contain',
          }"
        />
        <div class="tpl-label">{{ label }}</div>
      </div>
    </template>
    {{ tooltip }}
  </NTooltip>
</template>
<script setup lang="ts">
// import { fetchServerTemplate } from "shared-vuejs/api/get-file";
// import { createNewFile } from "shared-vuejs/api/load";
// import { piniaInfo } from "@/lib/common/store";
import { piniaInfo } from "@/lib/common/store";
import { NTooltip } from "naive-ui";
import { createNewFile } from "shared-vuejs/api/load";
// import { genId } from "shared-vuejs/api/utility";

const props = defineProps({
  tpl: String,
  setTemplate: Function,
  selected: Boolean,
  label: String,
  tooltip: String,
});

async function openTemplate(tplValue) {
  piniaInfo().openNewFileModal = false;
  piniaInfo().loadingBar = "Please wait...";
  if (!tplValue || tplValue == "blank") {
    createNewFile(tplValue || "blank");
  } else {
    createNewFile(tplValue);
  }
}
</script>
<style scoped>
.template {
  width: 140px;
  cursor: pointer;
  color: black;
  text-align: left;
}

.template img {
  width: 100%;
  height: 90px;
  outline: 1px solid #948f8f;
  -webkit-user-drag: none;
  opacity: 0.7;
}

.template .tpl-label {
  color: #888;
  text-align: center;
}

.template.selected {
  outline: 1px solid red;
  outline-offset: 2px;
  border-radius: 2px;
}
</style>
