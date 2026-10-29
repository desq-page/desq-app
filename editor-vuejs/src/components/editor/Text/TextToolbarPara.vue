<template>
  <div :class="$style.sgToolbar">
    <ToolbarItem
      v-for="item in textBullets"
      :key="item.icon"
      :title="item.title"
      :icon="item.icon"
      :active="isBulletActive(item.activeProp)"
      :onClick="item.onClick"
      :disabled="disabled"
      buttonSize="small"
      quaternary
    />
  </div>
</template>

<script setup>
import ToolbarItem from "../Toolbars/ToolbarItem.vue";
// import ToolbarItemCycle from "../Toolbars/ToolbarItemCycle.vue";

import { piniaSelect, piniaShapes } from "@/lib/common/store";
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
import { normalizeFormattedTextboxes } from "shared-vuejs/api/normalizeText";
// import { setAlign } from "shared-vuejs/src/edlib/text/text";
import { gid, nodeAsArray } from "shared-vuejs/api/utility";
import { getTableColRow } from "../Toolbars/ToolbarUtils";
import { saveDexie } from "shared-vuejs/api/dbutils";
import { genBuNum } from "shared-vuejs/api/buNum";

defineProps({
  disabled: Boolean,
});

const textBullets = [
  {
    title: "Numbering",
    icon: FormatListNumberedFilled,
    onClick: (e) => applyBullet(e, "num"),
    activeProp: "buAutoNum",
  },
  {
    title: "Bullets",
    icon: FormatListBulletedFilled,
    onClick: (e) => applyBullet(e, ""),
    activeProp: "buChar",
  },
  {
    title: "Outdent text",
    icon: FormatIndentDecreaseFilled,
    onClick: (e) => outdentPara(e, "num"),
  },
  {
    title: "Indent text",
    icon: FormatIndentIncreaseFilled,
    onClick: (e) => indentPara(e, "num"),
  },
];

function isBulletActive(activeProp) {
  if (piniaSelect().editingInfo) {
    return !!piniaSelect().editingInfo?.[activeProp];
  } else {
    const paras = nodeAsArray(piniaSelect().selShpFormat?.txBody?.p);
    const lvlStyle = piniaSelect().selShpFormat?.txBody?.bodyPr?.lstStyle?.lvl1PPr
    return (
      (paras?.[0]?.pPr?.[activeProp] && !paras?.[0]?.pPr?.buNone) ||
      (lvlStyle?.[activeProp] && !lvlStyle?.buNone)
    );
  }
}

function applyBullet(e, arg) {
  const paras = getSelectedParas();
  const tightWrapBoxes = [...new Set(
    paras
      .map((pNode) => pNode?.closest(".textbox.tightwrap"))
      .filter(Boolean),
  )];

  paras.forEach((pNode, pidx) => {
    if (pNode) {
      let toRemove = false;
      let indent = 32;
      if (pNode.classList.contains("p-bu")) {
        if (arg == "num" && !pNode.classList.contains("p-bu-num")) {
          // switch to num
          indent *= 1.5;
          pNode.classList.add("p-bu-num");
          pNode.setAttribute("data-bu-type", "arabicPeriod");
          pNode.setAttribute("data-bu", genBuNum("", pidx + 1));
        } else if (
          (arg == "num" && pNode.classList.contains("p-bu-num")) ||
          (arg !== "num" && !pNode.classList.contains("p-bu-num"))
        ) {
          // remove all
          pNode.classList.remove("p-bu");
          pNode.classList.remove("p-bu-num");
          // Persist the explicit opt-out so inherited tightWrap/list-style
          // bullets do not reappear on the next render.
          pNode.dataset.buNone = "1";
          // pNode.style.paddingLeft = 0;

          toRemove = true;
        } else if (pNode.classList.contains("p-bu-num")) {
          pNode.classList.remove("p-bu-num");
          pNode.setAttribute("data-bu", "•");
        }
      } else {
        delete pNode.dataset.buNone;
        pNode.classList.add("p-bu");
        if (arg == "num") {
          pNode.classList.add("p-bu-num");
          indent *= 1.5;
          pNode.setAttribute("data-bu-type", "arabicPeriod");
          pNode.setAttribute("data-bu", genBuNum("", pidx + 1));
        } else {
          pNode.setAttribute("data-bu", "•");
        }
      }
      if (!toRemove) {
        const existingIndent = pNode.getAttribute("data-indent") ??
          pNode.style.getPropertyValue("--indent");
        if (!Number(existingIndent)) {
          // pNode.style.setProperty("--bu-mar-l", `-${indent}rem`);
          // pNode.style.paddingLeft = `${indent}rem`;
          pNode.setAttribute("data-indent", `-${indent}`);
          pNode.setAttribute("data-mar-l", `${indent}`);
          // Tight-wrap saves its inline paragraph properties as well as the
          // datasets. Keep them aligned so an old zero cannot erase the indent.
          pNode.style.setProperty("--indent", `${-indent}`);
          pNode.style.setProperty("--mar-l", `${indent}`);
        }
      } else {
        pNode.removeAttribute("data-indent");
        pNode.removeAttribute("data-mar-l");
        pNode.style.setProperty("--indent", "0");
        pNode.style.setProperty("--mar-l", "0");
        // pNode.style.removeProperty("--bu-mar-l");
      }
    }
  });

  updateBuNums();
  updateText(false);
  // updateText saves the new bullet/buNone state; now re-render tightWrap so
  // its positioned rows reflect the paragraph's updated bullet margin.
  if (tightWrapBoxes.length) normalizeFormattedTextboxes(tightWrapBoxes);

  e.preventDefault();
}

function indentPara() {
  const paras = getSelectedParas();
  paras.forEach((pNode) => {
    if (pNode) {
      const lvl = parseInt(pNode.dataset["lvl"] || 0);
      pNode.dataset["lvl"] = lvl + 1;
      pNode.style.setProperty(
        "--mar-l",
        parseInt(pNode.style.getPropertyValue("--mar-l") || 18) + 48,
      );
    }
  });
  updateText(false);
}

function outdentPara() {
  const paras = getSelectedParas();
  paras.forEach((pNode) => {
    if (pNode) {
      const lvl = parseInt(pNode.dataset["lvl"] || 0);
      if (lvl >= 1) {
        pNode.dataset["lvl"] = lvl - 1;
      } else if (lvl <= 0) {
        pNode.removeAttribute("data-lvl");
      } else {
        pNode.classList.remove("p-bu");
      }
      pNode.style.setProperty(
        "--mar-l",
        Math.max(0, (+pNode.style.getPropertyValue("--mar-l") || 18) - 48),
      );
    }
  });
  updateText(false);
}

const $style = useCssModule();
</script>

<style module>
.sgToolbar {
  display: flex;
}
</style>
