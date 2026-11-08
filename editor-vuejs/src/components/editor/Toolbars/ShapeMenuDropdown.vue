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
import { getFileInfo, getShapeDeep, getSlidesSlideId, getHandlingHandlingInfo, getSelectCropShp, getSelectEditingInfo, getSelectEditingPoint, getSelectSelGrpShps, getSelectSelShpFormat } from "shared-vuejs/editor";

import { piniaInfo, piniaSelect } from "@/lib/common/store";
import ToolbarItemDropdown from "./ToolbarItemDropdown.vue";
import { useCssModule, computed, nextTick } from "vue";
import { showError, showMessage } from "shared-vuejs/api/utils";

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
  AutoAwesomeOutlined,
  DownloadFilled,
  FlipFilled,
  LockOutlined,
  TouchAppOutlined,
} from "@vicons/material";
import { detachFromGroup, toggleGroup } from "shared-vuejs/api/group";
import { copyShape, duplicateShape, pasteShape } from "shared-vuejs/api/clipboard";
import { addHandle, deselectAll } from "shared-vuejs/api/handle";
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

function editablePicture() {
  const selection = piniaSelect();
  const picture = selection.selShpFormat;
  return selection.selShps.length === 1 && !selection.selGrpShps?.length &&
    picture?.type === 'image' && !picture.locked && !picture.video && !picture.audio &&
    !!picture.blipFill?.blip ? picture : undefined;
}

async function editPictureText() {
  const picture = editablePicture();
  const info = piniaInfo();
  const popup = info.curPopupXY;
  if (!picture || !popup || info.loadingBar) return;
  const image = document.getElementById(picture.id);
  const fileId = getFileInfo()?.id, slideId = getSlidesSlideId();
  if (!image || !fileId || !slideId) return;
  const rect = image.getBoundingClientRect();
  const angle = (picture.rot || 0) * Math.PI / 180;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const scale = rect.width / (Math.abs(cos) * picture.w + Math.abs(sin) * picture.h);
  if (!(scale > 0)) return;
  const centerX = rect.left + rect.width / 2, centerY = rect.top + rect.height / 2;
  // Core anchors the menu ten pixels below the original page-coordinate click.
  const dx = popup.x - window.scrollX - centerX;
  const dy = popup.y - 10 - window.scrollY - centerY;
  const flipX = picture.flipH ? -1 : 1, flipY = picture.flipV ? -1 : 1;
  const x = .5 + (dx * cos + dy * sin) * flipX / (scale * picture.w);
  const y = .5 + (dy * cos - dx * sin) * flipY / (scale * picture.h);
  if (x < 0 || x > 1 || y < 0 || y > 1) return;

  let highlight: HTMLDivElement | undefined;
  let frame = 0;
  let canceled = false;
  const active = () => !canceled && getFileInfo()?.id === fileId &&
    getSlidesSlideId() === slideId && !!getShapeDeep(picture.id);
  const checkSlide = () => {
    if (!active()) {
      canceled = true;
      highlight?.remove();
      return;
    }
    frame = requestAnimationFrame(checkSlide);
  };
  frame = requestAnimationFrame(checkSlide);
  info.loadingBar = 'Finding text…';
  try {
    const { extractImageTextAt } = await import('../../addon/extract-image-text.mjs');
    if (!active()) return;
    const extracted = await extractImageTextAt(picture.id, { x, y }, {
      active,
      progress: (message: string) => { if (active()) info.loadingBar = message; },
      highlight: (box: { x: number; y: number; width: number; height: number }) => {
        const offsetX = (box.x + box.width / 2 - .5) * picture.w * scale * flipX;
        const offsetY = (box.y + box.height / 2 - .5) * picture.h * scale * flipY;
        highlight = document.createElement('div');
        Object.assign(highlight.style, {
          position: 'fixed', pointerEvents: 'none', zIndex: '10000', boxSizing: 'border-box',
          border: '2px solid #2563eb', background: '#2563eb22',
          left: `${centerX + offsetX * cos - offsetY * sin}px`,
          top: `${centerY + offsetX * sin + offsetY * cos}px`,
          width: `${box.width * picture.w * scale}px`, height: `${box.height * picture.h * scale}px`,
          transform: `translate(-50%, -50%) rotate(${angle}rad)`,
        });
        document.body.append(highlight);
      },
    });
    if (!active()) return;
    if (extracted) {
      deselectAll();
      await addHandle(picture.id);
    } else showMessage('No text was found at that point.');
  } catch (error) {
    if (active()) showError(error instanceof Error ? error.message : String(error), 'Edit Text (AI)');
  } finally {
    cancelAnimationFrame(frame);
    highlight?.remove();
    info.loadingBar = '';
  }
}

const ShapeContextMenuOptions = computed(() => [
  {
    label: "Edit Text (AI)",
    key: "edit-picture-text",
    icon: AutoAwesomeOutlined,
    show: !!editablePicture(),
    onClick: editPictureText,
  },
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
