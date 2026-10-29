<template>
  <DialogBase
    title="Format Text"
    :sub-tabbar-items="subTextTabbarItems"
    shapeOnly
    textOnly
  >
    <LayoutHeader label="Textbox Margin" />
    <div class="field-info">
      <span>Left</span>
      <input
        class="dim-field"
        :value="piniaSelect().selShpFormat?.txBody?.bodyPr?.$_lIns / EMU || 0"
        @change="(e) => updateField((e.target as any)?.value || 0, 'marginL')"
      />
    </div>
    <div class="field-info">
      <span>Right</span>
      <input
        class="dim-field"
        :value="piniaSelect().selShpFormat?.txBody?.bodyPr?.$_rIns / EMU || 0"
        @change="(e) => updateField((e.target as any)?.value || 0, 'marginR')"
      />
    </div>
    <div class="field-info">
      <span>Top</span>
      <input
        class="dim-field"
        :value="piniaSelect().selShpFormat?.txBody?.bodyPr?.$_tIns / EMU || 0"
        @change="(e) => updateField((e.target as any)?.value || 0, 'marginT')"
      />
    </div>
    <div class="field-info">
      <span>Bottom</span>
      <input
        class="dim-field"
        :value="piniaSelect().selShpFormat?.txBody?.bodyPr?.$_bIns / EMU || 0"
        @change="(e) => updateField((e.target as any)?.value || 0, 'marginB')"
      />
    </div>
    <template v-if="!piniaSelect().selShpFormat?.tightWrap">
      <LayoutHeader label="Text Options" />
      <ToolbarItemSwitch
        label="Wrap text"
        v-if="piniaSelect().selShpFormat?.type !== 'table'"
        :defaultVal="
          piniaSelect().selShpFormat?.txBody?.bodyPr?.$_wrap !== 'none'
        "
        :onClick="() => changeWrap()"
      />
      <ToolbarItemSwitch
        label="Autosize shape to fit text"
        v-if="piniaSelect().selShpFormat?.type !== 'table'"
        :defaultVal="piniaSelect().selShpFormat?.autosize"
        :onClick="() => changeAutosize()"
      />
      <ToolbarItemSwitch
        label="Shape-aware Textbox"
        v-if="piniaSelect().selShpFormat?.type !== 'table'"
        :defaultVal="piniaSelect().selShpFormat?.tightWrap"
        :onClick="() => changeTightWrap()"
      />
    </template>
    <LinkedTextboxOptions />
  </DialogBase>
</template>
<script setup lang="ts">
import { getShapeDeep, updateShape } from "shared-vuejs/editor";

import DialogBase from "@/components/common/Layouts/DialogBase.vue";
// import TextToolbarPara from "./TextToolbarPara.vue";
import { piniaSelect } from "@/lib/common/store";
import { updateText } from "shared-vuejs/api/updateText";
import ToolbarItemSwitch from "../Toolbars/ToolbarItemSwitch.vue";
import LayoutHeader from "@/components/common/Layouts/LayoutHeader.vue";
// import { getSelectedParas } from "shared-vuejs/api/textSelection";
// import IframeInputbox from "@/components/common/IframeInputbox.vue";
import { saveDexie } from "shared-vuejs/api/dbutils";
// import { hideTextToolbar } from "./ToolbarTextOptions";
import {
  // shapeTabbarItems,
  subTextTabbarItems,
} from "../Selection/ShapeTabbarOptions.js";

import LinkedTextboxOptions from "./LinkedTextboxOptions.vue";
import { EMU } from "shared-vuejs/api/globalUtility.js";

// const showExtra = ref(false);
function changeWrap() {
  const shp = getShapeDeep(piniaSelect().selShpFormat?.id);
  shp.txBody = {
    ...shp.txBody,
    bodyPr: {
      ...shp.txBody.bodyPr,
      $_wrap: shp?.txBody?.bodyPr?.$_wrap === "none" ? "square" : "none",
    },
  };
  updateShape(shp);
  // saveDexie();
  updateText(true);
}

function changeAutosize() {
  const shp = getShapeDeep(piniaSelect().selShpFormat?.id);
  shp.autosize = !shp?.autosize;
  updateShape(shp);
  // saveDexie();
  updateText(true);
}

function changeTightWrap() {
  const shp = getShapeDeep(piniaSelect().selShpFormat?.id);
  shp.tightWrap = !shp?.tightWrap;
  updateShape(shp);
  // saveDexie();
  updateText(true);
}

function updateField(val, fieldName) {
  //
  // let lvl;
  // if (!paras || paras.length > 1) {
  //   lvl = 1;
  // } else {
  //   lvl = (+paras[0].pPr?.$_lvl || 0) + 1;
  // }

  // const txBody = {
  //   ...shp.txBody,
  //   lstStyle: {
  //     ...shp.txBody?.lstStyle,
  //     ["lvl" + lvl]: {
  //       ...shp.txBody?.lstStyle?.["lvl" + lvl],
  //     },
  //   },
  // };

  // const updatedT = txBody.lstStyle["lvl" + lvl];
  // if (fieldName.includes("padding")) {
  //   if (fieldName == "paddingTop") {
  //     updatedT.spcBef = +val;
  //   } else {
  //     updatedT.spcAft = +val;
  //   }
  //   shp.txBody = txBody;
  //   getShapesUpdateShape()(shp);
  // } else
  if (fieldName.includes("margin")) {
    const shp = getShapeDeep(piniaSelect().selShpFormat?.id);
    const pos = fieldName.replace("margin", "").toLowerCase();
    shp.txBody = {
      ...shp.txBody,
      bodyPr: {
        ...shp.txBody.bodyPr,
        ["$_" + pos + "Ins"]: Math.round(val * EMU),
      },
    };
    updateShape(shp);
    saveDexie();
  }
}


</script>
<style scoped>
.field-info {
  display: flex;
  justify-content: space-between;
  margin: 10px 0;
}
</style>
