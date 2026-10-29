<template>
  <DialogBase
    :no-padding="true"
    :tabbar-items="fontTabbarItems"
    shapeOnly
    textOnly
  >
    <div class="searchContainer">
      <IframeInputbox
        :on-input="doSearch"
        :on-change="doSearch"
        :style="{
          width: '150px',
          border: '1px solid #ccc',
        }"
        :input-attr="{
          style: 'text-align: left; padding: 0 10px',
          placeholder: 'Search font',
        }"
      />
      <IframeInputbox
        :on-input="updatePreview"
        :style="{
          width: '130px',
          border: '1px solid #ccc',
        }"
        :input-attr="{
          style: 'text-align: left; padding: 0 10px',
          placeholder: 'Sample Text',
        }"
      />
    </div>
    <div class="resultContainer" ref="fontContainer">
      <div v-bind="containerProps" style="height: 100%">
        <div v-bind="wrapperProps" class="result">
          <GoogleFontItem
            v-for="item in list"
            :item="{ family: item.data }"
            :previewText="previewText"
            :key="item.data"
            :height="28"
            :on-click="updateFontFamily"
          />
        </div>
      </div>
    </div>
  </DialogBase>
</template>
<script setup lang="ts">
import { rememberFontFamily } from "./fontNameMenu";
import { updateFile, getFileInfo } from "shared-vuejs/editor";

import { loadGoogleFont } from "shared-vuejs/api/slideUtils";

import { useVirtualList } from "@vueuse/core";
import { piniaSelect } from "@/lib/common/store";
import { execEditorSurroundSpan } from "shared-vuejs/api/execCommand";
import { computed, onMounted, ref } from "vue";
import { saveDexie } from "shared-vuejs/api/dbutils";
import DialogBase from "@/components/common/Layouts/DialogBase.vue";
import GoogleFontItem from "./GoogleFontItem.vue";
import IframeInputbox from "@/components/common/IframeInputbox.vue";
import { fontTabbarItems, hideFontPanel } from "./ToolbarTextOptions";


const search = ref("");
const fontContainer = ref(null as any);
const goggleFonts = ref([] as any);
const previewText = ref("");

onMounted(async () => {
  const { googleFonts } = await import("shared-vuejs/api/googleFonts");
  goggleFonts.value = googleFonts.map((f) => f[0]);
});

const filteredItems = computed(() => {
  return goggleFonts.value.filter((i) =>
    i.toLowerCase().startsWith(search.value.toLowerCase()),
  );
});

const { list, containerProps, wrapperProps } = useVirtualList(filteredItems, {
  // Keep `itemHeight` in sync with the item's row.
  itemHeight: 28,
});

function doSearch(val) {
  console.log(val);
  search.value = val;
  if (fontContainer.value?.firstElementChild) {
    fontContainer.value.firstElementChild.scrollTop = 0;
  }
}

function updatePreview(val) {
  previewText.value = val;
}

function updateFontFamily(f) {
  rememberFontFamily(f, "google");
  loadGoogleFont([f]);

  if (piniaSelect().editingInfo) {
    piniaSelect().editingInfo["fontFamily"] = f;
    execEditorSurroundSpan({
      "font-family": f,
    });
  } else {
    piniaSelect().selShpFormat?.txBody?.p?.forEach((para) => {
      if (para && para.runs) {
        para.runs.forEach((run) => {
          //if (!run.style) run.style = {};
          run.latin = f;
        });
      }
    });
    execEditorSurroundSpan({
      "font-family": f,
    });
  }

  const fileInfo = getFileInfo();

  let fonts = (fileInfo.fonts);
  if (!fonts) {
    fonts = [];
  }

  if (!fonts.find((font) => font.family == f)) {
    fonts.push({
      family: f,
      type: "google",
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
  padding: 20px 40px 10px 20px;
  display: flex;
  gap: 5px;
}
.container {
  top: 40px;
  position: absolute;
}

.resultContainer {
  width: calc(100% - 42px);
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0 20px;
  height: calc(100% - 106px);
}

.result {
  margin-top: 0px;
  overflow: hidden;
}
</style>
