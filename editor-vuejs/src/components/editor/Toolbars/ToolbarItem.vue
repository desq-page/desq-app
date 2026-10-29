<template>
  <div
    v-if="!hidden"
    class="toolbar-item"
    :class="{
      ...extraClass,
      disabled,
    }"
    :style="{
      height: type == 'divider' ? '100%' : null,
      minHeight: '28px',
    }"
  >
    <div class="divider" v-if="type == 'divider'">
      <NDivider vertical dashed :style="{ height: '70%', minHeight: '20px' }" />
    </div>
    <div class="spacing" v-if="type == 'spacing'"></div>
    <NTooltip
      placement="bottom"
      trigger="manual"
      :keep-alive-on-hover="false"
      :show
      :style="{ maxWidth: '400px' }"
      v-if="type !== 'divider' && type !== 'spacing'"
    >
      <template #trigger>
        <div
          :class="{
            'main-btn': true,
            'with-caption': !!caption,
            active,
          }"
          :style="{
            minWidth:
              piniaResize().windowWidth > 769 && !!caption ? '40px' : '20px',
            padding: !!caption ? '0 6px' : null,
            margin: !!caption ? '0 4px' : null,
          }"
          @pointerdown.prevent="
            (e) => onPointerDown && !disabled && onPointerDown(e)
          "
          @pointerover="displayTooltip"
          @pointerout="hideTooltip"
          @mousedown.prevent
          @contextmenu.prevent
          @click.prevent="(e) => onClick && !disabled && onClick(e)"
          @touchend.prevent="(e) => onClick && !disabled && onClick(e)"
        >
          <NButton
            :primary
            :secondary
            :tertiary
            :quaternary="quaternary && !caption"
            :ghost="ghost || !!caption"
            :text
            :bordered
            :type="active ? 'primary' : buttonType"
            :size="buttonSize"
            :style="{
              ...style,
              '--n-padding': nPadding || '0 10px',
              pointerEvents: !!caption ? 'none' : 'auto',
              outline: bordered ? '1px solid rgb(188,188,188)' : null,
              outlineOffset: '-1px',
              borderRadius: '3px',
            }"
            :color
            :disabled="disabled"
          >
            <div
              v-if="shp"
              class="shape-view"
              :style="{
                width: shp.w + 'px',
                height: shp.h + 'px',
                backgroundImage: shp.blipFill ? `url(${getBaseHref(getFileInfo()?.id) + 'media/' + shp.blipFill.blip?.$_target})` : undefined,
                backgroundColor: shp.solidFill?.uniClr?.color,
              }"
            >
              <span v-if="shp.txBody?.p?.r">T</span>
              <hr style="width: 100%" v-if="!shp.txBody?.p?.r  && !shp.solidFill && (shp.type == 'line' || shp.type == 'path')" />
              <!-- <ShapeSVG
                :baseHref="getBaseHref(getFileInfo()?.id)"
                :shp="shp"
                :theme="getTheme()"
                :master-info="getMasterInfo()"
              /> -->
            </div>
            <template #icon v-if="icon && !shp">
              <n-icon
                v-if="icon && !shp"
                :size="size || 24"
                :style="iconStyle"
                :color="iconColor"
              >
                <component :is="icon" />
              </n-icon>
            </template>
            <template v-if="label">
              <span
                class="label"
                :style="{
                  marginLeft: labelGap || (label ? '3px' : undefined),
                }"
                >{{ label }}</span
              >
            </template>
          </NButton>
          <div
            class="caption"
            v-if="caption && piniaResize().windowWidth > 1024"
          >
            {{ caption }}
          </div>
        </div>
      </template>
      <span>{{ tooltip }}</span>
    </NTooltip>
    <!-- <ToolbarItemButton
      v-if="type !== 'divider' && type !== 'spacing' && !tooltip"
      :label
      :labelGap
      :nPadding
      :type
      :icon
      :shp
      :buttonType
      :primary
      :secondary
      :tertiary
      :quaternary
      :ghost="ghost || !!caption"
      :active
      :text
      :onClick
      :onPointerDown
      :color
      :size
      :bordered
    /> -->
  </div>
</template>

<script setup lang="ts">
import { getTheme, getFileInfo, getMasterInfo } from "shared-vuejs/editor";

import { NDivider, NTooltip } from "naive-ui";
import { ref } from "vue";
import { piniaResize, piniaSlides } from "@/lib/common/store";
import { NButton, NIcon } from "naive-ui";
import { getBaseHref } from "shared-vuejs/api/get-file";


const show = ref(false);
let timerTooltip;

const props = defineProps({
  title: String,
  label: [String, Number],
  labelGap: String,
  nPadding: String,
  type: String,
  style: Object,
  icon: Object,
  iconStyle: Object,
  iconColor: String,
  shp: Object,
  cmd: String,
  arg: String,
  buttonType: String,
  buttonSize: String,
  text: Boolean,
  primary: Boolean,
  secondary: Boolean,
  tertiary: Boolean,
  quaternary: Boolean,
  ghost: Boolean,
  active: Boolean,
  onClick: Function,
  onPointerDown: Function,
  onPointerOver: Function,
  onPointerOut: Function,
  color: String,
  size: Number,
  bordered: Boolean,
  tooltip: String,
  hidden: Boolean,
  disabled: Boolean,
  extraClass: Object,
  caption: String,
});

function displayTooltip() {
  timerTooltip = setTimeout(
    () => (show.value = !!(props.tooltip /*&& !piniaInfo().curPopupId*/)),
    200,
  );
}

function hideTooltip() {
  show.value = false;
  clearTimeout(timerTooltip);
}

// function showTooltip() {
//   show.value = true;
// }
</script>
<style scoped>
.divider {
  display: flex;
  align-items: center;
  height: 100% !important;
}

.spacing {
  display: flex;
  align-items: center;
  height: 100%;
  width: 8px;
}

.toolbar-item {
  display: flex;
  align-items: center;
  position: relative;
}

.main-btn {
  cursor: pointer;
}

.shape-view {
  border-radius: 2px;
  overflow: hidden;
  width: 25px;
  height: 25px;
  position: relative;
  outline: 1px solid #ccc;
  display: flex;
  align-items: center;
  justify-content: center;
  background-size: cover;
}

.shape-view svg {
  translate: -50% 0%;
}

.caption {
  display: flex;
  justify-content: center;
  font-size: 10px;
  margin: 0 0 4px 0;
  position: relative;
  top: 100%;
  white-space: nowrap;
}

.with-caption {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding-top: 5px;
  border-radius: 6px;
}

.with-caption:hover {
  background: #d3fad4;
}

.active,
.active:hover {
  background: #ececec;
  color: green;
  /* outline: 1px solid green; */
  /* outline-offset: -3px; */
}
</style>
