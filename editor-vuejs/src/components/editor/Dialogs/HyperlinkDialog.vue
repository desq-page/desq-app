<template>
  <!-- <SelectionToolbar /> -->
  <DialogBase
    title="Link"
    :backLink="piniaInfo().lastTaskPane || 'animations'"
    :icon="TouchAppOutlined"
    :is-empty="!piniaSelect().selShpFormat"
  >
    <LayoutHeader
      :label="`Selected ${piniaSelect().editingInfo ? 'Text' : 'Shape'}`"
    >
      <template #extra>
        <ToolbarItem
          quaternary
          button-type="primary"
          button-size="small"
          label="Select Shape"
          @click="() => hideEditor()"
          v-if="piniaSelect().editingInfo"
          bordered
        />
      </template>
    </LayoutHeader>
    <div class="text-name">
      <!-- <ToolbarItem
        v-if="!piniaSelect().editingInfo"
        :shp="{
          ...piniaSelect().selShpFormat,
          d: 'FR0,0,24,24',
          w: 24,
          h: 24,
          l: null,
          v: null,
          id: 'fillshp-tb',
        }"
        :size="20"
        :style="{
          marginLeft: '-10px',
          marginRight: '-10px',
        }"
      /> -->
      <div v-if="piniaSelect().editingInfo" class="selected-text">
        <span
          v-if="piniaSelect().editingInfo.selectionText"
          v-html="`“${piniaSelect().editingInfo.selectionText}”`"
          :style="{
            fontStyle: 'italic',
          }"
        ></span>
        <span
          v-else
          :style="{
            fontSize: '12px',
            margin: '10px 0',
            color: 'red',
          }"
          v-html="
            `(Highlight some text or select shape to edit link.)`
          "
        />
      </div>
      <div v-else v-html="piniaSelect().selShpFormat?.name" />
      <ToolbarItem
        quaternary
        button-type="primary"
        button-size="small"
        label="Rename..."
        @click="() => toggleTaskPane('shapeoptions')"
        v-if="!piniaSelect().editingInfo"
        bordered
      />
    </div>
    <!-- <template v-if="piniaSelect().editingInfo?.selectionText">
      <LayoutHeader label="Dynamic Text Display" />
      <label>Selected text will be replaced with:</label>
      <IframeInputbox
        :value="piniaSelect().editingInfo?.formula || ''"
        :on-change="updateFormula"
        :style="{
          width: '300px',
          height: '64px',
          border: '1px solid #ccc',
        }"
        :input-attr="{
          style: 'text-align: left; height: 64px; padding: 0 10px;',
          placeholder: 'Enter formula (press ENTER to save).',
        }"
        :disabled="
          piniaSelect().editingInfo &&
          piniaSelect().editingInfo.selectionText == ''
        "
      />
    </template> -->
    <!-- <template v-if="piniaSelect().selShpFormat?.blipFill">
      <LayoutHeader label="Dynamic Image Source" />
      <label>Image source will be swapped with:</label>
      <IframeInputbox
        :value="piniaSelect().selShpFormat?.blipFill.link"
        :on-change="updateImageSrcLink"
        :style="{
          width: '300px',
          height: '64px',
          border: '1px solid #ccc',
        }"
        :input-attr="{
          style: 'text-align: left; height: 64px; padding: 0 10px;',
          placeholder: 'Enter formula (press ENTER to save).',
        }"
      />
    </template> -->
    <template v-if="piniaSelect().selShpFormat?.type == 'input'">
      <LayoutHeader label="Input Type" />
      <select
        @change="(e) => updateField(e, 'inputType')"
        :value="piniaSelect().selShpFormat?.inputType"
      >
        <option value="">Text</option>
        <option value="select">Select Box</option>
        <option value="number">Number</option>
        <option value="text">Textarea</option>
        <option value="search">Search</option>
        <option value="password">Password</option>
        <option value="email">Email</option>
        <option value="url">URL</option>
        <option value="date">Date</option>
        <option value="color">Color</option>
        <option value="range">Range</option>
      </select>
    </template>
    <template v-if="piniaSelect().selShpFormat?.type == 'chart'">
      <LayoutHeader label="Chart Type" />
      <select
        @change="(e) => changeChartType((e.target as HTMLSelectElement)?.value)"
        :value="
          piniaSelect().selShpFormat?.chartData?.series?.[0]?.type || 'bar'
        "
      >
        <option value="bar">Bar</option>
        <option value="pie">Pie</option>
        <option value="line">Line</option>
      </select>
    </template>
    <template
      v-if="
        !piniaSelect().editingInfo &&
        (piniaSelect().selShpFormat?.type == 'table' ||
          piniaSelect().selShpFormat?.type == 'chart' ||
          (piniaSelect().selShpFormat?.type == 'input' &&
            piniaSelect().selShpFormat?.inputType == 'select') ||
          (piniaSelect().selShpFormat?.children &&
            piniaSelect().selShpFormat?.container))
      "
    >
      <LayoutHeader
        :label="`Source Data (${piniaSelect().selShpFormat?.type == 'input' ? 'Select Box Popup' : piniaSelect().selShpFormat?.type == 'table' ? 'Repeated Table Rows' : piniaSelect().selShpFormat?.type == 'group' ? 'Container' : 'Chart Series'})`"
      />
      <NFlex>
        <input
          v-model="datasource"
          @keydown.stop
          @change="updateDatasource"
          placeholder="Enter an array"
        />
        <ToolbarItem
          :icon="DataUsageEdit24Regular"
          v-if="piniaSelect().selShpFormat?.type == 'chart'"
          @click="openRevogrid"
        />
      </NFlex>
    </template>
    <!-- <template v-if="!piniaSelect().editingInfo">
      <LayoutHeader label="Shape Display Condition" />
      <div class="field-info">
        <span>Hidden When:</span>
        <IframeInputbox
          :value="piniaSelect().selShpFormat?.hideIf"
          :on-change="(val) => updateField(val, 'hideIf')"
          :style="{
            width: '150px',
            height: '26px',
            border: '1px solid #ccc',
          }"
          :input-attr="{
            style:
              'text-align: left; height: 26px; line-height: 26px; padding: 0 10px; white-space: nowrap; overflow: hidden;',
            placeholder: 'Enter formula',
          }"
        />
      </div>
      <div class="field-info">
        <span>Disabled When:</span>
        <IframeInputbox
          :value="piniaSelect().selShpFormat?.disableIf"
          :on-change="(val) => updateField(val, 'disableIf')"
          :style="{
            width: '150px',
            height: '26px',
            border: '1px solid #ccc',
          }"
          :input-attr="{
            style:
              'text-align: left; height: 26px; line-height: 26px; padding: 0 10px; white-space: nowrap; overflow: hidden;',
            placeholder: 'Enter formula',
          }"
        />
      </div>
    </template> -->
    <template
      v-if="
        piniaSelect().editingInfo ||
        (piniaSelect().selShpFormat?.type !== 'table' &&
          piniaSelect().selShpFormat?.type !== 'chart')
      "
    >
      <LayoutHeader
        :label="`Link Action (${piniaSelect().editingInfo ? 'hyperlink on text' : 'click on shape'})`"
      />
      <NFlex vertical>
        <NFlex align="center" :wrap="false" :size="4">
          <input
            class="custom"
            id="chkHlinkAction1"
            name="hyperlinkType"
            type="radio"
            :checked="noneSelected"
            @click="(edit) => updateHyperlink('')"
          />
          <label for="chkHlinkAction1">None</label>
        </NFlex>
        <NFlex align="center" :wrap="false" :size="4">
          <input
            class="custom"
            id="chkHlinkAction2"
            name="hyperlinkType"
            type="radio"
            :checked="!!gotoSlide && !hyperlink && !varValue && !addonFunc"
            :disabled="
              piniaSelect().editingInfo &&
              piniaSelect().editingInfo.selectionText == ''
            "
          /><label for="chkHlinkAction2">Page</label>

          <n-select
            :value="gotoSlide"
            :options="gotoSlideOptions"
            :on-update-value="updateGotoSlide"
            :disabled="
              piniaSelect().editingInfo &&
              piniaSelect().editingInfo.selectionText == ''
            "
            :render-label="(option) => renderSlide(option)"
          />
        </NFlex>

        <NFlex align="center" :wrap="false" :size="4">
          <input
            class="custom"
            id="chkHlinkAction6"
            name="hyperlinkType"
            type="radio"
            :checked="!!hyperlink && !gotoSlide && !varValue && !addonFunc"
            :disabled="
              piniaSelect().editingInfo &&
              piniaSelect().editingInfo.selectionText == ''
            "
          /><label for="chkHlinkAction6">URL</label>

          <IframeInputbox
            :value="hyperlink"
            :on-change="updateHyperlink"
            :style="{
              width: '205px',
              height: '34px',
              border: '1px solid #ccc',
            }"
            :input-attr="{
              style:
                'text-align: left; height: 34px; line-height: 34px; padding: 0 10px; white-space: nowrap; overflow: hidden;',
              placeholder: 'enter URL',
            }"
            :disabled="
              piniaSelect().editingInfo &&
              piniaSelect().editingInfo.selectionText == ''
            "
          />
          <ToolbarItem
            :icon="Open24Regular"
            :disabled="!hyperlink"
            @click="openURL"
          />
        </NFlex>
        <!-- <NFlex align="center" :wrap="false" :size="4">
          <input
            class="custom"
            id="chkHlinkAction3"
            name="hyperlinkType"
            type="radio"
            :checked="!gotoSlide && !hyperlink && !!varValue && !addonFunc"
            :disabled="
              piniaSelect().editingInfo &&
              piniaSelect().editingInfo.selectionText == ''
            "
          /><label for="chkHlinkAction3">Run</label>
        </NFlex>
        <IframeInputbox
          :value="varValue"
          :on-change="updateVariable"
          :style="{
            width: '300px',
            height: '160px',
            border: '1px solid #ccc',
          }"
          :input-attr="{
            style: 'text-align: left; height: 160px; padding: 0 10px;',
            placeholder: 'Enter formula (press ENTER to save)',
          }"
          :disabled="
            piniaSelect().editingInfo &&
            piniaSelect().editingInfo.selectionText == ''
          "
        />
        <ToolbarItem
          :icon="Lightning"
          quaternary
          button-type="primary"
          label="Trigger Animation..."
          @click="() => toggleTaskPane('animations')"
          bordered
          v-if="!piniaSelect().editingInfo"
        />
        <ToolbarItem
          :icon="MathFormula24Regular"
          quaternary
          button-type="primary"
          label="Formula Reference..."
          @click="() => (piniaInfo().openFormulaRef = true)"
          bordered
        />-->
      </NFlex> 
    </template>
  </DialogBase>
</template>

<script setup lang="ts">
import { getShapeDeep, updateShape, getFileInfo } from "shared-vuejs/editor";

import { nextTick, onMounted, ref, watch } from "vue";
import { NFlex, NSelect } from "naive-ui";
import { piniaInfo, piniaSelect } from "@/lib/common/store";
import DialogBase from "@/components/common/Layouts/DialogBase.vue";
import IframeInputbox from "@/components/common/IframeInputbox.vue";
import ToolbarItem from "../Toolbars/ToolbarItem.vue";
import LayoutHeader from "@/components/common/Layouts/LayoutHeader.vue";
import { saveDexie } from "shared-vuejs/api/dbutils";
import { toggleTaskPane } from "@/lib/main/utils";
import {
  DataUsageEdit24Regular,
  MathFormula24Regular,
  Open24Regular,
} from "@vicons/fluent";
import { h } from "vue";
import { getBaseHref } from "shared-vuejs/api/get-file";
import { hideEditor, updateText } from "shared-vuejs/api/updateText";
import { wrapSelectionWithSpan } from "shared-vuejs/api/textSelection";
import { Lightning } from "@vicons/carbon";
import { PianoSharp, TouchAppOutlined } from "@vicons/material";

import { execEditorSurroundSpan } from "shared-vuejs/api/execCommand.js";
import { escapeCssEntities } from "shared-vuejs/api/utility.js";

defineProps({
  cmd: String,
});

const hyperlink = ref("" as any);

const addonFunc = ref("");
const inputStr = ref("");
const outputVar = ref("");

const gotoSlide = ref("");
const gotoSlideOptions = ref([] as any);

const datasource = ref("");
const varName = ref(""); // for input, save to this var
// const appFunctions = [
//   {
//     label: "Ask AI",
//     value: "askAI",
//     input: "{{question}}",
//     output: "answer",
//   },
//   {
//     label: "Submit",
//     value: "submit",
//     input: "",
//     output: "",
//   },
// ];

// const selectedFlag = ref("");
// const flags = ref([]);
const varValue = ref("");

const curShp = ref(null as any);
const url = ref("");
const noneSelected = ref(true);

watch([() => piniaSelect().selShpFormat?.id], () => {
  varValue.value = "";
  updateDisplayURL();
});

watch(
  [
    () => piniaSelect().editingInfo?.link,
    () => piniaSelect().editingInfo?.formula,
  ],
  (newVal, oldVal) => {
    selectAnchor();
    if (newVal[0] !== oldVal[0] && newVal[0] !== "@set:" + varValue.value) {
      varValue.value = "";
    }
    updateDisplayURL();
  },
);

watch(
  () => piniaSelect().editingInfo,
  () => {
    varValue.value = "";
    updateDisplayURL();
  },
);

function selectAnchor() {
  // select entire anchor if click inside?
  const selection: any = window.getSelection();
  const parentEl = selection?.anchorNode?.parentNode;
  // const insideAnchor =
  //   parentEl?.style?.cssText?.includes("--link:") ||
  //   parentEl?.style?.cssText?.includes("--fml:");
  const insideAnchor =
    parentEl?.closest("span[data-fml]") || parentEl?.closest("span[data-link]");
  if (insideAnchor) {
    const range = document.createRange();
    range.selectNodeContents(parentEl);
    selection.removeAllRanges();
    selection.addRange(range);
    piniaSelect().editingInfo.selectionText = selection.toString();
  }
}

function updateDisplayURL() {
  curShp.value = getShapeDeep(piniaSelect().selShpFormat?.id);
  addonFunc.value = "";
  hyperlink.value = "";
  gotoSlide.value = "";
  // varValue.value = ""; // CANNOT reset this here as it will reset the value when the user is typing
  url.value = "";
  noneSelected.value = false;

  datasource.value = curShp.value?.datasource || "";
  varName.value = curShp.value?.varName || "";

  nextTick(() => {
    if (piniaSelect().editingInfo) {
      if (piniaSelect().editingInfo.selectionText) {
        url.value = piniaSelect().editingInfo?.link;
      } else {
        url.value = "";
      }
    } else {
      url.value = curShp.value?.link;
    }

    if (url.value?.startsWith("#") || url.value?.startsWith("@sld:")) {
      gotoSlide.value = url.value;
    } else if (url.value?.startsWith("@set:")) {
      varValue.value = url.value.substring(5);
    } else if (url.value?.startsWith("@run:")) {
      const funcInfo = url.value.substring(5).split("|");
      addonFunc.value = funcInfo[0];
      inputStr.value = funcInfo[1];
      outputVar.value = funcInfo[2];
    } else {
      hyperlink.value = url.value || "";
    }

    if (!hyperlink.value && !gotoSlide.value && !varValue.value) {
      noneSelected.value = true;
    }
  });
}

onMounted(async () => {
  const common = [
    {
      label: "Next Page",
      value: "#next",
    },
    {
      label: "Previous Page",
      value: "#prev",
    },
    {
      label: "First Page",
      value: "#first",
    },
    {
      label: "Last Page",
      value: "#last",
    },
    {
      label: "Last Page Viewed",
      value: "#viewed",
    },
    {
      label: "----------------------",
      value: "none",
      disabled: true,
    },
  ];
  let idx = 0;
  const slides: any = [];
  for (const sldInfo of getFileInfo().slides) {
    idx++;
    const sldId = sldInfo.id;
    slides.push({
      label: "Page " + idx + (sldInfo.title ? " (" + sldInfo.title + ")" : ""),
      value: `@sld:${sldId}`,
      image: `thumb-${sldId}`,
    });
  }
  gotoSlideOptions.value = [...common, ...slides];
  setTimeout(() => {
    selectAnchor();
    updateDisplayURL();
  }, 100);
});

function renderSlide(option) {
  if (option.image) {
    return [
      h("img", {
        src: getBaseHref(getFileInfo().id) + option.image + ".jpg",
        style: {
          width: "40px",
          verticalAlign: "middle",
          border: "1px solid #ccc",
        },
      }),
      " ",
      option.label as string,
    ];
  } else {
    return option.label;
  }
}

function updateGotoSlide(val) {
  gotoSlide.value = val;
  hyperlink.value = "";
  varValue.value = "";
  updateUrl(gotoSlide.value);
}

// function updateAddonFunc(val?) {
//   hyperlink.value = "";
//   gotoSlide.value = "";
//   varValue.value = "";
//   if (val) {
//     addonFunc.value = val;
//   }

//   updateUrl(
//     "@run:" + addonFunc.value + "|" + inputStr.value + "|" + outputVar.value,
//   );
// }

function updateHyperlink(val) {
  hyperlink.value = val || "";
  gotoSlide.value = "";
  varValue.value = "";
  updateUrl(hyperlink.value);
}

function updateVariable(val) {
  const url = val || "";
  hyperlink.value = "";
  gotoSlide.value = "";
  if (url !== varValue.value) {
    varValue.value = url;
    updateUrl("@set:" + varValue.value);
  }
}

function updateDatasource() {
  const curShp = getShapeDeep(piniaSelect().selShpFormat?.id);
  if (curShp) {
    curShp.datasource = datasource.value;
  }
  updateShape(curShp);
  saveDexie();
}

// function updateVarname() {
//   const curShp = piniaShapes().getShapeDeep(piniaSelect().selShpFormat?.id);
//   if (curShp) {
//     curShp.varName = varName.value;
//   }
//   saveDexie();
// }

function updateFormula(val) {
  if (piniaSelect().editingInfo) {
    // const selection = window.getSelection();
    // if (selection?.isCollapsed) {
    // selectAnchor();
    // // }
    // // const selected = getSelectedNodes();

    // const span: any = wrapSelectionWithSpan();
    // span.dataset["fml"] = val;
    execEditorSurroundSpan({
      "--fml": escapeCssEntities(val) || null,
      color: "",
    });
    updateText(true);
  }
}

function updateImageSrcLink(val) {
  const curShp = getShapeDeep(piniaSelect().selShpFormat?.id);
  if (curShp && curShp.blipFill) {
    curShp.blipFill.link = val;
  }
  updateShape(curShp);
  saveDexie();
}

function updateUrl(url) {
  if (piniaSelect().editingInfo) {
    // const selection = window.getSelection();
    // if (selection?.isCollapsed) {
    // selectAnchor();
    // }
    // updateSelectionProperty(selection, "--link", url);
    // const span = wrapSelectionWithSpan();
    // span.setAttribute('href', url);
    execEditorSurroundSpan({
      "--link": escapeCssEntities(url) || null,
      color: "",
    });
    updateText(false);
  } else {
    const curShp = getShapeDeep(piniaSelect().selShpFormat?.id);
    if (curShp) {
      curShp.link = url;
    }
    updateShape(curShp);
    saveDexie();
  }
}

// function updateSelectionProperty(selection, property, prop) {
//   let node: any = selection?.anchorNode;

//   // If the anchor node is a text node, move to its parent element
//   if (node?.nodeType === Node.TEXT_NODE) {
//     node = node.parentElement;
//   }

//   while (node && node.tagName !== "SPAN") {
//     node = node.parentElement;
//   }

//   const _prop = escapeCssEntities(prop);

//   if (_prop) {
//     node.style.setProperty(property, _prop);
//   } else {
//     node.style.removeProperty(property);
//   }

//   updateText();
// }

function changeChartType(val) {
  const shp = getShapeDeep(piniaSelect().selShpFormat?.id);
  shp.chartData.series.forEach((serie) => {
    serie.type = val;
  });
  updateShape(shp);
  saveDexie();
}

function updateField(e, f) {
  const val = e.target?.value || e;
  const shp = getShapeDeep(piniaSelect().selShpFormat?.id);
  if (val || shp[f]) {
    shp[f] = val;

    updateShape(shp);
    saveDexie();
  }
}

function openURL() {
  window.open(hyperlink.value);
}

function openRevogrid() {
  const chartData = piniaSelect().selShpFormat?.chartData;
  // const alphabet = Array.from({ length: 26 }, (_, i) =>
  //   String.fromCharCode(97 + i),
  // );
  // const columns: any = [
  //   ...alphabet.map((letter) => ({
  //     prop: letter,
  //     name: letter.toUpperCase(),
  //   })),
  // ];

  const rows: any = [
    {
      a: "",
    },
  ];

  chartData.series.forEach((serie, colIdx) => {
    rows[0][String.fromCharCode(97 + colIdx + 1)] = serie.name;
  });

  chartData.xAxis?.[0]?.data?.forEach((row, rowIdx) => {
    const rowObj = {
      a: row,
    };

    chartData.series.forEach((serie, colIdx) => {
      rowObj[String.fromCharCode(97 + colIdx + 1)] = serie.data[rowIdx];
    });

    rows.push(rowObj);
  });

  // add 50 more rows
  piniaInfo().openDataGrid = {
    // columns,
    rows,
    type: "chart",
  };
}
</script>

<style scoped>
.disabled {
  pointer-events: none;
  opacity: 0.5;
}

.selected-text {
  max-width: 300px;
  max-height: 60px;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  overflow: hidden;
  width: 100%;
}

.text-name {
  display: flex;
  align-items: center;
  height: 34px;
  gap: 10px;
}

.field-info {
  display: flex;
  justify-content: space-between;
  margin: 10px 0;
  font-size: 14px;
}

::placeholder {
  color: #ccc;
  opacity: 0.7; /* Firefox */
}

label {
  font-size: 14px;
}
tr {
  height: 36px;
}

td {
  height: 36px;
}
</style>
