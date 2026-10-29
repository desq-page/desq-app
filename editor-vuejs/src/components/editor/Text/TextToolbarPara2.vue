<template>
  <div :class="$style.sgToolbar">
    <ToolbarItem
      v-for="item in alignParas"
      :key="item.icon"
      :title="item.title"
      :icon="item.icon"
      :active="
        piniaSelect().editingInfo?.[item.activeProp] == item.arg ||
        (!piniaSelect().editingInfo && getTextAlgn() == item.arg)
      "
      :onClick="item.onClick"
      :disabled="disabled"
      buttonSize="small"
      quaternary
    />
    <ToolbarItem type="divider" v-if="showDivider" />
  </div>
  <div :class="$style.sgToolbar">
    <ToolbarItemDropdown 
      quaternary
      :icon="getVAlignIcon()"
      :options="vAligns"
      :size="26"
      :tooltipDelay="1000"
      :disabled
      :checkOptSelected="(arg) => getActiveVAlign() == arg"
      usePointerUp
    />
  </div>
</template>

<script setup>
import { getShapeDeep, updateShape, getSelectEditingTextObject } from "shared-vuejs/editor";

import ToolbarItem from "../Toolbars/ToolbarItem.vue";
// import ToolbarItemCycle from "../Toolbars/ToolbarItemCycle.vue";

import { piniaSelect } from "@/lib/common/store";
import { useCssModule } from "vue";
import {
  FormatIndentDecreaseFilled,
  FormatIndentIncreaseFilled,
  FormatListBulletedFilled,
  FormatListNumberedFilled,
} from "@vicons/material";
import {
  TextAlignCenter20Filled,
  TextAlignJustify20Filled,
  TextAlignLeft20Filled,
  TextAlignRight20Filled,
  TextboxAlignBottom24Regular,
  TextboxAlignMiddle24Regular,
  TextboxAlignTop24Regular,
} from "@vicons/fluent";
import { getSelectedNodes, getSelectedParas } from "shared-vuejs/api/textSelection";
import { updateBuNums, updateText } from "shared-vuejs/api/updateText";
import { getActiveParagraph, normalizeActiveParagraph } from "shared-vuejs/api/normalizeText";
// import { setAlign } from "shared-vuejs/src/edlib/text/text";
import { gid, nodeAsArray } from "shared-vuejs/api/utility";
import { setLinkedParagraphAlignment } from "shared-vuejs/api/editor-text-layout";
import { executeModelEditorCommand } from "shared-vuejs/api/modelTextInput";
import { getTableColRow } from "../Toolbars/ToolbarUtils.js";
import { saveDexie } from "shared-vuejs/api/dbutils";
import { genBuNum } from "shared-vuejs/api/buNum";
import g from "shared-vuejs/api/global.js";
import ToolbarItemDropdown from "../Toolbars/ToolbarItemDropdown.vue";


defineProps({
  disabled: Boolean,
  showDivider: Boolean,
});

const alignParas = [
  {
    title: "Align paragraph left",
    icon: TextAlignLeft20Filled,
    onClick: (e) => setJustify(e, "l"),
    activeProp: "algn",
    arg: "l",
  },
  {
    title: "Align paragraph center",
    icon: TextAlignCenter20Filled,
    onClick: (e) => setJustify(e, "ctr"),
    activeProp: "algn",
    arg: "ctr",
  },
  {
    title: "Align paragraph right",
    icon: TextAlignRight20Filled,
    onClick: (e) => setJustify(e, "r"),
    activeProp: "algn",
    arg: "r",
  },
  {
    title: "Align paragraph justify full",
    icon: TextAlignJustify20Filled,
    onClick: (e) => setJustify(e, "just"),
    activeProp: "algn",
    arg: "just",
  },
];

const vAligns = [
  {
    title: "Align top",
    icon: TextboxAlignTop24Regular,
    onClick: (e) => setParaValign(e, "t"),
    activeProp: "anchor",
    arg: "t",
    key: 'vtop',
  },
  {
    title: "Align middle",
    icon: TextboxAlignMiddle24Regular,
    onClick: (e) => setParaValign(e, "ctr"),
    activeProp: "anchor",
    arg: "ctr",
    key: 'vctr',
  },

  {
    title: "Align bottom",
    icon: TextboxAlignBottom24Regular,
    onClick: (e) => setParaValign(e, "b"),
    activeProp: "anchor",
    arg: "b",
    key: 'vbtm',
  },
];

function getVAlignIcon() {
  const vAlign = getActiveVAlign()
  switch (vAlign) {
    case "b":
      return TextboxAlignBottom24Regular
    case "ctr":
      return TextboxAlignMiddle24Regular
    default:
      return TextboxAlignTop24Regular
      
  }
}

function getActiveVAlign() {
  return (
    piniaSelect().editingInfo?.["anchor"] ||
    piniaSelect().selShpFormat?.txBody?.bodyPr?.$_anchor ||
    "t"
  );
}

function getTextAlgn() {
  const shp = piniaSelect().selShpFormat;
  const txBody = shp?.txBody;
  const firstPara = nodeAsArray(txBody?.p)[0];
  return firstPara?.pPr?.$_algn ?? txBody?.bodyPr?.$_algn ??
    (txBody?.bodyPr?.$_anchorCtr || shp?.ph === "ctrTitle" || shp?.ph?.$_type === "ctrTitle" ? "ctr" : "l");
}

function setJustify(e, arg) {
  const command = { l: "justifyleft", ctr: "justifycenter", r: "justifyright", just: "justifyfull" }[arg];
  if (command && executeModelEditorCommand(command)) {
    if (piniaSelect().editingInfo) piniaSelect().editingInfo["algn"] = arg;
    return;
  }
  let nodes = getSelectedNodes() || [];
  let hasTightWrap = false;
  if ((!nodes || nodes.length == 0) && piniaSelect().selShpFormat) {
    piniaSelect().selShps.forEach((selShp) => {
      const selecteEditor = gid(selShp)?.querySelector(".textbox");
      nodes = [...nodes, ...Array.from(selecteEditor?.querySelectorAll("p") || [])];
    });
  }
  const seenParagraphs = new Set();
  nodes.forEach((focusNode) => {
    if (focusNode) {
      if (focusNode.nodeType == 3) {
        focusNode = focusNode.parentNode;
      }
      const paraNode = focusNode.closest("p");
      if (paraNode && !seenParagraphs.has(paraNode)) {
        seenParagraphs.add(paraNode);
        hasTightWrap ||= !!paraNode.closest(".textbox.tightwrap");
        ["p-l", "p-r", "p-ctr", "p-just", "p-dist"].forEach((cls) =>
          paraNode.classList.remove(cls),
        );
        paraNode.classList.add("p-" + arg);
        paraNode.dataset["algn"] = arg;
        const shapeId = paraNode.closest(".shp")?.id;
        if (shapeId && paraNode.id) setLinkedParagraphAlignment(shapeId, paraNode.id, arg);
        if (piniaSelect().editingInfo) {
          piniaSelect().editingInfo["algn"] = arg;
        }
      }
    }
  });
  if (hasTightWrap && getActiveParagraph()?.closest(".textbox.tightwrap")) {
    normalizeActiveParagraph();
    updateText(false);
  } else {
    updateText(hasTightWrap && !piniaSelect().editingInfo);
  }
}

function setParaValign(e, arg) {
  if (piniaSelect().selShpFormat?.type == "table") {
    // need to find current row column
    const { rIdx, cIdx } = getTableColRow();
    const tableInfo = getShapeDeep(piniaSelect().selShpFormat?.id);
    tableInfo.graphic.graphicData.tbl.tr[rIdx].tc[cIdx].tcPr.$_anchor = arg;
    updateShape(tableInfo, undefined, true);
    saveDexie();

    // update local
    const editObject = gid(getSelectEditingTextObject()).querySelector(".textbox");
    editObject.classList.forEach(cls => {
      if (cls.startsWith('tx-')) {
        editObject.classList.remove(cls);
      }
    })
    editObject.classList.add("tx-" + arg);
  } else {
    const selecteEditor = gid(piniaSelect().selShpFormat?.id)?.querySelector(
      ".textbox",
    );
    if (!selecteEditor) return;
    selecteEditor.classList.remove("tx-ctr", "tx-t", "tx-b");
    selecteEditor.classList.add("tx-" + arg);
    if (piniaSelect().editingInfo) {
      piniaSelect().editingInfo = {
        ...piniaSelect().editingInfo,
        anchor: arg,
      };
    }
    const hasTightWrap = selecteEditor.classList.contains("tightwrap");
    if (hasTightWrap && getActiveParagraph()?.closest(".textbox") === selecteEditor) {
      normalizeActiveParagraph();
      updateText(false);
    } else {
      updateText(hasTightWrap && !piniaSelect().editingInfo);
    }
  }
}

const $style = useCssModule();
</script>

<style module>
.sgToolbar {
  display: flex;
}
</style>
