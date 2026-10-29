<template>
  <DialogBase
    :no-padding="true"
    :tabbar-items="fontTabbarItems"
    shapeOnly
    textOnly
  >
    <div class="searchContainer">
      <IframeInputbox
        :on-input="updatePreview"
        :style="{
          width: '100%',
          border: '1px solid #ccc',
        }"
        :input-attr="{
          style: 'text-align: left; padding: 0 10px;',
          placeholder: 'Sample Text',
        }"
      />
      <!-- <IframeInputbox
        :on-input="doSearch"
        :on-change="doSearch"
        :style="{
          width: '150px',
          border: '1px solid #ccc',
        }"
        :input-attr="{
          style: 'text-align: left',
          placeholder: 'Search font',
        }"
      /> -->
    </div>
    <div class="toolbarContainer">
      <FileUpload
        buttonType="primary"
        ghost
        label="Upload Font (TTF/OTF) ..."
        :icon="FileUploadFilled"
        type="ttf"
        :uploadComplete="uploadComplete"
      />
    </div>
    <div class="resultContainer" ref="fontContainer">
      <div style="height: 100%">
        <div class="result">
          <GoogleFontItem
            v-for="item in fontList"
            :item="item"
            :previewText="previewText"
            :key="item.name"
            :height="28"
            :on-click="() => updateFontFamily(item.name, item.family)"
            type="local"
          />
        </div>
      </div>
    </div>
  </DialogBase>
</template>
<script setup lang="ts">
import { rememberFontFamily } from "./fontNameMenu";
import { updateFile, getFileInfo } from "shared-vuejs/editor";

import { piniaSelect, piniaSlides } from "@/lib/common/store";
import { execEditorSurroundSpan } from "shared-vuejs/api/execCommand";
import { onMounted, ref } from "vue";
import { saveDexie } from "shared-vuejs/api/dbutils";
import DialogBase from "@/components/common/Layouts/DialogBase.vue";
import GoogleFontItem from "./GoogleFontItem.vue";
import IframeInputbox from "@/components/common/IframeInputbox.vue";
import FileUpload from "../Media/FileUpload.vue";
import { watch } from "vue";
import { loadCustomFont } from "shared-vuejs/api/slideUtils";
import { getBaseHref } from "shared-vuejs/api/get-file";
import { FileUploadFilled } from "@vicons/material";
import { fontTabbarItems, hideFontPanel } from "./ToolbarTextOptions";


// const search = ref("");
const fontContainer = ref(null as any);
const previewText = ref("");
const fontList = ref([] as any);

// watch(() => getFileInfo().fonts, updateFontList);

onMounted(updateFontList);
watch(() => getFileInfo().fonts, updateFontList, { deep: true });

function updateFontList() {
  fontList.value = getFileInfo().fonts?.filter((f) => f.type == "local")
    ?.map((f) => ({ family: f.family, name: f.name }));
}

// function doSearch(val) {
//   console.log(val);
//   search.value = val;
//   if (fontContainer.value?.firstElementChild) {
//     fontContainer.value.firstElementChild.scrollTop = 0;
//   }
// }

function updatePreview(val) {
  previewText.value = val;
}

function uploadComplete(name, family) {
  updateFontList()
  loadFont(name, family);
}

function loadFont(name, family) {
  const font = getFileInfo().fonts?.find(f => f.name === name) || { name, family };
  loadCustomFont(font, getBaseHref(getFileInfo().id));
}

function updateFontFamily(name, family) {
  rememberFontFamily(family, "uploaded");
  loadFont(name, family);

  if (piniaSelect().editingInfo) {
    piniaSelect().editingInfo["fontFamily"] = family;
    execEditorSurroundSpan({
      "font-family": family,
    });
  } else {
    piniaSelect().selShpFormat?.txBody?.paras?.forEach((para) => {
      if (para && para.runs) {
        para.runs.forEach((run) => {
          if (!run.style) run.style = {};
          run.style.fontFamily = family;
        });
      }
    });
    execEditorSurroundSpan({
      "font-family": family,
    });
  }

  const fileInfo = getFileInfo();

  let fonts = fileInfo.fonts;
  if (!fonts) {
    fonts = [];
  }

  if (!fonts.find((font) => font.family == family)) {
    fonts.push({
      family: family,
      type: "local",
    });
    updateFile({
      fonts,
    });
    saveDexie();
  }
}
</script>
<style scoped>
.searchContainer {
  position: sticky;
  top: 0;
  padding: 20px 40px 20px 20px;
  display: flex;
  gap: 5px;
}
.container {
  top: 40px;
  position: absolute;
}

.toolbarContainer {
  width: calc(100% - 42px);
  padding: 0 20px;
}

.resultContainer {
  width: calc(100% - 42px);
  overflow-y: auto;
  overflow-x: hidden;
  padding: 20px;
  height: calc(100% - 184px);
}

.result {
  margin-top: 0px;
  /* overflow: hidden; */
}
</style>
