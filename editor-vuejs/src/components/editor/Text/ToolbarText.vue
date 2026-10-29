<template>
  <div class="stack">
    <div class="row">
      <ToolbarItemDropdown
        :label="textInfo?.fontName"
        :options="fontNameOptions()"
        :on-click="prepareFontMenu"
        :scrollable="true"
        :use-pointer-up="true"
        :width="piniaResize().windowWidth < 800 ? '100px' : '140px'"
        height="26px"
        button-size="small"
        :disabled="disabled || !showTextItem"
      />

      <ToolbarIncrement
        label="⇦"
        :step="-1"
        :value="textInfo?.sz"
        :update="updateFontSize"
        v-if="piniaResize().windowWidth >= 800"
        :disabled
      />
      <div style="display: contents" @pointerdown.capture="saveFontSizeCaret">
        <ToolbarItemDropdown
          :label="textInfo?.sz"
          :use-input="true"
          :on-input-change="(val) => updateFontSize(val)"
          :options="fontSizeOptions()"
          button-type="default"
          :select-on-pointerdown="true"
          height="26px"
          button-size="small"
          :disabled
        />
      </div>
      <ToolbarIncrement
        label="⇨"
        :step="1"
        :value="textInfo?.sz"
        :update="updateFontSize"
        v-if="piniaResize().windowWidth >= 800"
        :disabled
      />
      <ToolbarItem type="divider" />
      <TextToolbarPara :disabled />
      <ToolbarItem
        quaternary
        :icon="Paragraph"
        :onClick="
          () => {
            toggleTaskPane('paraformat');
          }
        "
        :active="piniaInfo().currentTaskPane == 'paraformat'"
        tooltip="Paragraph"
        :disabled
      />
      <!-- <ToolbarItem
        quaternary
        :icon="TextEffects24Filled"
        :onClick="
          () => {
            toggleTaskPane('textfx');
          }
        "
        :active="piniaInfo().currentTaskPane == 'textfx'"
        tooltip="Text Effect"
        :extra-class="{ dropshadow: false }"
        :disabled
      /> -->
    </div>
    <div class="row">
      <!-- <ToolbarItem
        quaternary
        button-size="small"
        :icon="TextColor24Filled"
        :onClick="
          () => {
            toggleTaskPane('textcolor');
          }
        "
        :active="piniaInfo().currentTaskPane == 'textcolor'"
        :size="24"
        tooltip="Text Color"
        :color="array2hex(piniaSelect().editingInfo?.['color']) || 'black'"
        :extraClass="{ hilite: true }"
        :style="{
          marginLeft: '5px',
        }"
        :disabled
      /> -->
      <ToolbarItem
        quaternary
        v-for="item in textItems"
        :key="item.text || item.icon"
        :label="textItemsLabel(item)"
        :type="item.type"
        :title="item.title"
        :arg="item.arg"
        :active="pendingFormatActive(item) ?? !!textInfo?.[item.arg || item.alt]"
        :disabled="disabled || !!item.disabled"
        :icon="item.icon"
        :on-click="item.onClick"
        :hidden="item.hidden"
        button-size="small"
      />
      <ToolbarItem type="divider" />
      <TextToolbarPara2 :disabled />
      <ToolbarItem
        quaternary
        :icon="TextResize"
        :onClick="
          () => {
            toggleTaskPane('textboxoptions');
          }
        "
        :active="piniaInfo().currentTaskPane == 'textboxoptions'"
        tooltip="Textbox"
        :disabled
      />
    </div>
  </div>
</template>
<script setup lang="ts">
import { getTheme, getFileInfo, updateFile, updateEditingInfo, getShapeDeep, updateShape, getSelectEditingInfo, getSelectEditingPendingFormats, getSelectEditingTextObject, setSelectEditingPendingFormats } from "shared-vuejs/editor";

import { piniaInfo, piniaResize, piniaSelect } from "@/lib/common/store";
import { execEditorSurroundSpan } from "shared-vuejs/api/execCommand";
import {
  getSelNode,
  resizeTextbox,
} from "shared-vuejs/api/updateText";
import {
  getSelectionOffsets,
  restoreSelectionOffsets,
} from "shared-vuejs/api/normalizeText";
import { TextColor24Filled, TextEffects24Filled } from "@vicons/fluent";
import {
  getStyle,
  gid,
  round3,
  nodeAsArray,
} from "shared-vuejs/api/utility";
import { array2hex } from "shared-vuejs/api/colorUtils";
import { toggleTaskPane } from "@/lib/main/utils";
import { computed } from "vue";
import { createFontNameMenu, themeFontFamilies } from "./fontNameMenu";
import { loadCustomFont, loadGoogleFont } from "shared-vuejs/api/slideUtils";
import { getBaseHref } from "shared-vuejs/api/get-file";
import { textToolbarOptions } from "./ToolbarTextOptions";
import ToolbarItem from "../Toolbars/ToolbarItem.vue";
import ToolbarIncrement from "../Toolbars/ToolbarIncrement.vue";
import ToolbarItemDropdown from "../Toolbars/ToolbarItemDropdown.vue";
import { saveDexie } from "shared-vuejs/api/dbutils";
import TextToolbarPara from "./TextToolbarPara.vue";

import TextToolbarPara2 from "./TextToolbarPara2.vue";
import { TextResize } from "@vicons/tabler";
import { Paragraph } from "@vicons/carbon";

defineProps({
  disabled: Boolean,
});

let savedFontSizeCaret: { shapeId: string; offsets: any } | null = null;

function saveFontSizeCaret() {
  const shapeId = getSelectEditingTextObject();
  const editor = shapeId && gid(shapeId)?.querySelector<HTMLElement>(".textbox");
  const offsets = editor && getSelectionOffsets(editor);
  savedFontSizeCaret = offsets ? { shapeId, offsets } : null;
}

function restoreFontSizeCaret() {
  if (!savedFontSizeCaret) return;
  const { shapeId, offsets } = savedFontSizeCaret;
  savedFontSizeCaret = null;
  const editor = gid(shapeId)?.querySelector<HTMLElement>(".textbox");
  if (!editor) return;
  editor.focus({ preventScroll: true });
  restoreSelectionOffsets(editor, offsets);
}

// map textObjects for toolbar
const textItems = computed(() =>
  textToolbarOptions.map((opt) => ({
    ...opt,
    hidden: piniaResize().windowWidth < 800,
  })),
);

const showTextItem = computed(() => {
  return (
    (piniaSelect().selShpFormat?.txBody ||
      piniaSelect().selShpFormat?.type == "table" ||
      piniaSelect().selShpFormat?.children) &&
    piniaSelect().selShpFormat?.$_otag !== "pic" &&
    piniaSelect().selShpFormat?.ph?.$_type !== "pic" &&
    piniaSelect().editingPoint == -1 &&
    !piniaInfo().useGrid
  );
});

const textInfo = computed(() => {
  if (piniaSelect().editingInfo) {
    const pendingSize = piniaSelect().editingPendingFormats?.["--sz"];
    return {
      ...piniaSelect().editingInfo,
      sz: pendingSize ?? piniaSelect().editingInfo.sz,
      fontName:
        piniaSelect().editingPendingFormats?.["font-family"] ||
        piniaSelect().editingInfo.fontName,
    };
  } else if (
    piniaSelect().selShpFormat?.txBody ||
    piniaSelect().selShpFormat?.style
  ) {
    const paras = nodeAsArray(piniaSelect().selShpFormat?.txBody?.p);
    let runs0;
    if (paras?.[0]) {
      runs0 = nodeAsArray(paras[0].r)?.[0];
    }

    return {
      sz: round3(
        runs0?.rPr?.$_sz / 100 ||
          piniaSelect().selShpFormat?.txBody?.bodyPr?.defRPr?.$_sz / 100 ||
          18,
      ),
      fontName:
        runs0?.rPr?.latin?.$_typeface ||
        piniaSelect().selShpFormat?.txBody?.bodyPr?.defRPr?.latin?.$_typeface ||
        "Carlito",
      italic:
        runs0?.rPr?.$_i ??
        piniaSelect().selShpFormat?.txBody?.bodyPr?.defRPr?.$_i,
      bold:
        runs0?.rPr?.$_b ??
        piniaSelect().selShpFormat?.txBody?.bodyPr?.defRPr?.$_b,
      underline:
        (runs0?.rPr?.$_u ??
          piniaSelect().selShpFormat?.txBody?.bodyPr?.defRPr?.$_u) == "sng",
    };
  } else if (piniaSelect().selShpFormat?.type == "input") {
    return (
      piniaSelect().selShpFormat?.style || {
        sz: 18,
        fontName: "Carlito",
      }
    );
  } else {
    return {
      sz: 18,
      fontName: "Carlito",
    };
  }
});

function pendingFormatActive(item: any) {
  const pending = piniaSelect().editingPendingFormats;
  if (!pending) return null;

  const keyByFormat = {
    bold: "font-weight",
    italic: "font-style",
    underline: "text-decoration",
    sub: "--baseline",
    super: "--baseline",
  };
  const key = keyByFormat[item.arg || item.alt];
  if (!key || !Object.prototype.hasOwnProperty.call(pending, key)) return null;

  const value = pending[key];
  switch (item.arg || item.alt) {
    case "bold":
      return value === "bold" || Number(value) >= 700;
    case "italic":
      return value === "italic";
    case "underline":
      return value === "underline";
    case "sub":
      return Number(value) < 0;
    case "super":
      return Number(value) > 0;
    default:
      return null;
  }
}

function fontSizeOptions() {
  const fontSizes = [
    8, 10, 12, 14, 16, 18, 21, 24, 28, 32, 36, 42, 56, 64, 72, 80, 88, 96, 104,
    120, 144,
  ];
  return fontSizes.map((f) => ({
    value: f,
    label: String(f),
    key: f,
    onClick: (e) => {
      updateFontSize(f);
      e.preventDefault();
    },
  }));
}

const fontMenu = createFontNameMenu({
  getFonts: () => getFileInfo()?.fonts || [],
  getThemeFonts: () => themeFontFamilies(getTheme()),
  applyFont: updateFontFamily,
  loadUploadedFont: font => {
    const file = getFileInfo();
    if (file?.id) loadCustomFont(font, getBaseHref(file.id));
  },
  loadGoogleFont: family => {
    const file = getFileInfo();
    if (!file) return;
    loadGoogleFont([family]);
    const fonts = file.fonts || [];
    if (!fonts.some(font => font.family === family && font.type === "google")) {
      updateFile({ fonts: [...fonts, { family, type: "google" }] });
      saveDexie();
    }
  },
  openPanel: toggleTaskPane,
});

function prepareFontMenu() {
  saveFontSizeCaret();
}

function fontNameOptions() {
  return fontMenu.options();
}

function updateFontFamily(font: string) {
  restoreFontSizeCaret();
  const selection = window.getSelection();
  if (getSelectEditingInfo()) {
    updateEditingInfo({ fontName: font });
    if (!selection || selection.isCollapsed) {
      setSelectEditingPendingFormats({
        ...getSelectEditingPendingFormats(),
        "font-family": font,
      });
      updateEditingInfo({ fontName: font });
      return;
    }
  } else if (piniaSelect().selShpFormat?.type === "input") {
    updateShapeStyle(piniaSelect().selShpFormat.id, { "font-family": font });
    return;
  }

  execEditorSurroundSpan({ "font-family": font });
  // As with font-size changes, refresh the selected shape after tokenizing
  // the formatted DOM. This also updates the toolbar without a text selection.
  const textBox = gid(piniaSelect().selShpFormat?.id)?.querySelector<HTMLElement>(".textbox");
  if (textBox) {
    textBox.style.height = "auto";
    resizeTextbox(piniaSelect().selShpFormat);
  }
  saveDexie();
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

function updateFontSize(f, props?) {
  restoreFontSizeCaret();
  if (piniaSelect().selShpFormat?.type == "input") {
    updateShapeStyle(piniaSelect().selShpFormat?.id, {
      "--sz": f,
    });
    return;
  }

  const selection = window.getSelection();
  if (getSelectEditingInfo() && (!selection || selection.isCollapsed)) {
    const selectedNode = getSelNode();
    const styleNode = selectedNode || (selection?.anchorNode?.nodeType === Node.TEXT_NODE
      ? selection.anchorNode.parentElement
      : selection?.anchorNode as Element | null);
    const fontScale = styleNode
      ? parseFloat(getComputedStyle(styleNode).getPropertyValue("--fnt-scl")) || 1
      : 1;
    const pendingSize = round3(Number(f) / fontScale);
    const editingTextObject = getSelectEditingTextObject();
    updateEditingInfo({ sz: Number(f) });
    // The iframe commits on blur/Enter. Refocusing the slide can run its
    // pointer handlers after this callback and clear pending formats, so
    // apply the new caret format after that focus-return sequence completes.
    setTimeout(() => {
      if (getSelectEditingTextObject() !== editingTextObject) return;
      setSelectEditingPendingFormats({
        ...getSelectEditingPendingFormats(),
        "--fnt-scl": 1,
        "--sz": pendingSize,
      });
    }, 0);
    return;
  }

  const selNode = getSelNode();
  if (selNode) {
    const computedStyle = getComputedStyle(selNode);
    const fontScale: any = computedStyle.getPropertyValue("--fnt-scl") || 1;
    if (piniaSelect().editingInfo) {
      updateEditingInfo({ sz: f });
    }
    execEditorSurroundSpan({
      "--fnt-scl": 1,
      "--sz": round3(f / fontScale),
    });
  } else {
    if (!f) {
      const firstEl = gid(piniaSelect().selShpFormat?.id).querySelector(
        ".textbox span",
      );
      let step = 1;
      if (props?.label == "-") {
        step = -1;
      }
      f = parseInt(getStyle(firstEl, "font-size"), 10) + step;
    }
    execEditorSurroundSpan({
      "--fnt-scl": 1,
      "--sz": round3(f),
    });
  }
  const textBox = gid(piniaSelect().selShpFormat?.id).querySelector(".textbox");
  if (textBox) {
    textBox.style.height = "auto";
    resizeTextbox(piniaSelect().selShpFormat);
    saveDexie();
  }
  piniaInfo().setCurPopup("");
}

function textItemsLabel(item) {
  if (item.formatKey) {
    return parseInt(piniaSelect().editingInfo?.[item.formatKey]) || item.label;
  }
}
</script>
<style>
.hilite .n-button__icon i svg {
  /* if content is white, hard to see, to hilite it */
  filter: drop-shadow(0.5px 0.5px 1px #aaa);
}

.dropshadow .n-button__icon i svg {
  filter: drop-shadow(2px 2px 2px #888);
}
</style>
<style scoped>
.stack {
  display: inline-flex;
  flex-direction: column;
}

.row {
  display: flex;
  height: 30px;
  align-items: center;
}
</style>
