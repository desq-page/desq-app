<script setup lang="ts">
import { translate } from "@/lib/i18n";
import { getShapeDeep, updateShape, getSelectEditingTextObject, getSelectSelShpFormat } from "shared-vuejs/editor";

import { saveDexie } from "shared-vuejs/api/dbutils";
import {
  getImageDimension,
  insertBlobImage,
} from "shared-vuejs/api/insertBlob";
import { piniaSelect } from "@/lib/common/store";
import { gid } from "shared-vuejs/api/utility";
import LocalMedia from "../Media/LocalMedia.vue";
import LayoutHeader from "@/components/common/Layouts/LayoutHeader.vue";
import ToolbarItemSwitch from "../Toolbars/ToolbarItemSwitch.vue";
// import DetachPicture from "./DetachPicture.vue";
import { computed } from "vue";
import { replaceColor } from "shared-vuejs/api/replace-color";

import { processImage } from "shared-vuejs/api/upload";
import crc32 from "crc/crc32";

type FillImage = { id: string; width: number; height: number };

const props = defineProps<{
  onPictureChange: (image: FillImage | Promise<FillImage | undefined>) => Promise<void>;
}>();

async function setImageTile(val) {
  const oldShp = getShapeDeep(getSelectSelShpFormat()?.id);

  if (oldShp?.type === "table") {
    const targets = getTableFillTargets(oldShp);
    for (const properties of targets) {
      const fill = properties.blipFill;
      if (!fill) continue;
      fill.tile = val ? {
        $_tx: 0,
        $_ty: 0,
        $_sx: 100000,
        $_sy: 100000,
      } : null;
    }
    updateShape(oldShp);
    saveDexie();
    return;
  }

  oldShp.blipFill = {
    ...oldShp.blipFill,
    tile: val ? {
      $_tx: 0,
      $_ty: 0,
      $_sx: 100000,
      $_sy: 100000,
    } : null,
  };

  if (!oldShp.blipFill.imgW || !oldShp.blipFill.imgH) {
    const dim: any = await getImageDimension(oldShp.blipFill.blip.$_target);
    oldShp.blipFill.imgW = dim.w;
    oldShp.blipFill.imgH = dim.h;
  }
  updateShape(oldShp);
  saveDexie();
}

async function makeTransparent(origColor) {
  const img = gid(getSelectSelShpFormat()?.id)?.querySelector("image");
  const blob = await replaceColor(
    img,
    origColor || "#FFFFFF",
    "rgba(255,255,255,0)",
  );
  insertBlobImage(blob, undefined);
}

// function setImageSlideBg() {
//   if (piniaSelect().selShpFormat?.blipFill) {
//     const i = { ...piniaSelect().selShpFormat?.blipFill };
//     if (!i.imgW) {
//       i.imgW = piniaSelect().selShpFormat?.w;
//       i.imgH = piniaSelect().selShpFormat?.h;
//     }
//     piniaSlides().updateSlide({
//       ...piniaSlides().slideInfo,
//       bg: {
//         ...piniaSlides().slideInfo.bg,
//         i,
//       },
//     });
//     deleteShape();
//     saveDexie();
//   }
// }

function setShapePicture(e, img) {
  props.onPictureChange(img);
  e.preventDefault();
}

function pasteShapePicture(image) {
  if (image) return props.onPictureChange(preparePastedPicture(image));
}

async function preparePastedPicture(image) {
  const name = `f${crc32(await image.arrayBuffer()).toString(16)}.webp`;
  const media = await processImage(image, { name });
  if (media) return { id: media.name, width: media.w, height: media.h };
}

const title = computed(() => {
  return pictureTarget.value
    ? "Change Picture"
    : "Insert Picture";
});

const pictureTarget = computed(() => {
  const selected = piniaSelect().selShpFormat;
  if (selected?.type === "table") {
    return getTableFillTargets(getShapeDeep(selected.id) || {})
      .some((properties) => properties.blipFill?.blip?.$_target);
  }
  return selected?.blipFill?.blip?.$_target;
});

const pictureTileEnabled = computed(() => {
  const selected = piniaSelect().selShpFormat;
  if (selected?.type === "table") {
    return getTableFillTargets(getShapeDeep(selected.id) || {})
      .some((properties) => !!properties.blipFill?.tile);
  }
  return !!selected?.blipFill?.tile;
});

function getTableFillTargets(tableShape) {
  const table = tableShape?.graphic?.graphicData?.tbl;
  if (!table) return [];
  const selectedCells = piniaSelect().selCells;
  let bounds = selectedCells?.length === 4
    ? selectedCells.map(Number)
    : null;
  const editingId = piniaSelect().editingTextObject || getSelectEditingTextObject();
  const match = typeof editingId === "string"
    ? editingId.match(/^tbl:(.+):(\d+):(\d+)$/)
    : null;
  if (!bounds && match && match[1] === tableShape.id) {
    const row = Number(match[2]);
    const col = Number(match[3]);
    bounds = [row, row, col, col];
  }
  if (!bounds) return [table.tblPr ||= {}];
  const targets = [];
  for (let row = bounds[0]; row <= bounds[1]; row++) {
    for (let col = bounds[2]; col <= bounds[3]; col++) {
      const cell = table.tr?.[row]?.tc?.[col];
      if (cell) targets.push(cell.tcPr ||= {});
    }
  }
  return targets;
}
</script>

<template>
  <LocalMedia
    :title="title"
    preview
    :hideSamples="!!piniaSelect().selShpFormat?.blipFill"
    :click-func="setShapePicture"
    :clipboard-func="pasteShapePicture"
  />

  <LayoutHeader label="Tile" />
  <!-- <DetachPicture /> -->

  <ToolbarItemSwitch
    :label="translate('Tile Picture As Texture')"
    :defaultVal="pictureTileEnabled"
    :onClick="(val) => setImageTile(val)"
    :disabled="!pictureTarget"
  />
  <div class="taskpane-guide">{{ translate('Crop picture to adjust tile position') }}</div>

</template>
