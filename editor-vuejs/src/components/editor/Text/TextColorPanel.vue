<template>
  <DialogBase
    shapeOnly
    textOnly
    title="Format Text"
    :sub-tabbar-items="subTextTabbarItems"
    :fill-selectors="fillSelectors"
  >
    <template v-if="textInfo.type == 'solidFill'">
      <LayoutHeader label="Text Color" />
      <SlideColorPicker
        :cur-color="
          mapStyleThemeColor(
            textColor,
            getTheme(),
            getMasterInfo()?.clrMap,
          )
        "
        :on-change="setTextColor"
      />
      <template v-if="!ue.safari">
        <div class="subtitle">Text Opacity</div>
        <input type="range" class="input-range" :value="textOpacity" :min="1" :max="100" 
          @input="(e) => saveOpacity(+(e.target as HTMLInputElement)?.value)" 
        />
      </template>
    </template>
    <div v-if="textInfo.type == 'gradFill'">
      <FillGradient
        :target="mapCssGradToOO(textGradient)"
        :on-change="setGradient"
      />
    </div>
    <div v-if="textInfo.type == 'blipFill'">
      <LocalMedia
        title="Change Picture"
        preview
        :clickFunc="
          (evt, img) => {
            console.log(evt, img);
            setTextImage(img.id || img?.src);
          }
        "
        :clipboard-func="pasteTextImage"
      />
    </div>

    <!-- <ToolbarItem
      :icon="Gradient"
      label="Gradient Colors..."
      :onClick="
        (e) => {
          toggleTaskPane('textgradient');
        }
      "
      bordered
    ></ToolbarItem> -->

    <!-- <LayoutHeader label="Text Fill"></LayoutHeader> -->

    <!-- <LayoutHeader label="Picture Fill" :clear-background="true">
      <template #switch>
        <NSwitch
          size="small"
          :disabled="
            !piniaSelect().selShpFormat?.i && !piniaSelect().selShpFormat?.grad
          "
          :value="
            (piniaSelect().selShpFormat?.i ||
              piniaSelect().selShpFormat?.grad) &&
            !!piniaSelect().selShpFormat?.t?.fillBg
          "
          :on-update:value="updateFillBg"
          style="margin-right: 10px"
        />
      </template>
    </LayoutHeader> -->

    <!-- <div class="taskpane-guide">
      To enable text picture fill, apply picture fill on shape first.
    </div> -->

    <!-- <DetachPicture /> -->
  </DialogBase>
</template>

<script setup lang="ts">
import { getShapeDeep, updateShape, getTheme, getFileInfo, getMasterInfo } from "shared-vuejs/editor";

import DialogBase from "@/components/common/Layouts/DialogBase.vue";
import { piniaSelect } from "@/lib/common/store";
import { gid, round } from "shared-vuejs/api/utility";
import {
  array2hex,
  color2array,
  colorOpacity,
  mapStyleThemeColor,
} from "shared-vuejs/api/colorUtils";
import { ue } from "shared-vuejs/api/globalUtility";
import { execEditorSurroundSpan } from "shared-vuejs/api/execCommand";
import { updateText } from "shared-vuejs/api/updateText";
import SlideColorPicker from "@/components/common/SlideColorPicker.vue";
import LayoutHeader from "@/components/common/Layouts/LayoutHeader.vue";
import { getAllMediaPics, saveDexie } from "shared-vuejs/api/dbutils";
import { ref, watch } from "vue";
import {
  // shapeTabbarItems,
  subTextTabbarItems,
} from "../Selection/ShapeTabbarOptions";

import { getBaseHref } from "shared-vuejs/api/get-file.js";
import FillGradient from "../Selection/FillGradient.vue";
import LocalMedia from "../Media/LocalMedia.vue";
import { genFillGradient, mapCssGradToOO } from "shared-vuejs/api/gradientUtils.js";
import { processImage } from "shared-vuejs/api/upload";
import crc32 from "crc/crc32";
// import { retrieveTextStyle } from "shared-vuejs/api/updateText.js";

const props = defineProps({
  onChange: Function,
});

const textColor = ref("");
const textOpacity = ref(0);
const textGradient = ref("");

const textInfo = ref(null as any);

const fillSelectors = [
  {
    label: "No Text Fill",
    isChecked: () => textInfo.value?.type == "noFill",
    onClick: () => {
      applyTextFillStyle(
        {
          "--clr": 'transparent',
          "--img": undefined,
          "--grad": undefined,
          // "background-image": '',
        },
        undefined,
        false,
      );
      saveDexie();
    },
  },
  {
    label: "Solid Text Fill",
    isChecked: () => textInfo.value?.type == "solidFill",
    onClick: () => {
      applyTextFillStyle(
        {
          "--clr": '#000000',
          "--img": undefined,
          "--grad": undefined,
          // "background-image": '',
        },
        undefined,
        false,
      );
      saveDexie();
    },
  },
  {
    label: "Gradient Text Fill",
    isChecked: () => textInfo.value?.type == "gradFill",
    onClick: () => {
      const def = 'linear-gradient(180deg,#FFFFFF, #000000)'
      const gradJson = mapCssGradToOO(def);
      setGradient(gradJson.gradFill)
    },
  },
  {
    label: "Picture Text Fill",
    isChecked: () => textInfo.value?.type == "blipFill",
    onClick: () => {
      setTextImage();
    },
  },
];

watch(
  [() => piniaSelect().selShpFormat, () => piniaSelect().editingInfo,
    () => piniaSelect().editingInfo?.color,
    () => piniaSelect().editingPendingFormats?.["--clr"],
    () => piniaSelect().editingInfo?.grad,
    () => piniaSelect().editingInfo?.img],
  updateCurrentColor,
);
updateCurrentColor();

function updateCurrentColor() {
  textInfo.value = {
    type: 'noFill'
  }

  if (piniaSelect().editingInfo) {
    const currentColor = piniaSelect().editingPendingFormats?.["--clr"] ?? piniaSelect().editingInfo?.color;
    const rgba = color2array(
      currentColor
      //  ||
      //   piniaSelect().selShpFormat?.t?.style?.color ||
      //   piniaSelect().selShpFormat?.style?.color,
    );
    textOpacity.value = Math.round(colorOpacity(currentColor) * 100);
    textColor.value = array2hex(rgba.slice(0, 3)) || "#000000";
    textGradient.value = piniaSelect().editingInfo?.["grad"];

    if (piniaSelect().editingInfo?.["grad"]) {
      textInfo.value = {
        type: 'gradFill'
      }
    } else if (piniaSelect().editingInfo?.["img"]) {
      textInfo.value = {
        type: 'blipFill'
      }
    } else if (textOpacity.value == 0 || currentColor == 'transparent') {
      textInfo.value = {
        type: 'noFill'
      }
    } else {
      textInfo.value = {
      type: 'solidFill'
    }
    }
  } else {
    // try get the textbox
    const textbox = gid(piniaSelect().selShpFormat?.id)?.querySelector(".textbox");
    if (textbox) {
      textGradient.value = textbox.style.getPropertyValue("--grad")
      const firstRun = textbox.querySelector<HTMLElement>('p [style*="--clr"]');
      const color = firstRun?.style.getPropertyValue("--clr") || textbox.style.getPropertyValue("--clr") || "#000000";
      textOpacity.value = Math.round(colorOpacity(color) * 100);
      textColor.value = array2hex(color2array(color).slice(0, 3)) || "#000000";
      if (textbox.style.getPropertyValue("--img")) {
        textInfo.value = {
          type: 'blipFill'
        }
      } else if (textGradient.value) {
        textInfo.value = {
          type: 'gradFill'
        }
      } else if (textColor.value) {
        textInfo.value = {
          type: 'solidFill'
        }
      }
    }
  }
}

function updateOpacity(opacity) {
  textOpacity.value = round(opacity);
  // setTextColor(textColor.value, true);
}

function saveOpacity(val) {
  textOpacity.value = val;
  setTextColor(textColor.value);
}

function setTextColor(color, skipUpdate?) {
  let colorArr = Array.isArray(color) ? [...color] : color;
  if (typeof color == "string") {
    colorArr = color2array(color);
  }
  colorArr[3] = Math.max(0, Math.min(1, (textOpacity.value ?? 100) / 100));

  const hex = array2hex(colorArr);

  if (piniaSelect().selShpFormat?.type == "input") {
    updateShapeStyle(piniaSelect().selShpFormat?.id, {
      fill: { hex },
    });
    saveDexie();
    return;
  }

  console.log(colorArr, hex)

  applyTextFillStyle(
    {
      "--clr": hex,
    },
    undefined,
    skipUpdate,
  );
}

function updateShapeStyle(id, newStyle) {
  const shp = getShapeDeep(id);
  shp.style = {
    ...shp.style,
    ...newStyle,
  };
  updateShape(shp);
  saveDexie();
}

function setGradient(val) {
  const grad = genFillGradient(val, getTheme())
  applyTextFillStyle(
    {
      "--grad": grad,
      "--img": undefined,
      // "background-image": grad,
      "--clr": "transparent",
    },
    undefined,
    false,
  );
  saveDexie();
}

async function setTextImage(image?) {
  let target = image;
  if (!target) {
    const mediaColl = await getAllMediaPics(getFileInfo()?.id);
    target = mediaColl?.[0]?.name || "image1.png";
  }
  applyTextFillStyle(
    {
      "--img": "url('" + getBaseHref(getFileInfo().id) + "media/" + target +"')",
      "--grad": undefined,
      // "background-image": "url(" + getBaseHref(getFileInfo().id) + "media/" + img +")",
      "--clr": "transparent",
    },
    undefined,
    false,
  );
  saveDexie();
}

async function pasteTextImage(image) {
  if (!image) return;
  const name = `f${crc32(await image.arrayBuffer()).toString(16)}.webp`;
  const media = await processImage(image, { name });
  if (media?.name) setTextImage(media.name);
}

function applyTextFillStyle(style, unsetStyle?, skipUpdate = false) {
  const selected = piniaSelect().selShpFormat;
  const bounds = piniaSelect().selCells;
  if (selected?.type !== "table" || bounds?.length !== 4) {
    execEditorSurroundSpan(style, unsetStyle, skipUpdate);
    return;
  }

  const [minRow, maxRow, minCol, maxCol] = bounds.map(Number);
  const cellIds = [];
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      const cellId = `tbl:${selected.id}:${row}:${col}`;
      const cell = gid(cellId);
      const textbox = cell?.querySelector(".textbox");
      if (!textbox) continue;
      cellIds.push(cellId);
      const spans = Array.from(textbox.querySelectorAll("span")).filter(
        (span: HTMLElement) => !span.querySelector("span"),
      ) as HTMLElement[];
      const targets = spans.length ? spans : [textbox as HTMLElement];
      for (const target of targets) {
        for (const [key, value] of Object.entries(style || {})) {
          if (value == null) target.style.removeProperty(key);
          else target.style.setProperty(key, String(value));
        }
      }
    }
  }
  if (cellIds.length && !skipUpdate) {
    updateText(false, false, cellIds);
    saveDexie();
  }
}
</script>

<style scoped>
.subtitle {
  margin-top: 10px;
  margin-bottom: 5px;
  font-size: 14px;
  font-weight: bold;
}

.empty {
  padding-top: 20px;
}
.textcolor {
  padding: 0 20px;
}

/* .guide {
  font-size: 12px;
  color: #888;
} */
</style>
