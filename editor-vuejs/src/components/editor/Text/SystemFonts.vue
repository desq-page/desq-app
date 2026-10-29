<template>
  <DialogBase :no-padding="true" :tabbar-items="fontTabbarItems" shapeOnly textOnly>
    <div class="system-font-content">
      <div v-if="loaded" class="system-font-warning" role="note" aria-label="System font restrictions">
        System fonts only display on devices where the fonts already installed. Functions that access font data, such as Merge Shapes, may also fail. For better compatibility, use Google Fonts or upload Fonts.
      </div>
      <div class="searchContainer">
        <IframeInputbox
          :on-input="doSearch"
          :on-change="doSearch"
          :style="{ width: '150px', border: '1px solid #ccc' }"
          :input-attr="{ style: 'text-align: left; padding: 0 10px', placeholder: 'Search font' }"
        />
        <IframeInputbox
          :on-input="(value) => previewText = value"
          :style="{ width: '130px', border: '1px solid #ccc' }"
          :input-attr="{ style: 'text-align: left; padding: 0 10px', placeholder: 'Sample Text' }"
        />
      </div>
      <div v-if="!loaded || message" class="font-status" role="status">
        <span>{{ loading ? 'Loading system fonts…' : message || 'Allow access to browse installed fonts.' }}</span>
        <button v-if="!loaded" type="button" :disabled="loading" @click="request">
          {{ loading ? "Loading fonts..." : "Allow access to system fonts" }}
        </button>
      </div>
      <div v-else class="resultContainer">
        <div v-bind="containerProps" style="height: 100%">
          <div v-bind="wrapperProps" class="result">
            <GoogleFontItem
              v-for="item in list"
              :key="item.data"
              :item="{ family: item.data }"
              :previewText="previewText"
              :height="28"
              :on-click="updateFontFamily"
              type="system"
            />
          </div>
          <div v-if="!filteredItems.length" class="empty-result">No matching fonts</div>
        </div>
      </div>
    </div>
  </DialogBase>
</template>

<script setup lang="ts">
import { rememberFontFamily } from "./fontNameMenu";
import { computed, onMounted, ref } from "vue";
import { useVirtualList } from "@vueuse/core";
import { piniaSelect } from "@/lib/common/store";
import { execEditorSurroundSpan } from "shared-vuejs/api/execCommand";
import { saveDexie } from "shared-vuejs/api/dbutils";
import DialogBase from "@/components/common/Layouts/DialogBase.vue";
import IframeInputbox from "@/components/common/IframeInputbox.vue";
import GoogleFontItem from "./GoogleFontItem.vue";
import { fontTabbarItems } from "./ToolbarTextOptions";
import { systemFontSource } from "./fontNameMenu";

const { families, loading, loaded, message, request } = systemFontSource;
onMounted(() => systemFontSource.loadIfGranted());
const search = ref("");
const previewText = ref("");
const filteredItems = computed(() => families.value.filter(family =>
  family.toLowerCase().startsWith(search.value.toLowerCase())));
// Match Google Fonts: only mount the visible batch and a small scroll buffer.
const { list, containerProps, wrapperProps, scrollTo } = useVirtualList(filteredItems, {
  itemHeight: 28,
});

function doSearch(value) {
  search.value = value;
  scrollTo(0);
}

function updateFontFamily(family) {
  rememberFontFamily(family, "system");
  const editing = piniaSelect().editingInfo;
  if (editing) {
    editing.fontFamily = family;
    editing.fontName = family;
  }
  execEditorSurroundSpan({ "font-family": family });
  saveDexie();
}
</script>

<style scoped>
.system-font-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.system-font-warning {
  margin: 12px 20px 0;
  padding: 10px 12px;
  border: 1px solid #e4bd61;
  border-radius: 4px;
  background: #fff7df;
  color: #614600;
  font-size: 13px;
  line-height: 1.45;
  flex-shrink: 0;
}
.searchContainer {
  position: sticky;
  top: 0;
  padding: 20px 40px 10px 20px;
  display: flex;
  gap: 5px;
}
.resultContainer {
  width: calc(100% - 42px);
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0 20px;
  flex: 1;
  min-height: 0;
}
.result { margin-top: 0; overflow: hidden; }
.font-status { padding: 0 20px; display: flex; flex-direction: column; gap: 12px; }
.empty-result { padding: 10px 0; }
</style>
