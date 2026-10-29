<template>
  <div class="section colorSection">
    <div
      :class="{
        'color-box': true,
        'text-color': type == 'text',
      }"
      @click="showColorPallete"
    >
      <input
        :style="{
          border: 'none',
          width: '0px',
          height: '36px',
          visibility: 'hidden',
          position: 'absolute',
          left: 0,
        }"
        type="color"
        @input="setFillColor"
        @change="saveFillColor"
        :value="curColor"
        ref="inputPicker"
      />
      <NColorPicker
        :style="{
          opacity: 0,
          position: 'absolute',
        }"
        :value="curColor"
        @update:value="setFillColor"
        @complete="saveFillColor"
        :show="showColor"
        :showAlpha
        ref="target"
        v-if="!useSystemPicker"
      >
        <template #label></template>
        <template #action>
          <NFlex justify="end" style="width: 100%" :size="0">
            <!-- <IframeInputbox
            :value="curColor"
            :on-input="setFillColor"
            :style="{
              width: '90px',
              height: '30px',
              border: '1px solid #ccc',
            }"
            :input-attr="{
              style:
                'text-align: left; height: 30px; line-height: 28px; padding: 0 10px;',
              placeholder: '',
            }"
          /> -->

            <!-- <ToolbarItem
              buttonSize="small"
              :size="26"
              :icon="Prohibited28Regular"
              :onClick="
                (e) => {
                  setFillColor('');
                  showColor = false;
                }
              "
              tooltip="No color"
              v-if="showClear"
            /> -->

            <ToolbarItem
              buttonSize="small"
              v-if="ue.chrome"
              :icon="Eyedropper24Filled"
              :onClick="pickWithEyedropper"
              tooltip="Color Picker"
            />

            <ToolbarItem
              buttonSize="small"
              quaternary
              :size="30"
              label="System..."
              type="primary"
              bordered
              :onClick="
                () => {
                  inputPicker?.click();
                  showColor = false;
                }
              "
              tooltip="System Color Panel"
            />
          </NFlex>
        </template>
      </NColorPicker>
      <ToolbarItem
        quaternary
        :size="30"
        :icon="type == 'text' ? TextColor24Filled : PaintBucket24Filled"
        :extraClass="{ 'color-picker': true, hilite: true }"
        v-if="curColor !== '' && curColor !== 'none' /*&& !curGradient*/"
        :color="curColor"
        :onClick="showColorPallete"
      />
      <span v-if="label" class="picker-label">{{ label }}</span>
      <!-- for no color -->
      <!-- <ToolbarItem
        quaternary
        :size="30"
        :shp="{
          d: 'FM24,0L0,24',
          f: null,
          w: 24,
          h: 24,
          l: { color: '#444' },
          i: null,
          v: null,
          id: 'fill-btn-' + shpId,
        }"
        v-if="curColor == '' || curColor == 'none' || curGradient"
        :extraClass="{ 'color-picker': true }"
      /> -->
      <DropdownArrow />
    </div>
  </div>
</template>

<script setup lang="ts">
import { updateFile, getFileInfo } from "shared-vuejs/editor";

import { ref } from "vue";
import { onClickOutside } from "@vueuse/core";

import ToolbarItem from "@/components/editor/Toolbars/ToolbarItem.vue";
import {
  Eyedropper24Filled,
  PaintBucket24Filled,
  Prohibited28Regular,
  TextColor24Filled,
} from "@vicons/fluent";
import { NColorPicker, NFlex } from "naive-ui";
import DropdownArrow from "./DropdownArrow.vue";
import { ue } from "shared-vuejs/api/globalUtility";
import { colorToRgb, rgbaToHex } from "shared-vuejs/api/colorUtils";
import { saveDexie } from "shared-vuejs/api/dbutils";


// import IconFillColor from "@/components/common/IconFillColor.vue";

const props = defineProps({
  shpId: String,
  curColor: String,
  // curGradient: Object,
  onColorChange: Function,
  // showClear: Boolean,
  showAlpha: Boolean,
  useSystemPicker: Boolean,
  type: String,
  label: String,
});
const emit = defineEmits(["open"]);

const showColor = ref(false);
const target = ref(null);
const inputPicker = ref(null as any);

function saveFillColor() {
  const fileInfo = (getFileInfo());
  let colors = fileInfo.colors;
  if (!colors || colors.length == 0) {
    colors = [];
  }

  if (props.curColor && !colors.includes(props.curColor)) {
    colors.push(props.curColor);
  }
  // need timeout because set is added the colorpicker on mousedown

  updateFile({
    colors,
  });
  saveDexie();

  showColor.value = true;
}

// watch(
//   () => showColor.value,
//   () => {
//     if (showColor.value) {
//       nextTick(() => {
//         // we hide default input and use actions to avoid losing focus
//         const inp: any = document.querySelector(".n-color-picker-input");
//         if (inp) {
//           inp.style.display = "none"; // piniaSelect().editingInfo ? "none" : "";
//         }
//       });
//     }
//   },
// );

onClickOutside(target, (event) => {
  const triggerBtn = (event.target as HTMLElement).closest(".toolbar-item");
  if (triggerBtn?.classList.contains("color-picker")) {
    return;
  } else if ((event.target as HTMLElement).closest(".n-color-picker-panel")) {
    return;
  }
  if (showColor.value) {
    showColor.value = false;
    emit("close");
  }
});

function showColorPallete(e) {
  const { useSystemPicker } = props;
  emit("open");
  if (useSystemPicker) {
    inputPicker.value?.click();
  } else {
    showColor.value = true;
  }
}

function openPicker() {
  if (props.useSystemPicker) {
    inputPicker.value?.click();
  } else {
    showColor.value = true;
  }
}

defineExpose({ openPicker });

async function pickWithEyedropper() {
  try {
    const eyeDropper = new window["EyeDropper"]();
    const result = await eyeDropper.open();
    setFillColor(result.sRGBHex);
  } catch (err) {
    console.error("Error picking color: ", err);
  }
}

function setFillColor(color) {
  let val;
  if (color.constructor == Event) {
    const input: any = color.target;
    val = input?.value;
    // setTimeout(()=>{
    //   // toggle the type attribute to close the picker!
    //   input.setAttribute('type','text');
    //   input.setAttribute('type','color');
    // }, 100);
  } else {
    val = color;
  }
  val = rgbaToHex(colorToRgb(val));
  if (props.onColorChange) {
    props.onColorChange(val);
  }
}
</script>
<style scoped>
.section {
  font-size: 12px;
}

.colorSection {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 5px;
}

.selected {
  outline: 2px solid red !important;
}

.color-box {
  width: 48px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 4px;
  position: relative;
  outline: 1px solid rgb(224, 224, 230);
}

.color-box:hover {
  outline: 1px solid #888;
}

.color-box:has(.picker-label) {
  width: auto;
  gap: 5px;
  padding: 0 6px;
}

.picker-label {
  font-size: 12px;
  white-space: nowrap;
}

:global(.color-picker .n-button) {
  --n-color-hover: transparent !important;
  --n-color-focus: transparent !important;
  --n-color-pressed: transparent !important;
}

:global(.n-color-picker-trigger__fill) {
  border: 1px solid #ccc;
}

:global(.n-color-picker-control) {
  user-select: none;
}

/* :global(.n-color-picker-input) {
  display: none;
} */

:global(.n-color-picker-action) {
  justify-content: space-between;
}
</style>
<style>
.hilite .n-button__icon i svg {
  /* if content is white, hard to see, to hilite it */
  filter: drop-shadow(0.5px 0.5px 1px #aaa);
}
</style>
