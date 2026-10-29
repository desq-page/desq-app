<template>
  <ToolbarItemDropdown
    quaternary
    :icon="MoreHorizontal32Filled"
    :options="ShapeContextMenuOptions"
    :usePointerUp="true"
    popover-id="shape-toolbar-popup"
    :xy="piniaInfo().curPopupXY || { x: 10000, y: 0 }"
    v-if="piniaInfo().curPopupId == 'shape-toolbar-popup'"
    :color="g.themeOverrides?.common?.primaryColor"
  />
</template>

<script setup lang="ts">
import { getHandlingHandlingInfo, getSelectCropShp, getSelectEditingInfo, getSelectEditingPoint, getSelectSelGrpShps, getSelectSelShpFormat } from "shared-vuejs/editor";

import { piniaInfo, piniaSelect } from "@/lib/common/store";
import ToolbarItemDropdown from "./ToolbarItemDropdown.vue";
import { useCssModule, computed, nextTick } from "vue";
import { showMessage } from "shared-vuejs/api/utils";

import {
  convertSVGToShape,
  deleteShape,
  lockSelectedShapes,
  switchEditingPoint,
} from "shared-vuejs/api/shape";
import {
  ClipboardPaste24Regular,
  DataLine20Filled,
  Delete20Regular,
  DocumentCopy24Regular,
  ShapeUnion24Regular,
  SquareMultiple24Regular,
  TableSimple24Regular,
  MoreHorizontal32Filled,
  PaintBucket24Filled,
  TextColor24Filled,
  SquareHintArrowBack16Regular,
} from "@vicons/fluent";
import {
  GroupObjects,
  InformationFilled,
  Layers,
  StarReview,
  Svg,
  TouchInteraction,
  UngroupObjects,
} from "@vicons/carbon";
import {
  layerItems,
  unionOptions,
  flipOptions,
  tableOptions,
  downloadOptions,
  showFlipShape,
  showEditingPoint,
} from "./ToolbarUtils";
import {
  DownloadFilled,
  FlipFilled,
  LockOutlined,
  TouchAppOutlined,
} from "@vicons/material";
import { detachFromGroup, toggleGroup } from "shared-vuejs/api/group";
import { copyShape, duplicateShape, pasteShape } from "shared-vuejs/api/clipboard";
import { addHandle } from "shared-vuejs/api/handle";
import g from "shared-vuejs/api/global";

import { toggleTaskPane } from "@/lib/main/utils.js";

const props = defineProps({
  selShps: Object,
  fixed: Boolean,
  tooltip: String,
  useContext: Boolean,
});

// const disabled = computed(
//   () =>
//     !!getHandlingHandlingInfo() ||
//     !!getSelectCropShp() ||
//     getSelectEditingPoint() !== undefined,
// );

const ShapeContextMenuOptions = computed(() => [
  // {
  //   label: "Shift + Right Click For More",
  //   icon: InformationFilled,
  //   show: !!piniaSelect().editingInfo,
  //   color: "green",
  //   key: "shiftclick",
  //   onClick: () => {
  //     showMessage("Press shift while right click on text to show more functions", 5000);
  //   }
  // },
  // {
  //   type:"divider",
  //   show: !!piniaSelect().editingInfo,
  // },
  {
    label: "Manage",
    key: "editshape",
    icon: TouchInteraction,
    children: [
      {
        icon: DocumentCopy24Regular,
        key: "copy",
        quaternary: true,
        color: "#239df0",
        onClick: (e) => {
          copyShape(
            e,
            undefined,
            window.getSelection()?.isCollapsed ? true : false,
          );
        },
        label: "Copy",
      },
      {
        // label: "Paste",
        icon: ClipboardPaste24Regular,
        key: "paste",
        quaternary: true,
        color: "#957606",
        onClick: (e) => {
          pasteShape(e);
        },
        label: "Paste",
      },
      {
        icon: SquareMultiple24Regular,
        quaternary: true,
        key: "duplicate",
        disabled: !!piniaSelect().editingInfo,
        onClick: (e) => {
          duplicateShape();
        },
        label: "Duplicate",
      },

      {
        icon: LockOutlined,
        quaternary: true,
        key: "lock",
        label: "Lock Shape",
        disabled: !!piniaSelect().editingInfo,
        tooltip: "Lock Shape(s)",
        onClick: () => {
          lockSelectedShapes();
        },
      },
      {
        type: "divider",
      },
      {
        label: "Save as Picture",
        size: 22,
        icon: DownloadFilled,
        key: "downloadshape",
        children: downloadOptions,
      },
      {
        type: "divider",
      },
      {
        icon: Delete20Regular,
        quaternary: true,
        key: "delete",
        label: "Delete Shape",
        // disabled: !!getSelectEditingInfo(),
        color: "red",
        onClick: () => {
          // delay so that click doesn't pass to another shape after this is deleted
          setTimeout(deleteShape, 100);
        },
      },
    ],
  },
  {
    type: "divider",
  },
  {
    label: "Arrange",
    key: "layers",
    icon: Layers,
    children: layerItems,
  },

  {
    type: "divider",
  },
  {
    label: "Table",
    key: "table",
    icon: TableSimple24Regular,
    children: tableOptions(),
    show: piniaSelect().selShpFormat?.type == "table",
  },
  {
    label: "Group",
    icon: GroupObjects,
    key: "group",
    show: piniaSelect().selShps.length > 1,
    onClick: (e) => {
      toggleGroup();
    },
  },
  {
    label: "Ungroup",
    icon: UngroupObjects,
    key: "ungroup",
    show:
      (piniaSelect().selShpFormat?.type == "group"),
    
    onClick: (e) => {
      toggleGroup();
    },
  },
  {
    label: "Detach",
    icon: UngroupObjects,
    key: "detach",
    show:
      !!piniaSelect().selShpFormat?.parentid &&
      !!piniaSelect().selShpFormat?.container,
    
    onClick: (e) => {
      const id = piniaSelect().selShpFormat?.id;
      detachFromGroup(id);
      nextTick(() => {
        addHandle(id, { exclusive: true });
      });
    },
  },
  // {
  //   type: "divider",
  //   show: showFlipShape() || showEditingPoint(),
  // },
  {
    label: "Merge",
    key: "mergeshape",
    icon: ShapeUnion24Regular,
    children: unionOptions,
    show: piniaSelect().selShps.length > 1,
  },
  {
    label: "Flip",
    key: "flipshape",
    icon: FlipFilled,
    children: flipOptions,
    show: showFlipShape(),
  },
  {
    label: "Edit Points",
    icon: DataLine20Filled,
    key: "editpoint",
    show: showEditingPoint(),
    
    onClick: (e) => {
      switchEditingPoint();
    },
  },
  {
    label: "Change Shape...",
    icon: SquareHintArrowBack16Regular,
    key: "changeshape",
    show: !["line", "connector", "table", "chart"].includes(piniaSelect().selShpFormat?.type),
    
    onClick: (e) => {
      toggleTaskPane("changeAutoshapes");
      if (!piniaInfo().lastTaskPane) {
        // mark this to return if click elsewhere
        setTimeout(() => piniaInfo().setLastTaskPane("shapefx"), 100)
      }
    },
  },
  // {
  //   label: "Word Art",
  //   icon: TextEffects24Filled,
  //   key: "warpsvg",
  //   show: !!selShpFormat.value?.t,
  //   onClick: (e) => {
  //     distortText(selShpFormat.value);
  //   },
  // },
  {
    label: "Convert to shape",
    icon: Svg,
    key: "convertsvg",
    show: !!piniaSelect().selShpFormat?.svg,
    
    onClick: (e) => {
      convertSVGToShape(getSelectSelShpFormat());
    },
  },
  {
    type: "divider",
    show: true ,
  },
  {
    label: "Animations...",
    key: "animations",
    icon: StarReview,
    
    onClick: () => toggleTaskPane("animations"),
  },
  // {
  //   type: "divider",
  // },
  {
    label: "Link...",
    icon: TouchAppOutlined,
    key: "hyperlink",
    
    onClick: (e) => {
      toggleTaskPane("hyperlink");
      console.log(window.getSelection());
    },
  },
  {
    type: "divider",
  },
  {
    label: "Format " + (isPic() ? "Picture" : "Shape") + "...",
    icon: PaintBucket24Filled,
    key: "formatshape",
    // show: !piniaSelect().editingTextObject,
    
    onClick: (e) => {
      if (isPic()) {
        toggleTaskPane("pictureoptions");
      } else {
        toggleTaskPane("shapefill");
      }
    },
  },
  {
    label: "Format Text...",
    size: 22,
    icon: TextColor24Filled,
    key: "formatpic",
    show: !!piniaSelect().selShpFormat?.txBody,
    
    onClick: (e) => {
      toggleTaskPane("textcolor");
    },
  },
  // {
  //   label: "Delete Shape",
  //   key: "delete",
  //   color: "red",
  //   icon: Delete20Regular,
  //   onClick: () => {
  //     // delay so that click doesn't pass to another shape after this is deleted
  //     setTimeout(deleteShape, 100);
  //   },
  //   disabled: getSelectSelGrpShps().length > 0,
  // },
]);

const isPic = () => {
  return piniaSelect().selShpFormat?.$_otag == "pic" || piniaSelect().selShpFormat?.ph?.$_type == "pic"
}

// const bounds: any = ref();

// watch([piniaSelect(), piniaHandling()], () => {
//   if (getInfoCurPopupId()) {
//     bounds.value = getSelectionBounds();
//   }
// });

const $style = useCssModule();
</script>

<!-- <style module>
.context-toolbar {
  position: absolute;
  background-color: white;
  box-shadow:
    0 3px 6px -4px rgba(0, 0, 0, 0.12),
    0 6px 16px 0 rgba(0, 0, 0, 0.4),
    0 9px 28px 8px rgba(0, 0, 0, 0.25);
  height: auto;
  display: flex;
  align-items: center;
  border-radius: 3px;
  z-index: 50;
  transform: translateX(-50%);
}

.fixed {
  box-shadow: none;
  transform: translateX(0) translateY(1px);
}
</style> -->
<style module>
.shape-title {
  font-size: 14px;
  padding: 5px 10px;
  font-weight: bold;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  max-width: 190px;
  white-space: nowrap;
}
</style>
<style>
.v-enter-active,
.v-leave-active {
  transition: opacity 0s ease;
  transition-delay: 0.2s;
}

.v-enter-from,
.v-leave-to {
  opacity: 0;
}
</style>
