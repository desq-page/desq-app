<template>
  <!-- <SelectionToolbar /> -->
  <DialogBase
    title="Format Shape"
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
        <div class="subtitle">Fill Opacity</div>
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
        <FillGradient
          :target="gradientTarget"
          :on-change="setGradient"
        />
      </div>
      <div v-if="curFill == 'blipFill'">
        <FillPicture />
      </div>
    </div>
  </DialogBase>
</template>

<script setup lang="ts">
import { getShapeDeep, updateShape, getSelectEditingTextObject, getSelectSelShpFormat, getTheme, getFileInfo, getMasterInfo } from "shared-vuejs/editor";

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
import { saveLastColor } from "shared-vuejs/api/slide";

import { getAllMediaPics, saveDexie } from "shared-vuejs/api/dbutils.js";
import { ref } from "vue";
import { deepUnref } from "@/components/vue-utils/unref.js";
import SlideColorPicker from "@/components/common/SlideColorPicker.vue";
import LayoutHeader from "@/components/common/Layouts/LayoutHeader.vue";

const currentTableFillProperties = computed(() => {
  const selected = piniaSelect().selShpFormat;
  if (selected?.type !== "table") return null;
  const table = selected.graphic?.graphicData?.tbl
    || getShapeDeep(selected.id)?.graphic?.graphicData?.tbl;
  const bounds = getTableCellBounds(selected);
  if (bounds) {
    return table?.tr?.[bounds[0]]?.tc?.[bounds[2]]?.tcPr;
  }
  return table?.tblPr;
});

const currentTableSolidFill = computed(() => currentTableFillProperties.value?.solidFill);
const gradientTarget = computed(() => piniaSelect().selShpFormat?.type === "table"
  ? { gradFill: currentTableFillProperties.value?.gradFill }
  : piniaSelect().selShpFormat);

function getTableCellBounds(selected) {
  const selection = piniaSelect().selCells;
  if (selection?.length === 4) {
    return [Number(selection[0]), Number(selection[1]), Number(selection[2]), Number(selection[3])];
  }
  const editingId = piniaSelect().editingTextObject || getSelectEditingTextObject();
  const match = typeof editingId === "string"
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
    if (fill?.gradFill) return "gradFill";
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
  const solidFill = selected?.type === "table"
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
  const solidFill = selected?.type === "table"
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
  const table = tableShape?.graphic?.graphicData?.tbl;
  if (!tableShape || !table) return;
  const bounds = getTableCellBounds(selected);
  const properties = [];
  if (bounds && table.tr) {
    for (let row = bounds[0]; row <= bounds[1]; row++) {
      for (let col = bounds[2]; col <= bounds[3]; col++) {
        const cell = table.tr[row]?.tc?.[col];
        if (cell) properties.push(cell.tcPr ||= {});
      }
    }
  } else {
    properties.push(table.tblPr ||= {});
  }
  const fillTypes = ["solidFill", "gradFill", "blipFill", "pattFill", "grpFill", "noFill"];
  for (const props of properties) {
    for (const type of fillTypes) props[type] = null;
    if (fillType) props[fillType] = value ?? {};
    else props.noFill = {};
  }
  updateShape(tableShape);
  saveDexie();
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
      ? (typeof color === "string" ? color2array(color) : color.slice())
      : null;
    if (rgba && rgba.length === 3) rgba.push(shpOpacity.value / 100);
    setTableFill(rgba ? "solidFill" : null, rgba ? {
      uniClr: {
        $_otag: "srgbClr",
        $_val: array2hex(rgba.slice(0, 3), true).toUpperCase(),
        ...(rgba[3] != null ? { alpha: { $_val: Math.round(rgba[3] * 100000) } } : {}),
      },
    } : null);
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

async function setBlipFill(image?) {
  if (piniaSelect().selShpFormat?.type === "table") {
    let target = image;
    if (!target) {
      const mediaColl = await getAllMediaPics(getFileInfo()?.id);
      target = mediaColl?.[0]?.name || "image1.png";
    }
    setTableFill("blipFill", { blip: { $_target: target } });
    return;
  }
  const shp = getShapeDeep(getSelectSelShpFormat()?.id);
  let target = image;
  if (!target) {
    const mediaColl = await getAllMediaPics(getFileInfo()?.id);
    target = mediaColl?.[0]?.name || "image1.png";
  }
  const blip = {
    $_target: target,
  };
  if (shp.$_otag == "pic" || shp.ph?.$_type == "pic") {
    shp.blipPr = {
      blip,
    };
  } else {
    shp.blipFill = {
      blip,
    };
  }
  shp.grpFill = null;
  shp.noFill = null;
  shp.solidFill = null;
  shp.gradFill = null;
  shp.$_useBgFill = null;
  shp.pattFill = null;
  applyGroupFill(shp);
  updateShape(shp);
  saveDexie();
}

function setBgFill() {
  const shp = getShapeDeep(getSelectSelShpFormat()?.id);
  shp.$_useBgFill = "1";
  if (shp.$_otag == "pic" || shp.ph?.$_type == "pic") {
    shp.blipPr = null;
  } else {
    shp.blipFill = null;
  }
  shp.grpFill = null;
  shp.noFill = null;
  shp.solidFill = null;
  shp.gradFill = null;
  shp.pattFill = null;
  applyGroupFill(shp);
  updateShape(shp);
  saveDexie();
}

function setPattFill() {
  const shp = getShapeDeep(getSelectSelShpFormat()?.id);
  if (shp.$_otag == "pic" || shp.ph?.$_type == "pic") {
    shp.blipPr = null;
  } else {
    shp.blipFill = null;
  }
  shp.grpFill = null;
  shp.noFill = null;
  shp.solidFill = null;
  shp.gradFill = null;
  shp.$_useBgFill = null;
  shp.pattFill = {
    fgClr: { uniClr: { $_otag: "schemeClr", $_val: "accent1" } },
    bgClr: { uniClr: { $_otag: "schemeClr", $_val: "bg1" } },
    $_prst: "openDmnd",
  };
  applyGroupFill(shp);
  updateShape(shp);
  saveDexie();
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
