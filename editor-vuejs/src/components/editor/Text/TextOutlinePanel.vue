<template>
  <LayoutHeader label="Text Outline" />
  <div class="field">
    <div class="subtitle1">Draw Outline</div>
    <NSwitch
      :value="!!lineWeight"
      :on-update:value="
        () => (lineWeight ? saveLineWidth(0) : saveLineWidth(1))
      "
      style="margin-left: 20px"
    />
  </div>

  <template v-if="lineWeight">
    <div class="field">
      <div class="subtitle1">Outline Color</div>
      <SlideColorPicker
        :cur-color="piniaSelect().editingInfo?.strokeClr"
        :on-change="(val) => setTextOutlineColor(val)"
        :hide-pattern="true"
      />
    </div>
    <div class="field">
      <div class="subtitle1">Outline Width</div>

      <input
        type="range"
        class="input-range"
        :value="lineWeight"
        :min="1"
        :max="20"
        @input="(e) => saveLineWidth(+(e.target as HTMLInputElement)?.value)"
      />

      <input
        :value="lineWeight"
        :size="3"
        @change="(e) => saveLineWidth(+(e.target as HTMLInputElement)?.value)"
      />
    </div>
  </template>
  <!-- </DialogBase> -->
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { piniaSelect } from "@/lib/common/store";
import { saveDexie } from "shared-vuejs/api/dbutils";
import { array2hex, color2array } from "shared-vuejs/api/colorUtils";
// import { hideTextToolbar } from "./ToolbarTextOptions";
import { execEditorSurroundSpan } from "shared-vuejs/api/execCommand.js";
import LayoutHeader from "@/components/common/Layouts/LayoutHeader.vue";
import { NSwitch } from "naive-ui";
import SlideColorPicker from "@/components/common/SlideColorPicker.vue";

const lineColor = ref("");
const lineWeight = ref(0);

watch(
  () => piniaSelect().editingInfo?.strokeW,
  () => {
    getLineValues();
  },
);

function getLineValues() {
  console.log(+piniaSelect().editingInfo?.strokeW);
  lineWeight.value = +piniaSelect().editingInfo?.strokeW || 0;
  // strokeOpacity.value = (piniaSelect().selShpFormat?.t?.l?.opacity ?? 1) * 100;
  lineColor.value = piniaSelect().editingInfo?.strokeClr;
}

getLineValues();

function saveLineWidth(val) {
  lineWeight.value = +val;
  if (val == 0) {
    execEditorSurroundSpan(
      {
        "--stroke-w": "",
        "--stroke-clr": "",
      },
      undefined,
      false,
    );
  } else {
    execEditorSurroundSpan(
      {
        "--stroke-w": lineWeight.value,
        "--stroke-clr": "#000000",
      },
      undefined,
      false,
    );
  }
  saveDexie();
}

function setTextOutlineColor(color) {
  if (typeof color == "string") {
    color = color2array(color);
  }

  color = array2hex(color);

  execEditorSurroundSpan(
    {
      "--stroke-clr": color,
      "--stroke-w": lineWeight.value || 1,
    },
    undefined,
    false,
  );
}
</script>
<style scoped>
.subtitle1 {
  font-size: 14px;
  font-weight: bold;
}

.field {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}

/* .guide {
  font-size: 14px;
} */
</style>
