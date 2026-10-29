<template>
  <NTooltip :trigger="tooltip ? 'hover' : 'manual'">
    <template #trigger>
      <div
        :class="{
          header: true,
          clear: !!clearBackground,
          disabled,
        }"
        :style="{
          cursor: arrow && !disabled ? 'pointer' : 'auto',
          marginTop: noTopMargin ? '0px' : '15px',
          marginBottom: noBottomMargin ? '0px' : undefined,
          display: hide ? 'none' : '',
        }"
        @click="(e) => onClick && !disabled && onClick(e)"
      >
        <div class="left">
          <slot name="switch"></slot>
          <NIcon
            v-if="icon"
            size="25"
            class="icon"
            :color="iconColor"
            :class="{
              bordered: iconBorder,
              disabled,
            }"
          >
            <component :is="icon"></component>
          </NIcon>

          <span class="label">{{ label }}</span>
        </div>
        <slot name="extra"></slot>
        <div class="arrow" v-if="arrow && !disabled">
          <NButton text type="primary">{{ arrowLabel }} </NButton>
          <NIcon size="22" color="var(--n-primary-color)"><KeyboardArrowRightFilled /></NIcon>
        </div>
      </div>
    </template>
    <span style="pointer-events: none">{{ tooltip }}</span>
  </NTooltip>
</template>
<script setup lang="ts">
import ToolbarItem from "@/components/editor/Toolbars/ToolbarItem.vue";
import { KeyboardArrowRightFilled } from "@vicons/material";
import { NButton, NIcon, NTooltip } from "naive-ui";

defineProps({
  label: String,
  icon: Object,
  iconColor: String,
  iconBorder: Boolean,
  arrow: Boolean,
  arrowLabel: String,
  clearBackground: Boolean,
  onClick: Function,
  noTopMargin: Boolean,
  noBottomMargin: Boolean,
  disabled: Boolean,
  tooltip: String,
  hide: Boolean,
});
</script>
<style scoped>
.header {
  font-size: 14px;
  font-weight: bold;
  display: flex;
  justify-content: space-between;
  width: calc(100% + 5px);
  height: 28px;
  padding: 5px 20px 5px 15px;
  margin: 10px -10px 10px -15px;
  background-color: #eee;
  border-top: 1px solid #cecece;
  border-bottom: 1px solid #cecece;
  position: relative;
}

.icon {
  margin-right: 5px;
}

.bordered {
  border: 1px solid #444;
  border-radius: 4px;
}

.header .left {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header .arrow {
  display: inline-flex;
  align-items: center;
  font-weight: normal;
}

.header.arrow:hover {
  background: #efefef;
  color: var(--n-primary-color);
}

.label.arrow {
  /* font-weight: normal; */
}

.clear {
  height: 25px;
  background-color: transparent;
  border-top: none;
  border-bottom: none;
  margin-top: 5px;
  margin-bottom: 5px;
  padding-left: 20px;
}
</style>
