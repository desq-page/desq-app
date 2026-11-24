<template>
  <!-- <SelectionToolbar /> -->
  <DialogBase
    :title="piniaSelect().selShpFormat?.$_otag == 'pic'
        ? 'Format Picture'
        : 'Format Shape'"
    :sub-tabbar-items="subTabbarItems"
    :fill-selectors="fillSelectors"
    shapeOnly
    :disableTab="piniaSelect().selShpFormat?.type == 'line'"
  >
    <!-- <ShapeFormatOptions mode="shape" active="shapefill" /> -->
    <div v-if="piniaSelect().selShpFormat?.type !== 'iframe'">
      <div v-if="curFill == 'solidFill'">
        <LayoutHeader label="Solid Fill" />
        <SlideColorPicker
          :cur-color="currentSolidFillColor"
          :on-change="setFillColor"
          :showNoColor="false"
        />
        <!-- <div class="subtitle">Pick Color</div> -->
        <!-- <PickColor
          :cur-color="
            mapStyleThemeColor(
              piniaSelect().selShpFormat?.solidFill?.uniClr,
              getTheme(),
              getMasterInfo()?.clrMap,
            )
          "
          :on-color-change="setFillColor"
          :shp-id="piniaSelect().selShpFormat?.id"
          :use-system-picker="false && !ue.android"
        /> -->
        <div class="subtitle">{{ translate("Fill Opacity") }}</div>
        <RangeSlider
          :value="shpOpacity"
          :on-input="updateOpacity"
          :on-change="saveOpacity"
          :style="{
            padding: '10px 20px 0 0px',
            width: '90%',
            height: '20px',
          }"
          :disabled="curFill !== 'solidFill'"
        />
        <!-- <LayoutHeader label="Quick Fill Colors" /> -->
      </div>
      <div v-if="curFill == 'gradFill'">
        <FillGradient :target="gradientTarget" :on-change="setGradient" />
      </div>
      <div v-if="curFill == 'blipFill'">
        <FillPicture :on-picture-change="setBlipFill" />
      </div>
    </div>
  </DialogBase>
</template>

<script setup lang="ts">
import { translate } from "@/lib/i18n";
import {
  getShapeDeep,
  updateShape,
  getSelectEditingTextObject,
  getSelectSelShpFormat,
  getTheme,
  getFileInfo,
  getMasterInfo,
  getSlideInfo,
} from "shared-vuejs/editor";

import { piniaSelect } from "@/lib/common/store";
import { computed, onMounted, watch } from "vue";

import { applyGroupFill, setStyles } from "shared-vuejs/api/selection";
import { round, round3 } from "shared-vuejs/api/utility";
import {
  array2hex,
  color2array,
  mapStyleThemeColor,
} from "shared-vuejs/api/colorUtils";
import RangeSlider from "@/components/common/RangeSlider.vue";
import DialogBase from "@/components/common/Layouts/DialogBase.vue";
import FillPicture from "./FillPicture.vue";

import { subTabbarItems } from "./ShapeTabbarOptions";
import FillGradient from "./FillGradient.vue";
import { genImgCrop } from "shared-vuejs/api/genUtils";
import { updateBlipFillCrop } from "shared-vuejs/api/calcHandleBox";
import { saveLastColor } from "shared-vuejs/api/slide";

import { getAllMediaPics, saveDexie } from "shared-vuejs/api/dbutils.js";
import { ref } from "vue";
import { deepUnref } from "@/components/vue-utils/unref.js";
import SlideColorPicker from "@/components/common/SlideColorPicker.vue";
import LayoutHeader from "@/components/common/Layouts/LayoutHeader.vue";

const currentTableFillProperties = computed(() => {
  const selected = piniaSelect().selShpFormat;
  if (selected?.type !== "table") return null;
  const table =
    selected.graphic?.graphicData?.tbl ||
    getShapeDeep(selected.id)?.graphic?.graphicData?.tbl;
  const bounds = getTableCellBounds(selected);
  if (bounds) {
    return table?.tr?.[bounds[0]]?.tc?.[bounds[2]]?.tcPr;
  }
  return table?.tblPr;
});

const currentTableSolidFill = computed(
  () => currentTableFillProperties.value?.solidFill,
);
const gradientTarget = computed(() =>
  piniaSelect().selShpFormat?.type === "table"
    ? { gradFill: currentTableFillProperties.value?.gradFill }
    : piniaSelect().selShpFormat,
);

function getTableCellBounds(selected) {
  const selection = piniaSelect().selCells;
  if (selection?.length === 4) {
    return [
      Number(selection[0]),
      Number(selection[1]),
      Number(selection[2]),
      Number(selection[3]),
    ];
  }
  const editingId =
    piniaSelect().editingTextObject || getSelectEditingTextObject();
  const match =
    typeof editingId === "string"
      ? editingId.match(/^tbl:(.+):(\d+):(\d+)$/)
      : null;
  if (match && match[1] === selected?.id) {
    const row = Number(match[2]);
    const col = Number(match[3]);
    return [row, row, col, col];
  }
  return null;
}

const curFill = computed(() => {
  const sel = piniaSelect().selShpFormat;
  if (sel?.type === "table") {
    const fill = currentTableFillProperties.value;
    if (sel.$_useBgFill) return "useBgFill";
    if (fill?.gradFill) return "gradFill";
    if (sel.pattFill) return "pattFill";
    if (fill?.blipFill) return "blipFill";
    if (fill?.solidFill || sel.solidFill) return "solidFill";
    if (fill?.noFill) return "noFill";
    return "noFill";
  }
  const isPic = sel?.$_otag == "pic" || sel?.ph?.$_type == "pic";
  if (sel?.$_useBgFill) {
    return "useBgFill";
  } else if (sel?.gradFill) {
    return "gradFill";
  } else if (sel?.pattFill) {
    return "pattFill";
  } else if ((isPic && sel?.blipPr) || (!isPic && sel?.blipFill)) {
    return "blipFill";
  } else if (sel?.noFill) {
    return "noFill";
  } else if (sel?.solidFill) {
    return "solidFill";
  } else {
    return "noFill";
  }
});

const currentSolidFillColor = computed(() => {
  const selected = piniaSelect().selShpFormat;
  const solidFill =
    selected?.type === "table"
      ? currentTableSolidFill.value
      : selected?.solidFill;
  return mapStyleThemeColor(
    solidFill?.uniClr,
    getTheme(),
    getMasterInfo()?.clrMap,
  );
});

const fillSelectors = [
  {
    label: "No Fill",
    isChecked: () => curFill.value == "noFill",
    onClick: () => {
      setFillColor("");
    },
  },
  {
    label: "Solid Fill",
    isChecked: () => curFill.value == "solidFill",
    onClick: () => {
      setFillColor("#888888");
    },
  },
  {
    label: "Gradient Fill",
    isChecked: () => curFill.value == "gradFill",
    onClick: () => {
      setGradient();
    },
  },
  {
    label: "Picture Fill",
    isChecked: () => curFill.value == "blipFill",
    onClick: () => {
      setBlipFill();
    },
  },
  {
    label: "Pattern Fill",
    isChecked: () => curFill.value == "pattFill",
    onClick: () => {
      setPattFill();
    },
  },
  {
    label: "Page Background Fill",
    isChecked: () => curFill.value == "useBgFill",
    onClick: () => {
      setBgFill();
    },
  },
];

const shpOpacity = ref(100);

onMounted(getOpacity);

watch(
  () => [piniaSelect().selShpFormat, currentTableSolidFill.value],
  () => {
    getOpacity();
  },
);

function getOpacity() {
  const selected = piniaSelect().selShpFormat;
  const solidFill =
    selected?.type === "table"
      ? currentTableSolidFill.value
      : selected?.solidFill;
  let opacity = solidFill?.uniClr?.alpha?.$_val / 100000;
  if (isNaN(opacity)) opacity = 1;
  shpOpacity.value = round(opacity * 100);
}

function updateOpacity(opacity) {
  if (piniaSelect().selShpFormat?.type === "table") {
    setTableOpacity(opacity, true);
    return;
  }
  setStyles("opacity", round3(opacity / 100), true);
}

function saveOpacity(opacity) {
  if (piniaSelect().selShpFormat?.type === "table") {
    setTableOpacity(opacity);
    return;
  }
  setStyles("opacity", round3(opacity / 100));
}

function setTableFill(fillType, value) {
  const selected = getSelectSelShpFormat();
  const tableShape = getShapeDeep(selected?.id);
  if (!tableShape) return;
  tableShape.$_useBgFill = null;
  tableShape.pattFill = null;
  applyTableFill(tableShape, fillType, value, getTableCellBounds(selected));
  updateShape(tableShape);
  saveDexie();
}

function applyTableFill(tableShape, fillType, value, bounds) {
  const table = tableShape.graphic?.graphicData?.tbl;
  if (!table) return;
  const properties = [];
  if (bounds && table.tr) {
    for (let row = bounds[0]; row <= bounds[1]; row++) {
      for (let col = bounds[2]; col <= bounds[3]; col++) {
        const cell = table.tr[row]?.tc?.[col];
        if (cell) properties.push((cell.tcPr ||= {}));
      }
    }
  } else {
    properties.push((table.tblPr ||= {}));
  }
  const fillTypes = [
    "solidFill",
    "gradFill",
    "blipFill",
    "pattFill",
    "grpFill",
    "noFill",
  ];
  for (const props of properties) {
    for (const type of fillTypes) props[type] = null;
    if (fillType) props[fillType] = deepUnref(value ?? {});
    else props.noFill = {};
  }
}

function setTableOpacity(opacity, skipSave = false) {
  const selected = getSelectSelShpFormat();
  const tableShape = getShapeDeep(selected?.id);
  const table = tableShape?.graphic?.graphicData?.tbl;
  const bounds = getTableCellBounds(selected);
  const alpha = { $_val: round3(opacity / 100) * 100000 };
  if (bounds && table?.tr) {
    for (let row = bounds[0]; row <= bounds[1]; row++) {
      for (let col = bounds[2]; col <= bounds[3]; col++) {
        const fill = table.tr[row]?.tc?.[col]?.tcPr?.solidFill;
        if (fill?.uniClr) fill.uniClr.alpha = { ...alpha };
      }
    }
  } else if (table?.tblPr?.solidFill?.uniClr) {
    table.tblPr.solidFill.uniClr.alpha = alpha;
  }
  updateShape(tableShape);
  if (!skipSave) saveDexie();
}

function setFillColor(color?) {
  saveLastColor();
  const selectedShape = getSelectSelShpFormat();
  if (selectedShape?.type === "table") {
    const rgba = color
      ? typeof color === "string"
        ? color2array(color)
        : color.slice()
      : null;
    if (rgba && rgba.length === 3) rgba.push(shpOpacity.value / 100);
    setTableFill(
      rgba ? "solidFill" : null,
      rgba
        ? {
            uniClr: {
              $_otag: "srgbClr",
              $_val: array2hex(rgba.slice(0, 3), true).toUpperCase(),
              ...(rgba[3] != null
                ? { alpha: { $_val: Math.round(rgba[3] * 100000) } }
                : {}),
            },
          }
        : null,
    );
    return;
  }
  setStyles("gradFill", null);
  if (!color) {
    setStyles("solidFill", "");
    return;
  }
  // } else {
  if (color == "default") {
    color = getSelectSelShpFormat()?.solidFill?.uniClr?.$_val || "#888888";
  }
  if (typeof color == "string") {
    color = color2array(color);
  }
  if (color.length == 3) {
    const alpha = shpOpacity.value / 100;
    color.push(alpha);
  }
  setStyles("solidFill", color);
}

function setGradient(newGrad?) {
  if (!newGrad) {
    newGrad = {
      gsLst: {
        gs: [
          {
            uniClr: { $_otag: "srgbClr", $_val: "FFFFFF" },
            $_pos: 0,
          },
          {
            uniClr: { $_otag: "srgbClr", $_val: "000000" },
            $_pos: 100000,
          },
        ],
      },
      lin: {
        $_ang: 0,
      },
    };
  }
  saveLastColor();
  if (piniaSelect().selShpFormat?.type === "table") {
    setTableFill("gradFill", deepUnref(newGrad));
    return;
  }
  setStyles("gradFill", deepUnref(newGrad));
}

function selectedFillIds() {
  const { selGrpShps, selShps } = piniaSelect();
  return [...(selGrpShps.length ? selGrpShps : selShps)];
}

function applySelectedFill(ids, fillType, createFill, tableBounds = null) {
  let changed = false;
  for (const id of ids) {
    const shp = getShapeDeep(id);
    if (!shp || ["html", "video", "audio", "iframe", "line"].includes(shp.type))
      continue;

    if (shp.type === "table" && fillType === "blipFill") {
      shp.$_useBgFill = null;
      shp.pattFill = null;
      applyTableFill(
        shp,
        fillType,
        createFill(shp, false),
        tableBounds?.id === id ? tableBounds.bounds : null,
      );
    } else {
      const isPicture = shp.$_otag === "pic" || shp.ph?.$_type === "pic";
      const property =
        isPicture && fillType === "blipFill" ? "blipPr" : fillType;
      const fill = createFill(shp, isPicture);
      for (const type of [
        "grpFill",
        "noFill",
        "solidFill",
        "gradFill",
        "pattFill",
        "$_useBgFill",
        isPicture ? "blipPr" : "blipFill",
      ]) {
        shp[type] = null;
      }
      shp[property] = fill;
      applyGroupFill(shp);
    }

    updateShape(shp);
    changed = true;
  }
  if (changed) saveDexie();
}

type FillImage = { id: string; width: number; height: number };

async function setBlipFill(
  source?: FillImage | Promise<FillImage | undefined>,
) {
  const ids = selectedFillIds();
  if (!ids.length) return;
  const selected = getSelectSelShpFormat();
  const tableBounds =
    selected?.type === "table"
      ? { id: selected.id, bounds: getTableCellBounds(selected) }
      : null;
  const fileId = getFileInfo()?.id;
  const slideId = getSlideInfo()?.id;
  const image = await source;
  if (source && !image) return;
  const media = image ? null : await getAllMediaPics(fileId);
  if (getFileInfo()?.id !== fileId || getSlideInfo()?.id !== slideId) return;
  const target = image?.id || media?.[0]?.name || "image1.png";

  applySelectedFill(
    ids,
    "blipFill",
    (shp, isPicture) => {
      if (!image) return { blip: { $_target: target } };
      const property = isPicture ? "blipPr" : "blipFill";
      const fill = {
        blip: {
          ...shp[property]?.blip,
          $_w: image.width,
          $_h: image.height,
          $_target: target,
        },
      };
      if (shp.type !== "table") {
        const { iX, iY, iW, iH } = genImgCrop(image.width, image.height, shp);
        const croppedShape = {
          w: shp.w,
          h: shp.h,
          blipFill: {},
          [property]: fill,
        };
        updateBlipFillCrop(croppedShape, iX, iY, iW, iH, isPicture);
        if (isPicture) shp.$_otag = "pic";
        return croppedShape[property];
      }
      return fill;
    },
    tableBounds,
  );
}

function setBgFill() {
  applySelectedFill(selectedFillIds(), "$_useBgFill", () => "1");
}

function setPattFill() {
  applySelectedFill(selectedFillIds(), "pattFill", () => ({
    fgClr: { uniClr: { $_otag: "schemeClr", $_val: "accent1" } },
    bgClr: { uniClr: { $_otag: "schemeClr", $_val: "bg1" } },
    $_prst: "openDmnd",
  }));
}
</script>
<style scoped>
.subtitle {
  margin-top: 20px;
  margin-bottom: 5px;
  font-size: 14px;
  font-weight: bold;
}

/* .guide {
  font-size: 12px;
  margin-bottom: 10px;
  color: #888;
} */

hr {
  border-top: 1px solid #ccc;
}

.guide-toolbar-item {
  display: flex;
  align-items: center;
  gap: 5px;
  cursor: default;
}
</style>
