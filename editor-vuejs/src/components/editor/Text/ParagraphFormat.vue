<template>
  <DialogBase
    title="Format Text"
    :sub-tabbar-items="subTextTabbarItems"
    shapeOnly
    textOnly
  >
    <LayoutHeader label="Paragraph Position" v-if="paraPositionVisible()" />
    <TextToolbarPara v-if="paraPositionVisible()" />
    <LayoutHeader label="Paragraph Spacing" />
    <div class="field-info">
      <span>Indent</span>
      <IframeInputbox
        :value="
          piniaSelect().editingInfo?.indent ||
          piniaSelect().selShpFormat?.txBody?.bodyPr?.defRPr?.$_indent ||
          0
        "
        :onChange="(val) => updateField(val, 'indent')"
        :input-attr="{
          type: 'number',
          style: 'width: 60px',
          textAlign: 'right',
          min: 0,
          max: 30,
          step: 2,
        }"
        :style="{
          width: '60px',
        }"
      />
    </div>
    <div class="field-info">
      <span>Margin Left</span>
      <IframeInputbox
        :value="
          piniaSelect().editingInfo?.marL ||
          piniaSelect().selShpFormat?.txBody?.bodyPr?.defRPr?.$_marL ||
          0
        "
        :onChange="(val) => updateField(val, 'marL')"
        :input-attr="{
          type: 'number',
          style: 'width: 60px',
          textAlign: 'right',
          min: 0,
          max: 30,
          step: 2,
        }"
        :style="{
          width: '60px',
        }"
      />
    </div>
    <div class="field-info">
      <span>Space Before</span>
      <IframeInputbox
        :value="piniaSelect().editingInfo?.spcBef || 0"
        :onChange="(val) => updateField(val, 'paddingTop')"
        :input-attr="{
          type: 'number',
          style: 'width: 60px',
          textAlign: 'right',
          min: 0,
          max: 30,
          step: 2,
        }"
        :style="{
          width: '60px',
        }"
      />
    </div>
    <div class="field-info">
      <span>Space After</span>
      <IframeInputbox
        :value="piniaSelect().editingInfo?.spcAft || 0"
        :onChange="(val) => updateField(val, 'paddingBottom')"
        :input-attr="{
          type: 'number',
          style: 'width: 60px',
          textAlign: 'right',
          min: 0,
          max: 30,
          step: 2,
        }"
        :style="{
          width: '60px',
        }"
      />
    </div>
    <div class="field-info">
      <span>Line Spacing Multiply</span>
      <select
        :value="piniaSelect().editingInfo?.lnSpcPct || 1"
        :onchange="(e) => updateField(e.target.value, 'lnSpcPct')"
      >
        <option value="1">1</option>
        <option value="1.5">1.5</option>
        <option value="2">2</option>
        <option value="3">3</option>
        <option value="4">4</option>
        <option value="5">5</option>
      </select>
    </div>
    <div class="field-info">
      <span>Line Spacing Points</span>
      <IframeInputbox
        :value="
          piniaSelect().editingInfo?.lnSpc ||
          piniaSelect().selShpFormat?.txBody?.bodyPr?.lstStyle?.$_lnSpc ||
          ''
        "
        :onChange="(val) => updateField(val, 'lnSpc')"
        :input-attr="{
          type: 'number',
          style: 'width: 60px',
          textAlign: 'right',
          min: -10,
          max: 10,
          step: 0.2,
        }"
        :style="{
          width: '60px',
        }"
      />
    </div>
    <div class="field-info">
      <label for="widow-control">Widow/orphan control (keep paragraph together)</label>
      <input
        id="widow-control"
        type="checkbox"
        :checked="!!piniaSelect().editingInfo?.widowControl"
        @change="(e) => updateField(e.target.checked, 'widowControl')"
      />
    </div>
  </DialogBase>
</template>
<script setup lang="ts">
import DialogBase from "@/components/common/Layouts/DialogBase.vue";
import TextToolbarPara from "./TextToolbarPara.vue";
import { piniaSelect } from "@/lib/common/store";
import { updateText } from "shared-vuejs/api/updateText";
import LayoutHeader from "@/components/common/Layouts/LayoutHeader.vue";
import { getSelectedParas } from "shared-vuejs/api/textSelection";
import IframeInputbox from "@/components/common/IframeInputbox.vue";
// import { hideTextToolbar } from "./ToolbarTextOptions";
import {
  // shapeTabbarItems,
  subTextTabbarItems,
} from "../Selection/ShapeTabbarOptions";

function paraPositionVisible() {
  return (
    // !piniaSelect().selShpFormat?.t && piniaSelect().selShpFormat?.type !== "table"
    false
  );
}

function updateField(val, fieldName) {
  const paras: any = getSelectedParas();

  if (paras) {
    paras.forEach((pNode) => {
      if (pNode) {
        if (fieldName == "widowControl") {
          pNode.dataset.widowControl = val ? "1" : "0";
        } else if (fieldName == "indent") {
          pNode.style.setProperty("--indent", -val);
        } else if (fieldName == "marL") {
          pNode.style.setProperty("--mar-l", val);
        } else if (fieldName == "paddingTop") {
          pNode.style.setProperty("--spc-bef", val);
        } else if (fieldName == "paddingBottom") {
          pNode.style.setProperty("--spc-aft", val);
        } else if (fieldName == "lnSpc") {
          pNode.style.setProperty("--ln-spc", val + "pt");
          pNode.style.removeProperty("--ln-spc-pct");
        } else if (fieldName == "lnSpcPct") {
          pNode.style.setProperty("--ln-spc-pct", val);
          pNode.style.removeProperty("--ln-spc");
        } else {
          // pNode.style[fieldName] = val;
        }
      }
    });
  }
  updateText(true);
}
</script>
<style scoped>
.field-info {
  display: flex;
  justify-content: space-between;
  margin: 10px 0;
}
</style>
