<template>
  <ToolbarItemDropdown
    quaternary
    :icon="MoreHorizontal32Filled"
    :options="CanvasContextMenuOptions"
    :use-pointer-up="true"
    popover-id="canvas-toolbar-popup"
    :xy="piniaInfo().curPopupXY || { x: 10000, y: 0 }"
    :color="g.themeOverrides?.common?.primaryColor"
  />
</template>
<script setup lang="ts">
import { piniaInfo } from "@/lib/common/store";
import { toggleTaskPane } from "@/lib/main/utils";
import { Layers, StarReview, TouchInteraction } from "@vicons/carbon";
import {
  ClipboardPaste24Regular,
  ColorBackground24Regular,
  DocumentCopy24Regular,
  MoreHorizontal32Filled,
  StarHalf24Filled,
} from "@vicons/fluent";
import ToolbarItemDropdown from "./ToolbarItemDropdown.vue";
import { copyShape, pasteShape } from "shared-vuejs/api/clipboard";
import { computed } from "vue";
import { deselectAll } from "shared-vuejs/api/handle";
import g from "shared-vuejs/api/global";

// const isShortened = computed(
//   () => piniaResize().windowWidth < 769 || piniaSelect().selShps.length > 0,
// );
// const isShortened = true;

const CanvasContextMenuOptions = computed(() => [
  {
    label: "Manage",
    key: "editslide",
    icon: TouchInteraction,
    children: [
      {
        icon: DocumentCopy24Regular,
        color: "#239df0",
        label: "Copy",
        onClick: (e) => {
          copyShape(
            e,
            // undefined,
            // window.getSelection()?.isCollapsed ? true : false,
          );
        },
        disabled: true,
        key: "copy",
      },
      {
        label: "Paste",
        icon: ClipboardPaste24Regular,
        color: "#957606",
        onClick: (e) => {
          pasteShape(e);
        },
        disabled: !!piniaInfo().useGrid,
        key: "paste",
      },
    ],
  },
  {
    type: "divider",
  },
  {
    icon: Layers,
    label: "Layers Pane",
    onClick: (e) => {
      toggleTaskPane("arrange");
    },
    key: "layers",
  },
  {
    icon: StarReview,
    label: "Animations...",
    onClick: (e) => {
      toggleTaskPane("animations");
    },
    key: "animations",
  },
  {
    type: "divider",
  },
  {
    icon: StarHalf24Filled,
    label: "Transition...",
    onClick: (e) => {
      toggleTaskPane("transition");
    },
    key: "transition",
  },
  {
    icon: ColorBackground24Regular,
    label: "Format Background...",
    onClick: (e) => {
      deselectAll();
      toggleTaskPane("formatslide");
    },
    key: "format",
  },
]);
</script>
