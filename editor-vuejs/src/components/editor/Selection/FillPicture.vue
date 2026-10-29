<script setup lang="ts">
import { getShapeDeep, updateShape, getSelectEditingTextObject, getSelectSelShpFormat } from "shared-vuejs/editor";

import { applyGroupFill } from "shared-vuejs/api/selection";
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

import { genImgCrop } from "shared-vuejs/api/genUtils";
import { updateBlipFillCrop } from "shared-vuejs/api/calcHandleBox";
import { processImage } from "shared-vuejs/api/upload";
import crc32 from "crc/crc32";

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
  applyShapePicture(img);
  e.preventDefault();
}

async function pasteShapePicture(image) {
  if (!image) return;
  const name = `f${crc32(await image.arrayBuffer()).toString(16)}.webp`;
  const media = await processImage(image, { name });
  if (media) {
    applyShapePicture({ id: media.name, width: media.w, height: media.h });
  }
}

function applyShapePicture(img) {
  const shp = getShapeDeep(getSelectSelShpFormat()?.id);
  if (shp) {
    if (shp.type === "table") {
      const blipFill = {
        blip: {
          $_w: img.width,
          $_h: img.height,
          $_target: img.id,
        },
      };
      for (const properties of getTableFillTargets(shp)) {
        properties.blipFill = structuredClone(blipFill);
        for (const type of ["noFill", "solidFill", "gradFill", "pattFill", "grpFill"]) {
          properties[type] = null;
        }
      }
      updateShape(shp);
      saveDexie();
      return;
    }
    // let iX =0, iY =0, iW = 100, iH = 100;
    // if (shp.i?.tile) {
    //   iX = shp.i.iX;
    //   iY = shp.i.iY;
    //   iW = shp.i.iW;
    //   iH = shp.i.iH;
    // } else {
    //   iX = round3((-(newW - shp?.w) / 2 / shp?.w) * 100 || 0);
    //   iW = round3(((newW - shp?.w + shp?.w) / shp?.w) * 100 || 100);
    //   iY = round3((-(newH - shp?.h) / 2 / shp?.h) * 100 || 0);
    //   iH = round3(((newH - shp?.h + shp?.h) / shp?.h) * 100 || 100);
    // }
    const isPic = shp.$_otag == "pic" || shp.ph?.$_type == "pic";
    const { iX, iY, iW, iH } = genImgCrop(
      img.width,
      img.height,
      getSelectSelShpFormat(),
    );
    const blip = {
      $_w: img.width,
      $_h: img.height,
      $_target: img.id,
    };
    if (!isPic) {
      shp.blipFill = {
        blip: {
          ...shp.blipFill.blip,
          ...blip,
        },
      };
      updateBlipFillCrop(shp, iX, iY, iW, iH);
    } else {
      shp.blipPr = {
        blip: {
          ...shp.blipPr.blip,
          ...blip,
        },
      };
      updateBlipFillCrop(shp, iX, iY, iW, iH, true);
    }

    if (isPic) {
      shp.$_otag = "pic";
    }

    applyGroupFill(shp);
    updateShape(shp);
    saveDexie();
  }
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
    :click-func="setShapePicture"
    :clipboard-func="pasteShapePicture"
  />

  <LayoutHeader label="Tile" />
  <!-- <DetachPicture /> -->

  <ToolbarItemSwitch
    label="Tile Picture As Texture"
    :defaultVal="pictureTileEnabled"
    :onClick="(val) => setImageTile(val)"
    :disabled="!pictureTarget"
  />
  <div class="taskpane-guide">Crop picture to adjust tile position</div>

</template>
