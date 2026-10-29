<script setup lang="ts">
import { piniaInfo, piniaResize, piniaSelect } from "@/lib/common/store";
import { copyShape, pasteShape } from "shared-vuejs/api/clipboard";
import ToolbarItem from "./ToolbarItem.vue";
import { ClipboardPaste24Regular, DocumentCopy24Regular } from "@vicons/fluent";
</script>

<template>
  <ToolbarItem
    quaternary
    @click="copyShape"
    :style="{
      '--n-padding': '0 10px',
    }"
    :disabled="
      (!!piniaInfo().useGrid || piniaSelect().selShps.length == 0) &&
      piniaInfo().curMode !== 'slide'
    "
    :icon="DocumentCopy24Regular"
    :size="30"
    color="#239df0"
    caption="Copy"
  />
  <ToolbarItem
    quaternary
    :onPointerDown="pasteShape"
    :style="{
      '--n-padding': '0 10px',
    }"
    :disabled="!!piniaInfo().useGrid"
    color="#957606"
    :icon="ClipboardPaste24Regular"
    :size="26"
    caption="Paste"
  />
  <ToolbarItem type="divider" v-if="piniaResize().windowWidth >= 769" />
</template>
