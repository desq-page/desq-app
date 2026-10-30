<template>
  <div
    :class="$style['header-container']"
    :style="{
      height: g.TOOLBARTOP_HEIGHT + 'px',
    }"
    @contextmenu.prevent
  >
    <NTabs
      size="small"
      justify-content="start"
      :style="{
        '--n-pane-padding-top': '4px',
      }"
      v-model:value="selectedTab"
      ref="tabsRef"
    >
      <template #prefix>
        <ToolbarItem type="spacing" />
        <FileMenu />
        <ToolbarItem type="divider" v-if="piniaResize().windowWidth >= 769" />"
        <ToolbarItem
          quaternary
          :on-click="undo"
          :on-pointer-down="(e) => e.stopPropagation()"
          :icon="UndoFilled"
          tooltip="Undo"
          :disabled="piniaInfo().undoIndex < 0"
        />
        <ToolbarItem
          quaternary
          :on-click="redo"
          :on-pointer-down="(e) => e.stopPropagation()"
          :icon="RedoFilled"
          tooltip="Redo"
          :disabled="piniaInfo().undoIndex >= getUndoHistory().length - 1"
        />
        <ToolbarItem type="divider" v-if="piniaResize().windowWidth >= 769" />"
      </template>
      <NTabPane
        name="home"
        tab="Home"
        :style="{
          display: 'flex',
        }"
        :disabled="showSpecialTab()"
      >
        <div :class="$style['header-left']" v-if="piniaResize().windowWidth >= 769">
          <ToolbarClipboard />
          <ToolbarSlide />
        </div>
        <div :class="$style['header-left']">
          <template v-if="piniaResize().windowWidth >= 769">
            <ToolbarItem type="divider"/>
            <ToolbarItemDropdown :options="TextOptions" :icon="TextT24Filled" caption="Text" />
            <ToolbarItemDropdown :options="ShapeOptions" :icon="TriangleSquareCircle" caption="Shapes" />
            <ToolbarItem caption="Media" :icon="Image24Regular" :onClick="() => toggleTaskPane('mediaPanel')" :active="piniaInfo().currentTaskPane == 'mediaPanel'" />
            <ToolbarItem type="divider" />
          </template>
          <!-- <ToolbarItem
            caption="Animation"
            :icon="StarReview"
            :onClick="() => toggleTaskPane('animations')"
            :active="piniaInfo().currentTaskPane == 'animations'"
          /> -->

          <!-- <ToolbarItem type="divider" v-if="piniaResize().windowWidth >= 800" /> -->
          <ToolbarShapeStyle
            :disabled="
              !(
                piniaSelect().selShps.length > 0 &&
                !showPointTab() &&
                !piniaInfo().useGrid
              )
            "
          />

          <ToolbarItem
            quaternary
            :icon="TextColor24Filled"
            :onClick="
              () => {
                toggleTaskPane('textcolor');
              }
            "
            :active="piniaInfo().currentTaskPane == 'textcolor'"
            :size="26"
            tooltip="Text Color"
            :color="array2hex(piniaSelect().editingInfo?.['color']) || 'black'"
            :extraClass="{ hilite: true }"
            :disabled="
              disableText()
            "
            caption="Format Text"
          />

          <ToolbarItem type="divider" v-if="piniaResize().windowWidth >= 800" />

          <ToolbarText
            :disabled="
              disableText()
            "
          />
          <ToolbarItem type="divider" v-if="piniaResize().windowWidth >= 800" />
        </div>
        <div :class="$style['header-left']" v-if="piniaSlides().masterView">
          <ToolbarItem type="divider" v-if="piniaResize().windowWidth >= 800" />
          <ToolbarItem
            caption="Set Placeholder"
            :icon="SlideLayout24Regular"
            :onClick="() => toggleTaskPane('shapeoptions')"
            :active="piniaInfo().currentTaskPane == 'shapeoptions'"
            :disabled="!piniaSelect().selShpFormat"
          />
          <ToolbarItem
            caption="Close Master"
            :icon="WindowCloseRegular"
            color="red"
            :onClick="editMaster"
          />
        </div>
      </NTabPane>
      <NTabPane name="insert" tab="Insert" :disabled="showSpecialTab()">
        <div :class="$style['header-left']">
          <ToolbarSlide />

          <ToolbarItem type="divider" v-if="piniaResize().windowWidth >= 769" />
          <ToolbarItemDropdown :options="TextOptions" :icon="TextT24Filled" caption="Text" />
          <ToolbarItemDropdown :options="ShapeOptions" :icon="TriangleSquareCircle" caption="Shapes" />
          <ToolbarItem caption="Media" :icon="Image24Regular" :onClick="() => toggleTaskPane('mediaPanel')" :active="piniaInfo().currentTaskPane == 'mediaPanel'" />
          <ToolbarItemDropdown
            :options="tableOptions"
            :icon="Table24Regular"
            caption="Table"
            tooltip="Insert Table"
            :disabled="!!piniaInfo().useGrid"
          />
          <InsertionItem
            v-for="menu in inserts"
            :key="menu.label"
            :label="menu.label"
            :icon="menu.icon"
            :taskpane="menu.taskpane"
            :id="menu.testId"
            :classStr="menu.classStr"
            :tooltip="menu.tooltip"
            :disabled="!!piniaInfo().useGrid"
            :onClick="menu.onClick"
            width="60px"
          />
          <ToolbarItem type="divider" v-if="piniaResize().windowWidth >= 769" />
          <ToolbarItem
            caption="&nbsp;&nbsp;Link&nbsp;&nbsp;"
            :icon="TouchAppOutlined"
            :size="26"
            :onClick="
              (e) => {
                toggleTaskPane('hyperlink');
              }
            "
            :active="piniaInfo().currentTaskPane == 'hyperlink'"
            :disabled="
              !(
                piniaSelect().selShps.length > 0 &&
                !showPointTab() &&
                !piniaInfo().useGrid
              )
            "
          />
          <ToolbarItem type="divider" v-if="piniaResize().windowWidth >= 769" />
          <ToolbarItem
            quaternary
            :onPointerDown="pasteShape"
            :style="{ '--n-padding': '0 10px' }"
            :disabled="!!piniaInfo().useGrid"
            color="#957606"
            :icon="ClipboardPaste24Regular"
            :size="26"
            caption="Clipboard"
          />
        </div>
      </NTabPane>
      <NTabPane name="transition" tab="Transition" :disabled="showSpecialTab() || piniaSlides().masterView">
        <ToolbarTransition />
      </NTabPane>
      <NTabPane name="animation" tab="Animation" :disabled="showSpecialTab()">
        <div :class="$style['header-left']">
          <ToolbarItemDropdown
            v-for="group in animationGroups"
            :key="group.value"
            :caption="group.label"
            :tooltip="group.label"
            :icon="group.icon"
            :color="group.color"
            :options="animationOptions(group.value)"
            :disabled="!hasAnimationSelection"
            scrollable
          />
          <ToolbarItem type="divider" />
          <ToolbarItem
            caption="Animation Pane"
            tooltip="Animation Pane"
            :icon="StarReview"
            :onClick="() => toggleTaskPane('animations')"
            :active="piniaInfo().currentTaskPane == 'animations'"
          />
        </div>
      </NTabPane>
      <NTabPane name="design" tab="Design" :disabled="showSpecialTab()">
        <div :class="$style['header-left']">
          <ToolbarDesign />
          <ToolbarItem type="divider" />
          <ToolbarItem
            caption="Change Layout"
            tooltip="Change Layout"
            :icon="SlideLayout24Regular"
            :onClick="changeLayout"
            :disabled="piniaSlides().masterView || !!piniaInfo().useGrid"
          />
          <ToolbarItem
            caption="Slide Size"
            tooltip="Slide Size"
            :icon="SlideSize24Regular"
            :onClick="() => toggleTaskPane('slidesize')"
            :active="piniaInfo().currentTaskPane == 'slidesize'"
            :disabled="!!piniaInfo().useGrid"
          />
        </div>
      </NTabPane>
      <NTabPane name="view" tab="View" :disabled="showSpecialTab()">
        <div :class="$style['header-left']">
          <ToolbarItem
            caption="Page Master"
            :icon="SlideLayout24Regular"
            :onClick="() => editMaster()"
            :active="piniaSlides().masterView"
          />
          <ToolbarItem
            caption="Layers"
            :icon="Layers"
            :onClick="() => toggleTaskPane('arrange')"
            :active="piniaInfo().currentTaskPane == 'arrange'"
          />
          <ToolbarItem
            caption="Show Ruler"
            :icon="Ruler"
            :onClick="() => updateShowRuler(!getRulerWidth())"
            :active="!!piniaResize().showRuler"
          />
          <ToolbarItem
            caption="Show Guide"
            :icon="Ruler"
            :onClick="() => (setInfoShowGuide(!getInfoShowGuide()))"
            :active="!!piniaInfo().showGuide"
          />
          <ToolbarItem
            caption="Play"
            tooltip="Play"
            :icon="SlideshowFilled"
            :onClick="openPreviewModal"
            :disabled="piniaSlides().masterView || !!piniaInfo().useGrid"
          />
        </div>
      </NTabPane>
      <!-- <NTabPane name="data" tab="Data" :disabled="showSpecialTab()">
        <ToolbarItem
          caption="Link"
          :icon="TouchAppOutlined"
          :onClick="
            (e) => {
              toggleTaskPane('hyperlink');
            }
          "
          :active="piniaInfo().currentTaskPane == 'hyperlink'"
        />
      </NTabPane> -->
      <NTabPane name="addins" tab="Add-ins" :disabled="showSpecialTab()">
        <div :class="$style['header-left']">
          <ToolbarAddins />
        </div>
      </NTabPane>
      <NTabPane
        v-if="piniaSelect().selShps.length > 0"
        name="shape-format"
        tab="Shape Format"
        :disabled="!!piniaInfo().useGrid"
      >
        <div :class="$style['header-left']" v-if="!showPointTab()">
          <ToolbarShapeStyle
            :disabled="
              !(
                piniaSelect().selShps.length > 0 &&
                !showPointTab() &&
                !piniaInfo().useGrid
              )
            "
          />

          <ToolbarItem
            quaternary
            :icon="TextColor24Filled"
            :onClick="
              () => {
                toggleTaskPane('textcolor');
              }
            "
            :active="piniaInfo().currentTaskPane == 'textcolor'"
            :size="26"
            tooltip="Text Color"
            :color="array2hex(piniaSelect().editingInfo?.['color']) || 'black'"
            :extraClass="{ hilite: true }"
            :disabled="
              disableText()
            "
            caption="Format Text"
          />

          <ToolbarItem type="divider" />
          <ToolbarItem
            caption="Edit Points"
            tooltip="Edit Points"
            :icon="DataLine20Filled"
            :onClick="switchEditingPoint"
            :disabled="!showEditingPoint() || !!piniaInfo().useGrid"
          />
          <ToolbarItem
            quaternary
            :icon="Crop24Filled"
            :size="26"
            :onClick="
              (e) => {
                if (getSelectCropShp()) {
                  // piniaSelect().cropShp = '';
                  deactivateCropImage();
                } else {
                  // piniaSelect().cropShp = selShpFormat.id;
                  activateCropImage();
                }
              }
            "
            :disabled="!showCrop()"
            caption="Crop"
            :active="!!piniaSelect().cropShp"
          />
          <!-- <ToolbarItemDropdown
            caption="Flip"
            :icon="FlipFilled"
            :options="flipOptions"
            :disabled="!showFlipShape()"
          /> -->
          <ToolbarItemDropdown
            caption="Wrap Text"
            tooltip="Wrap Text"
            :icon="wrapTextIcon"
            :options="wrapTextOptions"
            :checkOptSelected="isWrapTextSelected"
            :disabled="!hasWrapSelection || !!piniaInfo().useGrid"
            usePointerUp
          />

          <ToolbarItem
            quaternary
            :icon="GroupObjects"
            :size="26"
            :onClick="toggleGroup"
            :disabled="!showGroup()"
            :caption="
              piniaSelect().selShps.length == 1 &&
              piniaSelect().selShpFormat?.type == 'group'
                ? 'Ungroup'
                : 'Group'
            "
          />
          <ToolbarItemDropdown
            quaternary
            :disabled="piniaSelect().selShps.length < 2"
            :options="unionOptions"
            :icon="ShapeUnion24Regular"
            caption="Merge"
            use-pointer-up
          />
          <template v-if="piniaSelect().selShpFormat?.blipFill">
            <ToolbarItem type="divider" />
            <ToolbarItem
              caption="Picture Format"
              tooltip="Picture Format"
              :icon="Image24Regular"
              :onClick="() => toggleTaskPane('pictureoptions')"
              :active="piniaInfo().currentTaskPane == 'pictureoptions'"
            />
          </template>
        </div>
        <div :class="$style['edit-point-toolbar']" v-else>
          <ToolbarEditPoint />
        </div>
      </NTabPane>
      <!-- <NTabPane name="sizes" tab="Adaptive Layout" v-if="piniaInfo().useGrid">
        <div :class="$style['header-center']">
          <UseGridToolbar />
        </div>
      </NTabPane> -->
      <template #suffix>
        <ToolbarItem
          button-type="primary"
          button-size="small"
          quaternary
          :icon="AutoAwesomeOutlined"
          :onClick="
            (e) => {
             toggleTaskPane('agent')  
            }
          "
          tooltip="Agent"
        />
        <!-- <ZoomToolbar /> -->
        <!-- <ViewMode /> -->
        <ToolbarItem type="spacing" />
        <ToolbarItem
          button-type="primary"
          button-size="small"
          v-if="piniaSlides().masterView"
          label="Close Master"
          :onClick="
            (e) => {
              editMaster();
            }
          "
        />
        <ToolbarItem type="spacing" />
      </template>
    </NTabs>
  </div>
</template>

<script setup lang="ts">
import { resolveToolbarTab } from "@/lib/main/toolbarSelection.mjs";
import { editorAdapter } from '@/lib/agent/editor-adapter';
import { openPreviewModal } from "@/lib/main/previewPresentation";
import { getShapeDeep, updateShape, getInfoShowGuide, getRulerWidth, getSelectCropShp, getUndoHistory, setInfoShowGuide, setRulerWidth } from "shared-vuejs/editor";

import {
  piniaInfo,
  piniaSlides,
  piniaResize,
  piniaSelect,
} from "@/lib/common/store";

import ToolbarItem from "./ToolbarItem.vue";
import TableDimensionPicker from "./TableDimensionPicker.vue";
// import ViewMode from "./ViewMode.vue";

import {
  AutoAwesomeOutlined,
  UndoFilled,
  RedoFilled,
  SlideshowFilled,
  TouchAppOutlined,
} from "@vicons/material";

import { redo, undo } from "shared-vuejs/api/undo";

import { useCssModule, watch, ref, nextTick, h, computed } from "vue";

import { saveDexie } from "shared-vuejs/api/dbutils";
import {
  activateCropImage,
  deactivateCropImage,
} from "shared-vuejs/api/utils";

import g from "shared-vuejs/api/global";
import {
  ClipboardPaste24Regular,
  Crop24Filled,
  DataLine20Filled,
  Image24Regular,
  ShapeUnion24Regular,
  SlideLayout24Regular,
  SlideSize24Regular,
  Table24Regular,
  TextT24Filled,
  TextPositionFront24Regular,
  TextPositionTight24Regular,
  TextPositionSquare24Regular,
  TextPositionTopBottom24Regular,
  TextColor24Filled,
  StarArrowRightStart24Regular,
  StarEmphasis24Regular,
  StarArrowRightEnd24Regular,
  StarEdit24Regular,
} from "@vicons/fluent";
import FileMenu from "./FileMenu.vue";
// import ZoomToolbar from "./ZoomToolbar.vue";
import { ChartBar, Ruler, TriangleSquareCircle } from "@vicons/tabler";
import { changeLayout, editMaster } from "shared-vuejs/api/master";
import { NTabPane, NTabs } from "naive-ui";
import InsertionItem from "../Insertion/InsertionItem.vue";
import ToolbarText from "../Text/ToolbarText.vue";
import ToolbarShapeStyle from "./ToolbarShapeStyle.vue";
import ToolbarSlide from "./ToolbarSlide.vue";
import ToolbarDesign from "./ToolbarDesign.vue";
import ToolbarTransition from "./ToolbarTransition.vue";
import { GroupObjects, Layers, StarReview } from "@vicons/carbon";
import { toggleGroup } from "shared-vuejs/api/group";
import ToolbarItemDropdown from "./ToolbarItemDropdown.vue";
import { showCrop, showEditingPoint, showGroup, unionOptions } from "./ToolbarUtils";
import ToolbarAddins from "@/components/addon/ToolbarAddins.vue";
import ToolbarEditPoint from "./ToolbarEditPoint.vue";
import { switchEditingPoint } from "shared-vuejs/api/shape";

import { WindowCloseRegular } from "@vicons/fa";
import ToolbarClipboard from "./ToolbarClipboard.vue";
import { pasteShape } from "shared-vuejs/api/clipboard";
import { toggleTaskPane } from "@/lib/main/utils.js";
import { drawChart, drawTable } from "shared-vuejs/api/drawSpecialshapes.js";
import AutoShapes from "../AutoShapes/AutoShapes.vue";
import TextShapes from "../AutoShapes/TextShapes.vue";
import { array2hex } from "shared-vuejs/api/colorUtils.js";
import defAnimList from "../Animation/arrAnimList";
import { addEffect } from "../Animation/addAnimation";
import { startFreehandMotion } from "shared-vuejs/editor";

const animationGroups = [
  { value: "0", label: "Entrance", icon: StarArrowRightStart24Regular, color: "green" },
  { value: "1", label: "Emphasis", icon: StarEmphasis24Regular, color: "#FFA500" },
  { value: "2", label: "Exit", icon: StarArrowRightEnd24Regular, color: "red" },
  { value: "3", label: "Motion", icon: StarEdit24Regular, color: "purple" },
];
const hasAnimationSelection = computed(() =>
  !!(piniaSelect().selGrpShps?.length || piniaSelect().selShps?.length),
);
function animationOptions(group) {
  return Object.entries(defAnimList[group]).map(([id, effect]: [string, any]) => ({
    key: id,
    label: (group === "3" ? "Add " : "") + effect.l,
    onClick: () => {
      if (group === "3" && id === "0") {
        const selection = piniaSelect();
        const targets = [...(selection.selGrpShps?.length ? selection.selGrpShps : selection.selShps)];
        startFreehandMotion(path => addEffect(group, id, path, targets), () => {
          piniaInfo().curMode = "select";
          piniaInfo().curCmd = "";
        });
        piniaInfo().curMode = "draw";
        piniaInfo().curCmd = "freehandMotion";
      } else {
        addEffect(group, id, effect.d);
      }
    },
  }));
}

const wrapTextModes = [
  { key: "none", label: "None", icon: TextPositionFront24Regular },
  { key: "tight", label: "Tight", icon: TextPositionTight24Regular },
  { key: "square", label: "Square", icon: TextPositionSquare24Regular },
  { key: "inline", label: "Inline with Text", icon: Image24Regular },
  { key: "topbottom", label: "Top & Bottom", icon: TextPositionTopBottom24Regular },
];
const wrapSelection = computed(() => {
  const selection = piniaSelect();
  return selection.selGrpShps.length ? selection.selGrpShps : selection.selShps;
});
const hasWrapSelection = computed(() => wrapSelection.value.length > 0);
const selectedWrapMode = computed(() => {
  // Selection formatting is refreshed after shape updates.
  const format = piniaSelect().selShpFormat;
  if (wrapSelection.value.length === 1) return format?.wrapText || "none";
  const modes = wrapSelection.value.map(id => getShapeDeep(id)?.wrapText || "none");
  return modes.length && modes.every(mode => mode === modes[0]) ? modes[0] : null;
});
const wrapTextIcon = computed(() =>
  wrapTextModes.find(mode => mode.key === selectedWrapMode.value)?.icon || TextPositionSquare24Regular,
);
const isWrapTextSelected = (mode) => mode === selectedWrapMode.value;
function applyWrapText(mode) {
  for (const id of wrapSelection.value) {
    const shape = getShapeDeep(id);
    if (shape) updateShape({ ...shape, wrapText: mode });
  }
  saveDexie();
}
const wrapTextOptions = computed(() => [
  ...wrapTextModes.map(mode => ({
    ...mode,
    arg: mode.key,
    disabled: piniaSelect().editingPoint !== -1,
    onClick: () => applyWrapText(mode.key),
  })),
]);

function updateShowRuler(val) {
  if (val) {
    setRulerWidth(g.RULER_WIDTH);
  } else {
    setRulerWidth(0);
  }
  localStorage.setItem("RULER_WIDTH", String(getRulerWidth()));
}

const restoreShapeFormat = ref(false);
const selectedTab = computed({
  get: () => piniaInfo().toolbarTab,
  set: (value) => {
    if (value === 'home' && piniaInfo().toolbarTab === 'shape-format' && !piniaSelect().selShps.length) {
      restoreShapeFormat.value = true;
    } else if (value !== piniaInfo().toolbarTab) {
      restoreShapeFormat.value = false;
    }
    piniaInfo().toolbarTab = value;
  },
});
const tabsRef = ref();

watch(
  [
    () => piniaSelect().editingPoint,
    () => piniaInfo().useGrid,
    () => piniaSelect().selShpFormat?.id,
    () => piniaSelect().selShpFormat?.type,
    () => piniaSelect().selShps[0],
    () => piniaSelect().selShps.length > 0,
    () => piniaSlides().masterView,
  ],
  () => {
    const hasShape = piniaSelect().selShps.length > 0;
    const current = selectedTab.value;
    if (!hasShape && current === 'shape-format') restoreShapeFormat.value = true;
    const restore = hasShape && restoreShapeFormat.value && current === 'home' && !piniaInfo().useGrid;
    piniaInfo().toolbarTab = resolveToolbarTab(restore ? 'shape-format' : current, {
      editingPoints: showPointTab(),
      useGrid: !!piniaInfo().useGrid,
      hasShape,
    });
    if (restore) restoreShapeFormat.value = false;
    nextTick(() => tabsRef.value?.syncBarPosition());
  },
);

function disableText() {
  return !(
    (piniaSelect().editingInfo ||
      piniaSelect().selShpFormat?.txBody ||
      piniaSelect().selShpFormat?.type == 'table' ||
      piniaSelect().selShpFormat?.type == 'group' ||
      piniaSelect().selShpFormat?.type == 'smartart' ||
      piniaSelect().selShpFormat?.type == 'input') &&
    piniaSelect().selShpFormat?.$_otag !== 'pic' &&
    piniaSelect().selShpFormat?.ph?.$_type !== 'pic' &&
    piniaSelect().editingPoint == -1 &&
    !piniaInfo().useGrid
  )
}

function showPointTab() {
  const selection = piniaSelect();
  if (selection.editingPoint < 0) return false;
  if (selection.selShps.length === 1 && selection.selShps[0]?.startsWith("motionSh-")) return true;
  return showEditingPoint() && selection.selShpFormat?.type !== "line";
}

function showSpecialTab() {
  return showPointTab() || !!piniaInfo().useGrid;
}

const tableOptions = [{
  key: 'table-dimensions',
  type: 'render',
  render: () => h(TableDimensionPicker, {
    onSelect: (columns: number, rows: number) => {
      piniaInfo().setCurPopup("");
      drawTable(undefined, undefined, columns, rows);
    },
  }),
}];

const inserts = [
  // {
  //   label: "Media",
  //   icon: Image24Regular,
  //   taskpane: "mediaPanel",
  //   classStr: "InsertShapes",
  //   tooltip: "Insert Images & Videos",
  // },
  // {
  //   label: "Shapes",
  //   icon: TriangleSquareCircle,
  //   taskpane: "insertAutoshapes",
  //   testId: "menuShapes",
  //   classStr: "InsertShapes",
  //   tooltip: "Insert AutoShapes",
  // },
  // {
  //   label: "Texts",
  //   icon: TextT24Filled,
  //   taskpane: "texts",
  //   classStr: "InsertShapes",
  //   tooltip: "Insert Texts",
  // },
  {
    label: "Chart",
    icon: ChartBar,
    tooltip: "Insert Chart",
    onClick: () => {
      drawChart()
    }
  },
  // {
  //   label: "Widgets",
  //   icon: Hierarchy,
  //   taskpane: "objects",
  //   classStr: "InsertShapes",
  //   tooltip: "Insert Widgets",
  // },
];

const ShapeOptions = [
  {
    key: 'header',
    type: 'render',
    render: () => h(
      'div' , {
        style: {
          width: '300px',
          height: '500px',
          overflow: 'auto',
          padding: '0 20px 0 15px',
          overflowX: 'hidden',
          overflowY: 'auto'
        },
        onPointerdown: (e) => {
          e.preventDefault();
          e.stopPropagation();
        },
        onPointerup: (e) => {
          e.preventDefault();
          e.stopPropagation();
        },
        onScroll: (e) => {
          // console.log(e)
        }
      }, 
      [h(AutoShapes, {
        mode: 'insert'
      })]
    )
  }
]

const TextOptions = [
  {
    key: 'header',
    type: 'render',
    render: () => h(
      'div' , {
        style: {
          width: '300px',
          height: '500px',
          overflow: 'auto',
          padding: '0 20px 0 15px',
          overflowX: 'hidden',
          overflowY: 'auto'
        },
        onPointerdown: (e) => {
          e.preventDefault();
          e.stopPropagation();
        },
        onPointerup: (e) => {
          e.preventDefault();
          e.stopPropagation();
        },
        onScroll: (e) => {
          // console.log(e)
        }
      }, 
      [h(TextShapes, {
        mode: 'insert'
      })]
    )
  }
]

const $style = useCssModule();
</script>

<style module>

.header-container {
  /* display: flex; */
  align-items: center;
  justify-content: space-between;
  /* padding: 0 8px 0 0; */
  /* background: #c9f7c9; */
  box-shadow: 1px -1px 1px 0px rgba(149, 146, 146, 0.5), 1px 2px 1px 0px rgba(149, 146, 146, 0.5);
  color: white;
  position: relative;
  z-index: 3;
  user-select: none;
  -webkit-user-select: none;
  top: 0;
}

.file-menu {
  display: flex;
  justify-content: center;
  /* padding-left: 6px; */
}

.header-left,
.header-center,
.header-right {
  display: flex;
  align-items: center;

  flex-basis: 0;
  color: black;
  user-select: none;
  -webkit-user-select: none;
}

.header-left {
  justify-content: start;
}
.header-center {
  justify-content: center;
  flex-grow: 1;
}
.header-right {
  justify-content: end;
}
.edit-point-toolbar {
  display: flex;
  align-items: center;
  justify-content: safe center;
  width: 100%;
  overflow-x: auto;
  color: black;
}
</style>
