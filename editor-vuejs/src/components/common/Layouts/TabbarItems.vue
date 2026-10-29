<template>
  <!-- <ToolbarItem
      v-for="item in items"
      :key="item.label"
      :label="item.label"
      :tooltip="item.tooltip"
      :icon="item.icon"
      :onClick="() => toggleTaskPane(item.taskpane)"
      :size="18"
      button-size="small"
      :class="{
        mediaItem: true,
        selected:
          item.taskpane == piniaInfo().currentTaskPane ||
          item.taskpanes?.includes(piniaInfo().currentTaskPane),
        hidden: item.textonly && !piniaSelect().selShpFormat?.txBody,
      }"
    /> -->
  <NButton
    v-for="item in items"
    :key="item.label"
    quaternary
    type="primary"
    size="small"
    @pointerdown.prevent="() => toggleTaskPane(item.taskpane)"
    :class="{
      mediaItem: true,
      selected: isSelected(item),
      hideBorder: (items || []).length <= 1,
      hidden:
        item.textOnly &&
        (!(
          piniaSelect().selShpFormat?.txBody ||
          piniaSelect().selShpFormat?.type == 'table'
        ) ||
          piniaSelect().selShpFormat?.$_otag == 'pic' ||
          piniaSelect().selShpFormat?.ph?.$_type == 'pic'),
    }"
    :style="{
      '--btn-color': 'red',
    }"
  >
    <template #icon v-if="item.icon">
      <NIcon :size="18"><component :is="item.icon" /></NIcon>
    </template>
    {{ item.label }}
  </NButton>
</template>

<script setup lang="ts">
import { piniaInfo, piniaSelect } from "@/lib/common/store";
// import ToolbarItem from "@/components/editor/Toolbars/ToolbarItem.vue";
import { toggleTaskPane } from "@/lib/main/utils";
import { NButton, NIcon } from "naive-ui";
defineProps({
  items: Array<any>,
  shapeOnly: Boolean,
  textOnly: Boolean,
});

function isSelected(item) {
  return (
    item.taskpane == piniaInfo().currentTaskPane ||
    item.taskpanes?.includes(piniaInfo().currentTaskPane)
  );
}
</script>

<style scoped>
.mediaItem.selected {
  background-color: #f8f8f8;
  color: var(--n-primary-color);
  border: 1px solid var(--n-primary-color);
  opacity: 1;
  pointer-events: none;
}

.hideBorder {
  border: none !important;
  background-color: transparent !important;
}

.mediaItem {
  color: #444;
  display: flex;
  justify-content: center;
  border: 1px solid #ececec;
  opacity: 0.8;
  font-weight: bold;
  top: 1px;
}

.hidden {
  display: none;
}
</style>
<style>
.mediaItem button:hover {
  background-color: transparent !important;
}
</style>
