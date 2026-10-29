<template>
  <!-- <SelectionToolbar /> -->
  <DialogBase
    shapeOnly
    title="Format Shape"
    :sub-tabbar-items="subTabbarItems"
  >
    <ShapeInfo />
    <LinkedTextboxOptions />
    <template v-if="piniaSlides().masterView">
      <LayoutHeader label="Placeholder Type" />
      <PlaceholderType />
    </template>
    <template v-if="piniaSelect().selShpFormat?.type == 'group'">
      <LayoutHeader label="Data Container" />
      <div>
        <ToolbarItemSwitch
          label="Use As Container"
          :defaultVal="!!piniaSelect().selShpFormat?.container"
          :onClick="(checked) => updateField(checked, 'container')"
        />
      </div>
      <!-- <div>
          <span>No scroll:</span>
          <input
            type="checkbox"
            class="dim-field"
            :checked="selShpFormat.noscroll || false"
            @change="(e) => updateField(e, 'noscroll')"
          />
        </div> -->
    </template>
    <!-- <LayoutHeader
        label="Link"
        :icon="TouchAppOutlined"
        :arrow="true"
        :onClick="openHyperlink"
      /> -->

    <!-- <LayoutHeader
        label="Animation"
        :icon="AnimationSharp"
        :arrow="true"
        :onClick="openAnimation"
      /> -->
    <!-- <LayoutHeader
        label="Selection Pane"
        :icon="Layers"
        :arrow="true"
        :onClick="() => toggleTaskPane('arrange')"
      /> -->
    <LayoutHeader
      label="Video Options"
      v-if="
        piniaSelect().selShpFormat?.blipFill?.video && piniaSelect().selShps?.size == 1
      "
    />
    <template v-if="piniaSelect().selShpFormat?.blipFill?.video?.startsWith('http')">
      <IframeInputbox
        :value="piniaSelect().selShpFormat?.blipFill?.video"
        :on-change="updateVideoPath"
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
    </template>
    <template v-else>
      <ToolbarItemSwitch
        label="Autoplay"
        :defaultVal="!!piniaSelect().selShpFormat?.blipFill?.autoplay"
        :onClick="(val) => updateVideo('autoplay', val)"
        v-if="
          piniaSelect().selShpFormat?.blipFill?.video &&
          piniaSelect().selShps?.size == 1
        "
      />
      <div
        class="taskpane-guide"
        v-if="
          piniaSelect().selShpFormat?.blipFill?.autoplay &&
          piniaSlides().slideIndex == 1
        "
      >
        ⚠️ autoplay video on first slide is muted due to web security
      </div>
      <ToolbarItemSwitch
        label="Show Controls"
        :defaultVal="!!piniaSelect().selShpFormat?.blipFill?.controls"
        :onClick="(val) => updateVideo('controls', val)"
        v-if="
          piniaSelect().selShpFormat?.blipFill?.video &&
          piniaSelect().selShps?.size == 1
        "
      />
    </template>
    <!-- <NFlex vertical>
        <ToolbarItem
          label="Download Selected Shapes"
          labelGap="15px"
          :icon="CloudDownload"
          :size="30"
          :color="g.themeOverrides?.common?.primaryColor"
          n-padding="0"
          :onClick="
            () => {
              downloadClick();
            }
          "
        />
      </NFlex> -->

    <template v-if="piniaSelect().selShpFormat?.type == 'iframe'">
      <LayoutHeader label="Iframe Source" />
      <textarea
        :value="piniaSelect().selShpFormat?.url"
        class="textInput"
        @keydown.stop
        @change="(e) => updateURL(e, piniaSelect().selShpFormat?.id)"
      />
    </template>
    <LayoutHeader label="Add-ons" />
    <NFlex vertical>
      <ToolbarItem
        text
        label="Edit In Photopea..."
        labelGap="15px"
        :icon="ImageEdit20Regular"
        :size="30"
        :color="g.themeOverrides?.common?.primaryColor"
        n-padding="0"
        :onClick="
          () => {
            editInPhotopea(piniaSelect().selShpFormat);
          }
        "
        :disabled="
          !!piniaSelect().selShpFormat?.blipFill?.video ||
          piniaSelect().selShpFormat?.type == 'chart' ||
          piniaSelect().selShpFormat?.type == 'table'
        "
      />
    </NFlex>
  </DialogBase>
</template>

<script setup lang="ts">
import { getShapeDeep, updateShape } from "shared-vuejs/editor";

import LinkedTextboxOptions from "../Text/LinkedTextboxOptions.vue";
import {
  piniaShapes,
  piniaSlides,
  piniaSelect,
  piniaInfo,
} from "@/lib/common/store";
// import g from "shared-vuejs/api/global";
// import { setStyles } from "shared-vuejs/api/selection";
import LayoutHeader from "@/components/common/Layouts/LayoutHeader.vue";
import { ImageEdit20Regular } from "@vicons/fluent";
// import { computed } from "vue";
import DialogBase from "@/components/common/Layouts/DialogBase.vue";
import ToolbarItem from "@/components/editor/Toolbars/ToolbarItem.vue";
import { saveDexie } from "shared-vuejs/api/dbutils";
import { getShapeImage } from "shared-vuejs/api/downloadShape";
import { NFlex } from "naive-ui";
import g from "shared-vuejs/api/global";

import ToolbarItemSwitch from "../Toolbars/ToolbarItemSwitch.vue";
import { showError } from "shared-vuejs/api/utils";
import PlaceholderType from "./PlaceholderType.vue";
import IframeInputbox from "@/components/common/IframeInputbox.vue";
import ShapeInfo from "../Effects/ShapeInfo.vue";
import { subTabbarItems } from "./ShapeTabbarOptions";


// watch(
//   () => selShpFormat.value,
//   () => {
//     if (!selShpFormat.value) {
//       piniaInfo().currentTaskPane = "formatslide";
//     }
//   },
// );

function updateURL(e, id) {
  const shp = getShapeDeep(id);
  shp.url = e.target.value;
  updateShape(shp);
  saveDexie();
}

function updateField(checked, field) {
  const shp = getShapeDeep(piniaSelect().selShpFormat?.id);
  shp[field] = !!checked; // e.target.checked ?? e.target.value;
  updateShape(shp);
  saveDexie();
}

async function editInPhotopea(shp) {
  const dataUrl = await getShapeImage(shp);
  piniaInfo().openImagePhotopea = dataUrl;
  // dataUrl = await blobToDataURL(dataUrl)
  // const url =
  //   "https://www.photopea.com#" +
  //   JSON.stringify({
  //     files: [dataUrl],
  //     // environment: {
  //     //   customIO: {
  //     //     save: "app.activeDocument.saveToOE('png')",
  //     //   },
  //     // },
  //   });
  // window.open(url, "photopea");
}

// function setImageTile(val) {
//   const oldShp = piniaShapes().getShapeDeep(selShpFormat.value.id);
//   oldShp.blipFill = {
//     ...oldShp.blipFill,
//     tile: val,
//   };
//   piniaShapes().updateShape(oldShp);
// }

function updateVideoPath(val) {
  if (val.startsWith("http")) {
    const oldShp = getShapeDeep(piniaSelect().selShpFormat?.id);
    oldShp.blipFill = {
      ...oldShp.blipFill,
      video: val,
    };
    updateShape(oldShp);
  } else {
    showError("Only for updating online video URL (http/https)");
  }
}

function updateVideo(prop, val) {
  const oldShp = getShapeDeep(piniaSelect().selShpFormat?.id);
  oldShp.blipFill = {
    ...oldShp.blipFill,
    [prop]: val,
  };
  updateShape(oldShp);
  saveDexie();
}
</script>
<style scoped>
.textInput {
  width: 100%;
  height: 60px;
}

/* .guide {
  font-size: 12px;
} */
</style>
