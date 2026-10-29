<template>
  <NTooltip :delay="300">
    <template #trigger>
      <div
        :style="{
          height: height + 'px',
          lineHeight: height + 'px',
        }"
        @pointerdown.prevent="() => onClick && onClick(item?.family)"
        class="fontname"
      >
        <span
          class="sample"
          :style="{
            fontSize: (height || 28) - 10 + 'px',
            fontFamily: item?.family,
          }"
          >{{ previewText || item?.family }}</span
        >
      </div>
    </template>
    {{ item?.family }}
  </NTooltip>
</template>

<script setup lang="ts">
import { NTooltip } from "naive-ui";
import { loadGoogleFont } from "shared-vuejs/api/slideUtils";
// import { onMounted } from "vue";
const props = defineProps({
  item: Object,
  previewText: String,
  onClick: Function,
  height: Number,
  type: String,
});

if (!props.type || props.type === "google") {
  loadGoogleFont(props.item?.family);
}
// console.log('mouted', props.item?.family)
</script>

<style scoped>
.fontname {
  font-size: 14px;
  position: relative;
}

.fontname:hover {
  background: #ececec;
  cursor: pointer;
}
</style>
