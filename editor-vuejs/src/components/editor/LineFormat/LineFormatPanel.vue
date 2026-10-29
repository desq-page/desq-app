<template>
  <!-- <SelectionToolbar /> -->
  <DialogBase
    shapeOnly
    title="Format Shape"

    :sub-tabbar-items="subTabbarItems"
    :fill-selectors="fillSelectors"
  >
    <!-- <ToolbarItemSwitch
      label="Draw Line/Border"
      :defaultVal="lineInfo?.drawOn"
      :onClick="setDrawOnOff"
    />
    <LayoutHeader label="Line Color" v-if="lineInfo?.drawOn" /> -->

    <div v-if="lineInfo.type == 'solidFill'">
      <!-- <div class="subtitle" style="margin-top: 0">Standard Colors</div> -->
      <!-- <StandardColors :onChange="setLineColor" :showNoColor="false" /> -->
      <div class="subtitle">Line Color</div>
      <SlideColorPicker 
       :cur-color="lineInfo.color"
        :on-change="setLineColor"
      />
      <!-- <PickColor
        :cur-color="
          mapStyleThemeColor(
            piniaSelect().selShpFormat?.ln?.solidFill?.uniClr,
            getTheme(),
            getMasterInfo()?.clrMap,
          )
        "
        :on-color-change="setLineColor"
        :hide-pattern="true"
        :shp-id="piniaSelect().selShpFormat?.id"
        :use-system-picker="false && !ue.android"
      /> -->
      <LayoutHeader v-if="piniaSelect().selShpFormat?.type !== 'table'" label="Line Opacity" clear-background>
        <template #extra>
          <RangeSlider
            :value="lineInfo?.opacity"
            :on-input="setLineOpacity"
            :on-change="saveLineOpacity"
            :min="0"
            :max="100"
            :style="{
              padding: '20px 20px 0 10px',
              width: '120px',
              height: '20px',
            }"
          />
        </template>
      </LayoutHeader>
    </div>
    <div v-if="lineInfo.type == 'gradFill'">
      <FillGradient
        type="line"
        :target="piniaSelect().selShpFormat?.ln"
        :on-change="setLineGradient"
      />
    </div>
    <template v-if="lineInfo.type != 'noFill' && piniaSelect().selShpFormat?.type !== 'table'">
      <LayoutHeader label="Line Weight" clear-background>
        <template #extra>
          <RangeSlider
            :value="round3(piniaSelect().selShpFormat?.ln.$_w / EMU) || 1"
            :on-input="setLineWidth"
            :on-change="saveLineWidth"
            :min="1"
            :max="50"
            :style="{
              padding: '20px 20px 0 10px',
              width: '120px',
              height: '20px',
            }"
        /></template>
      </LayoutHeader>
      <LayoutHeader label="Line Pattern"></LayoutHeader>
      <StrokeStyle />

      <template
        v-if="
          ['line', 'path'].some((t) =>
            piniaSelect().selShpFormat?.type?.toLowerCase().includes(t),
          )
        "
      >
        <LayoutHeader label="End Arrow"></LayoutHeader>
        <NFlex :size="50">
          <div>
            <div class="subtitle" style="margin-top: 0">Head Arrow</div>
            <ArrowStyle position="head" />
          </div>
          <div>
            <div class="subtitle" style="margin-top: 0">Tail Arrow</div>
            <ArrowStyle position="tail" />
          </div>
        </NFlex>
      </template>
    </template>
  </DialogBase>
</template>

<script setup lang="ts">
import { getShapeDeep, getTheme, getMasterInfo } from "shared-vuejs/editor";

import RangeSlider from "@/components/common/RangeSlider.vue";
import { setStyles } from "shared-vuejs/api/selection";
import { computed } from "vue";
import { piniaSelect, piniaSlides } from "@/lib/common/store";
import StrokeStyle from "./StrokeStyle.vue";
import ArrowStyle from "./ArrowStyle.vue";
import DialogBase from "@/components/common/Layouts/DialogBase.vue";
import LayoutHeader from "@/components/common/Layouts/LayoutHeader.vue";
import { round3 } from "shared-vuejs/api/utility";
import { mapStyleThemeColor } from "shared-vuejs/api/colorUtils";
import { EMU, ue } from "shared-vuejs/api/globalUtility";
import { NFlex } from "naive-ui";
import {
  // shapeTabbarItems,
  subTabbarItems,
} from "../Selection/ShapeTabbarOptions";
import FillGradient from "../Selection/FillGradient.vue";

import SlideColorPicker from "@/components/common/SlideColorPicker.vue";

// import "element-plus/es/components/slider/style/css";
// const drawOn = ref(true);
// const lineColor = ref("");
// // const strokeStyle = ref("solid");
// const lineWeight = ref(1);
// const strokeOpacity = ref(100);

const lineInfo = computed(() => {
  const selShpInfo = piniaSelect().selShpFormat;
  const fillClr = selShpInfo?.type === "table"
    ? getTableBorderFill(selShpInfo)?.uniClr
    : selShpInfo?.ln?.solidFill?.uniClr;
  return {
    // drawOn: !!fillClr?.$_val || !!selShpInfo?.ln?.gradFill,
    lineWeight: selShpInfo?.ln?.$_w / EMU || 1,
    opacity: round3((fillClr?.alpha?.$_val ?? 100000) / 1000),
    color: mapStyleThemeColor(fillClr, getTheme(), getMasterInfo()?.clrMap)
      || "url(images/nocolor.png)",
    type:
      !selShpInfo?.ln?.noFill && fillClr
        ? "solidFill"
        : selShpInfo?.ln?.gradFill
          ? "gradFill"
          : "noFill",
  };
});

function getTableBorderFill(selected) {
  const table = getShapeDeep(selected?.id)?.graphic?.graphicData?.tbl;
  const rows = table?.tr || [];
  const bounds = piniaSelect().selCells;
  const candidates = [];
  if (bounds?.length === 4) {
    for (let row = Number(bounds[0]); row <= Number(bounds[1]); row++) {
      for (let col = Number(bounds[2]); col <= Number(bounds[3]); col++) {
        candidates.push([row, col]);
      }
    }
  } else {
    rows.forEach((row, rowIndex) => {
      (row.tc || []).forEach((_cell, colIndex) => candidates.push([rowIndex, colIndex]));
    });
  }
  for (const [row, col] of candidates) {
    const props = rows[row]?.tc?.[col]?.tcPr;
    for (const side of ["lnT", "lnR", "lnB", "lnL"]) {
      if (props?.[side]?.solidFill) return props[side].solidFill;
    }
  }
  return null;
}

const fillSelectors = [
  {
    label: "No Line",
    isChecked: () => lineInfo.value.type == "noFill",
    onClick: () => {
      setLineOff();
    },
  },
  {
    label: "Solid Line",
    isChecked: () => lineInfo.value.type == "solidFill",
    onClick: () => {
      setLineColor("#000000");
    },
  },
  {
    label: "Gradient Line",
    isChecked: () => lineInfo.value.type == "gradFill",
    onClick: () => {
      setLineGradient();
    },
  },
];

// function setDrawOnOff(val) {
//   if (val) {
//     if (piniaSelect().selShpFormat?.l?.width == 0) {
//       setStyles("widthStroke", 1, true);
//     }
//     setStyles("strokeColor", "#000000");
//   } else {
//     setStyles("strokeColor", "");
//   }
// }

function setLineGradient(newGrad?) {
  if (!newGrad) {
    newGrad = {
      gsLst: {
        gs: [
          {
            uniClr: { $_otag: "srgbClr", $_val: "000000" },
            $_pos: 0,
          },
          {
            uniClr: { $_otag: "srgbClr", $_val: "ffffff" },
            $_pos: 100000,
          },
        ],
      },
      lin: {
        $_ang: 0,
      },
    };
  }
  setStyles("strokeGradient", newGrad);
}

function setLineOff() {
  // setStyles("strokeGradient", null);
  setStyles("strokeColor", "");
}

function setLineColor(color) {
  // setStyles("strokeGradient", null);
  setStyles("strokeColor", color);
}

function setLineWidth(val) {
  setStyles("widthStroke", val, true);
}

function saveLineWidth() {
  console.log(piniaSelect().selShpFormat?.ln?.$_w);
  setStyles("widthStroke", piniaSelect().selShpFormat?.ln?.$_w / EMU); //with save
}

function setLineOpacity(val) {
  setStyles("strokeOpacity", round3(val / 100), true);
}

function saveLineOpacity() {
  setStyles("strokeOpacity", round3(lineInfo.value?.opacity / 100)); //with save
}
</script>
<style scoped>
.subtitle {
  margin-top: 20px;
  margin-bottom: 5px;
  font-size: 14px;
  font-weight: bold;
}
/* 
.guide {
  font-size: 14px;
} */
</style>
