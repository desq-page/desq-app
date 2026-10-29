<template>
  <div class="sub-tabbar">
    <ToolbarItem
      v-for="item in items"
      :key="item.label"
      :label="item.label"
      :tooltip="item.tooltip"
      :icon="item.icon"
      :size="item.size"
      :onClick="() => toggleTaskPane(item.taskpane)"
      :class="{
        mediaItem: true,
        selected: item.taskpane == piniaInfo().currentTaskPane,
      }"
      v-show="item.show == undefined || item.show == true ? true : false"
    />
  </div>
</template>

<script setup lang="ts">
import { piniaInfo } from "@/lib/common/store";
import ToolbarItem from "@/components/editor/Toolbars/ToolbarItem.vue";
import { toggleTaskPane } from "@/lib/main/utils";
defineProps({
  items: Array<any>,
});
</script>

<style scoped>
.sub-tabbar {
  display: flex;
  padding: 1px 10px 5px 10px;
  background: rgb(255, 255, 255);
  border-bottom: 1px solid var(--n-primary-color);
  gap: 5px;
  width: calc(100% + 20px);
  margin: 0px 0 0 0px;
  position: sticky;
  font-weight: bold;
  z-index: 10;
}

.mediaItem.selected {
  background-color: #f8f8f8;
  border-top: 1px solid var(--n-primary-color);
  border-left: 1px solid var(--n-primary-color);
  border-right: 1px solid var(--n-primary-color);
  opacity: 1;
}

.mediaItem {
  /* background-color: #f8f8f8; */
  display: flex;
  justify-content: center;
  margin-bottom: -6px;
  border-left: 1px solid transparent;
  border-right: 1px solid transparent;
  border-top-left-radius: 4px;
  border-top-right-radius: 4px;
  opacity: 0.8;
}
</style>
<style>
.mediaItem button:hover {
  background-color: transparent !important;
}

.mediaItem button {
  color: var(--n-primary-color);
  /* border-bottom: 1px solid var(--n-primary-color); */
}

.mediaItem.selected button {
  border-bottom: none;
}
</style>
