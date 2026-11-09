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
        :cur-color="lineColor"
        :on-change="setTextOutlineColor"
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
import { textboxEffectTargets } from "./textboxEffectStyle";
import { updateText } from "shared-vuejs/api/updateText";
import { execEditorSurroundSpan } from "shared-vuejs/api/execCommand.js";
import LayoutHeader from "@/components/common/Layouts/LayoutHeader.vue";
import { NSwitch } from "naive-ui";
import SlideColorPicker from "@/components/common/SlideColorPicker.vue";

const selection = piniaSelect();
const defaultColor = "#000000";
const lineColor = ref(defaultColor);
const lineWeight = ref(0);

function getLineValues() {
  if (selection.editingInfo) {
    const pending = selection.editingPendingFormats;
    lineWeight.value = Number(pending?.["--stroke-w"] ?? selection.editingInfo.strokeW) || 0;
    lineColor.value = (pending?.["--stroke-clr"] ?? selection.editingInfo.strokeClr) || defaultColor;
    return;
  }
  const styles = textboxEffectTargets().map(run => getComputedStyle(run));
  const outlined = styles.find(style => Number(style.getPropertyValue("--stroke-w")) > 0);
  lineWeight.value = Number(outlined?.getPropertyValue("--stroke-w")) || 0;
  lineColor.value = outlined?.getPropertyValue("--stroke-clr").trim() || defaultColor;
}

watch([
  () => selection.selShpFormat,
  () => selection.editingInfo?.strokeW,
  () => selection.editingInfo?.strokeClr,
  () => selection.editingPendingFormats?.["--stroke-w"],
  () => selection.editingPendingFormats?.["--stroke-clr"],
], getLineValues, { immediate: true, flush: "post" });

function applyOutline(style: Record<string, string | number>, defaultStrokeColor?: string, defaultStrokeWidth?: number) {
  if (selection.editingInfo) {
    execEditorSurroundSpan(defaultStrokeWidth ? { "--stroke-w": defaultStrokeWidth, ...style } : style, undefined, false);
  } else {
    const shapeId = selection.selShpFormat?.id;
    const targets = textboxEffectTargets();
    if (!shapeId || !targets.length) return;
    for (const target of targets) {
      const current = getComputedStyle(target);
      if (defaultStrokeWidth && !(Number(current.getPropertyValue("--stroke-w")) > 0))
        target.style.setProperty("--stroke-w", String(defaultStrokeWidth));
      if (defaultStrokeColor && !current.getPropertyValue("--stroke-clr").trim()) {
        target.style.setProperty("--stroke-clr", defaultStrokeColor);
      }
      for (const [property, value] of Object.entries(style))
        target.style.setProperty(property, String(value));
    }
    updateText(false, false, [shapeId]);
  }
  saveDexie();
}

function saveLineWidth(value: number) {
  if (!Number.isFinite(value) || value < 0) return;
  const enabling = !lineWeight.value && value > 0;
  lineWeight.value = value;
  if (!value) {
    applyOutline({ "--stroke-w": "0", "--stroke-clr": "" });
  } else {
    applyOutline({
      "--stroke-w": value,
      ...(enabling ? { "--stroke-clr": lineColor.value } : {}),
    }, lineColor.value);
  }
}

function setTextOutlineColor(color: string | number[]) {
  const hex = array2hex(typeof color === "string" ? color2array(color) : color);
  lineColor.value = hex;
  applyOutline({ "--stroke-clr": hex }, undefined, lineWeight.value || 1);
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
