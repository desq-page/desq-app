<template>
  <div
    class="media-tabbar"
    :class="{
      bottomBorder: !subTabbarItems || bottomBorder,
    }"
  >
    <NIcon
      size="24"
      v-if="backLink"
      class="icon"
      @click="() => (backFunc ? backFunc() : backTo(backLink))"
    >
      <ArrowLeft24Filled />
    </NIcon>

    <TabbarItems
      :items="
        tabbarItems || [
          { label: title, icon, taskpane: piniaInfo().currentTaskPane },
        ]
      "
      :shape-only="shapeOnly"
      :textOnly
    />
  </div>
  <template v-if="!hideContent()">
    <SubTabbarItems :items="subTabbarItems" v-if="subTabbarItems" />
  </template>
  <div
    class="empty"
    v-if="
      hideContent() /*shapeOnly && !textOnly && !piniaSelect().selShpFormat*/
    "
  >
    <n-empty description="No shape selected or not applicable"></n-empty>
  </div>

  <div
    class="empty"
    v-if="
      !hideContent() &&
      textOnly &&
      !piniaSelect().selShpFormat?.txBody &&
      piniaSelect().selShpFormat?.type !== 'table'
    "
  >
    <n-empty description="No text selected or not applicable"></n-empty>
  </div>

  <div
    class="selection"
    :style="{
      padding: noPadding ? '' : '0 10px',
      width: noPadding ? '100%' : `calc(100% - 20px)`,
      height: `calc(100% - ${subTabbarItems ? 80 : 40}px)`,
      // marginTop: title ? '' : '10px',
    }"
    v-if="!hideContent()"
  >
    <div
      v-if="fillSelectors && !hideContent()"
      :class="{
        fillSelector: true,
        disabled: disableTab,
        compact: piniaResize().windowWidth <= 768,
      }"
    >
      <NSelect
        v-if="piniaResize().windowWidth <= 768"
        :value="selectedFill"
        :options="fillOptions"
        :disabled="disableTab"
        size="small"
        aria-label="Fill type"
        @update:value="selectFill"
      />
      <template v-else>
      <NRadio
        v-for="(sel, selIdx) in fillSelectors"
        :key="selIdx"
        :checked="sel.isChecked()"
        @click="sel.onClick"
      >
        {{ sel.label }}
      </NRadio>
      </template>
    </div>
    <slot></slot>
  </div>
</template>

<script setup lang="ts">
import { piniaInfo, piniaSelect, piniaResize } from "@/lib/common/store";
import { computed, onMounted } from "vue";
import { NEmpty, NIcon, NRadio, NSelect } from "naive-ui";
import { ArrowLeft24Filled } from "@vicons/fluent";
import { toggleTaskPane } from "@/lib/main/utils";
import TabbarItems from "./TabbarItems.vue";
import SubTabbarItems from "./SubTabbarItems.vue";

const props = defineProps({
  backLinkLabel: String,
  backLink: String,
  backFunc: Function,
  title: String,
  tabbarItems: Array,
  subTabbarItems: Array,
  bottomBorder: Boolean,
  fillSelectors: null,
  disableTab: Boolean,
  noPadding: Boolean,
  isEmpty: Boolean,
  icon: Object,
  shapeOnly: Boolean,
  textOnly: Boolean,
});

function backTo(link) {
  toggleTaskPane(link);
}

const selectedFill = computed(() => {
  const index = props.fillSelectors?.findIndex((selector) => selector.isChecked());
  return index >= 0 ? index : null;
});
const fillOptions = computed(() => (props.fillSelectors || []).map((selector, index) => ({
  label: selector.label,
  value: index,
})));
function selectFill(index: number) {
  if (!props.disableTab) props.fillSelectors?.[index]?.onClick();
}

// const domObj = ref(null);

function hideContent() {
  return (
    props.isEmpty ||
    (props.shapeOnly && !piniaSelect().selShpFormat) ||
    (props.textOnly &&
      !piniaSelect().selShpFormat?.txBody &&
      piniaSelect().selShpFormat?.type !== "table")
  );
}

onMounted(() => {});
</script>
<style scoped>
.fillSelector {
  display: inline-flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px;
  position: sticky;
  top: 0;
  z-index: 100;
  background-color: #f8f8f8;
  width: auto;
}

.empty {
  width: 100%;
  display: flex;
  justify-content: center;
  padding-top: 40px;
}

.fillSelector.compact {
  display: flex;
  width: 100%;
  box-sizing: border-box;
}

/* .title {
  height: 43px;
  width: 100%;
  justify-content: left;
  padding-left: 20px;
  display: flex;
  align-items: center;
  border-bottom: 1px solid #dfdfdf;
  box-shadow: 1px 1px 2px #d4d4d4;
  line-height: 30px;
  color: black;
  font-weight: bold;
} */

/* .label {
  padding: 0;
  color: rgba(40, 40, 40, 0.888);
}*/

.icon {
  color: rgba(80, 80, 80, 0.888);
  cursor: pointer;
  position: relative;
  z-index: 100;
  top: 4px;
}

.icon:hover {
  color: green;
}

.selection {
  width: 100%;
  overflow-y: auto;
  overflow-x: hidden;
}

.media-toolbar {
  display: flex;
  padding: 0;
  /* background: rgb(224, 224, 224); */
  width: calc(100% + 20px);
  margin: 0;
  position: sticky;
  font-weight: bold;
  z-index: 10;
}

.media-tabbar {
  display: flex;
  padding: 5px 10px 5px 15px;
  /* padding-bottom: 8px; */
  background: rgb(255, 255, 255);
  gap: 5px;
  width: calc(100% + 10px);
  margin: 0 -5px;
  position: sticky;
  font-weight: bold;
  z-index: 10;

  /* border-bottom: 1px solid #888; */
}

.media-tabbar.bottomBorder {
  border-bottom: 1px solid var(--n-primary-color);
}

/* 
.mediaItem.selected {
  background-color: #f8f8f8;
}

.mediaItem {
  display: flex;
  justify-content: center;
  margin-bottom: -6px;
  border-top: 1px solid #ccc;
  border-left: 1px solid #ccc;
  border-right: 1px solid #ccc;
  border-top-left-radius: 4px;
  border-top-right-radius: 4px;
} */
</style>
<style>
/* .mediaItem.selected button {
  pointer-events: none !important;
} */
</style>
