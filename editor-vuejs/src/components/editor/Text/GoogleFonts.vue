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
      <NSelect
        :value="language"
        :options="languageOptions"
        placeholder="All languages"
        aria-label="Filter by language or script"
        filterable
        clearable
        style="width: 170px"
        @update:value="updateLanguage"
      />
    </div>
    <div class="resultContainer" ref="fontContainer">
      <div v-bind="containerProps" style="height: 100%">
        <div v-bind="wrapperProps" class="result">
          <GoogleFontItem
            v-for="item in list"
            :item="{ family: item.data }"
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
import { NSelect } from "naive-ui";
// Google Fonts catalog coverage from https://fonts.google.com/metadata/fonts.

import fontSubsets from "./googleFontSubsets.json";
import { saveDexie } from "shared-vuejs/api/dbutils";
import DialogBase from "@/components/common/Layouts/DialogBase.vue";
import GoogleFontItem from "./GoogleFontItem.vue";
import IframeInputbox from "@/components/common/IframeInputbox.vue";
import { fontTabbarItems } from "./ToolbarTextOptions";


const search = ref("");
const fontContainer = ref(null as any);
const googleFontFamilies = ref<string[]>([]);
const language = ref<string | null>(null);
const subsets: Record<string, string[]> = fontSubsets;
const languageOptions = Object.keys(subsets).map(value => ({
  value,
  label: value === 'latin' ? 'Latin (English)' :
    value.split('-').map(word => word[0].toUpperCase() + word.slice(1)).join(' '),
}));

onMounted(async () => {
  const { googleFonts } = await import("shared-vuejs/api/googleFonts");
  googleFontFamilies.value = googleFonts.map((f) => f[0]);
});

const filteredItems = computed(() => {
  const query = search.value.toLowerCase();
  const supported = language.value ? new Set(subsets[language.value]) : undefined;
  return googleFontFamilies.value.filter(family =>
    family.toLowerCase().startsWith(query) && (!supported || supported.has(family)),
  );
});

const { list, containerProps, wrapperProps } = useVirtualList(filteredItems, {
  // Keep `itemHeight` in sync with the item's row.
  itemHeight: 28,
});

function doSearch(val) {
  search.value = val;
  resetScroll();
}

function updateLanguage(value: string | null) {
  language.value = value;
  resetScroll();
}

function resetScroll() {
  if (fontContainer.value?.firstElementChild) {
    fontContainer.value.firstElementChild.scrollTop = 0;
  }
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
