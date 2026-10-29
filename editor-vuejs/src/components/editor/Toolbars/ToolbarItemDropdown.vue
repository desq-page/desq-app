<template>
  <NDropdown
    :options="fullOptions as SelectBaseOption[]"
    :node-props="optionNodeProps"
    placement="bottom-start"
    @clickoutside="clickOutside"
    @contextmenu.prevent
    trigger="manual"
    :show="showDropdown"
    :disabled="disabled"
    :scrollable="scrollable"
    :menu-props="scrollable ? () => ({ style: { maxHeight: 'min(480px, 70vh)' } }) : undefined"
    :style="{
      '--n-box-shadow':
        '0 3px 6px -4px rgba(0, 0, 0, .12), 0 6px 16px 0 rgba(0, 0, 0, .0=8), 0 9px 28px 8px rgba(0, 0, 0, .5)',
      minWidth: width || null,
    }"
    :x="xy?.x ?? undefined"
    :y="xy?.y ?? undefined"
  >
    <NTooltip
      trigger="manual"
      :placement="tooltipPlacement || 'bottom'"
      :show="showTooltip"
      :keep-alive-on-hover="false"
      :disabled="disabled"
    >
      <template #trigger>
        <div
          ref="dropdownTrigger"
          :class="{
            'main-btn': true,
            'with-caption': !!caption,
            active: active || showDropdown,
            disabled,
          }"
          :style="{
            minWidth: piniaResize().windowWidth > 769 && !!caption ? '40px' : '20px',
            fontSize: '1px',
            padding: !!caption ? '0 2px' : null,
            margin: !!caption ? '0 4px' : null,
          }"
          @pointerover.prevent="displayTooltip"
          @pointerout.prevent="hideTooltip"
          @touchend="touchUsed = true"
          @pointerdown.prevent="(e: Event) => clickItem(e, cmd, arg)"
          @pointerup.prevent
          :disabled="disabled"
        >
          <NButton
            :primary
            :secondary
            :tertiary
            :quaternary="quaternary && !caption"
            :ghost="ghost || !!caption"
            :text
            :type="buttonType"
            :size="buttonSize || 'medium'"
            :circle="circle"
            :color="color"
            ref="thisComp"
            :style="{
              height,
              width,
              alignSelf: 'center',
              '--n-padding': useInput ? 0 : '0 10px',
              '--n-border': 'none',
              minWidth: useInput ? '40px' : null,
              outline: bordered ? '1px solid rgb(188,188,188)' : null,
              outlineOffset: '-1px',
              ...buttonStyle,
              pointerEvents: !!caption ? 'none' : null,
              overflow: 'hidden',
            }"
            @pointerover.prevent="displayTooltip"
            @pointerout.prevent="hideTooltip"
            @touchend="touchUsed = true"
            @pointerdown.prevent="(e: Event) => clickItem(e, cmd, arg)"
          >
            <template #icon v-if="myIcon">
              <NIcon :size="size || 25">
                <component :is="myIcon" />
              </NIcon>
            </template>
            <template v-if="label">
              <!--iframe source in public folder-->
              <IframeInputbox
                v-if="useInput && showDropdown"
                :value="labelStr"
                :on-change="inputChangeEvt"
                :input-attr="{
                  style: 'width: 40px; height: 25px; text-align: center;',
                  inputmode: 'number',
                  min: '1',
                  max: '2000',
                }"
                :style="{
                  width: '40px',
                  height: '25px',
                }"
                autofocus
              />
              <span :style="labelStyle" v-else>{{ labelStr }}</span>
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
      <span v-if="tooltip">{{ tooltip }}</span>
    </NTooltip>
  </NDropdown>
</template>

<script setup lang="ts">
import {  } from "shared-vuejs/editor";

import IframeInputbox from "@/components/common/IframeInputbox.vue";
import { piniaInfo, piniaResize, piniaSelect } from "@/lib/common/store";

import { NButton, NIcon, NDropdown, NTooltip } from "naive-ui";
import { SelectBaseOption } from "naive-ui/es/select/src/interface";
import { genId } from "shared-vuejs/api/utility";
import { h, ref, shallowRef, computed, watch, nextTick } from "vue";

const props = defineProps({
  options: Array,
  active: Boolean,
  onClick: Function,
  icon: Object,
  cmd: String,
  arg: String,
  label: [String, Number],
  labelStyle: Object,
  caption: String,
  useInput: Boolean,
  onInputChange: Function,
  buttonType: String,
  buttonSize: String,
  primary: Boolean,
  secondary: Boolean,
  tertiary: Boolean,
  quaternary: Boolean,
  buttonStyle: Object,
  bordered: Boolean,
  ghost: Boolean,
  text: Boolean,
  displaySelectedIcon: Boolean,
  displaySelectedLabel: Boolean,
  checkOptSelected: Function,
  circle: Boolean,
  size: Number,
  height: String,
  width: String,
  tooltip: String,
  tooltipPlacement: String,
  tooltipDelay: Number,
  color: String,
  selectOnPointerdown: Boolean,
  disabled: Boolean,
  popoverId: String,
  xy: Object, // manual popup position
  usePointerUp: Boolean,
  scrollable: Boolean,
});

const uid: any = props.popoverId || genId();

const fullOptions: any = computed(() => props.options?.map(mapOption));

const myIcon = shallowRef(props.icon);
const labelStr: any = ref(props.label);
// const labelEdit = ref(props.label as any);
const dropDownInput = ref(null as any);

const showDropdown = computed(
  () => !!(piniaInfo().curPopupId && piniaInfo().curPopupId == uid),
);

const showTooltip = ref(false);

let timerTooltip;

let touchUsed: any = false;

const thisComp: any = ref(null);
const dropdownTrigger = ref<HTMLElement | null>(null);

// watch([piniaSelect(), piniaResize()], () => {
//   piniaInfo().curPopupId = "";
// });

watch(
  () => props.label,
  () => {
    // labelEdit.value = props.label || "";
    labelStr.value = props.label;
  },
);

watch(
  () => props.icon,
  () => {
    // labelEdit.value = props.label || "";
    myIcon.value = props.icon;
  },
);

// function testEvent(e) {
//   console.log(e);
// }

function displayTooltip(e) {
  timerTooltip = setTimeout(
    () => (showTooltip.value = !!(props.tooltip && !piniaInfo().curPopupId)),
    props.tooltipDelay || 200,
  );
}

function hideTooltip() {
  showTooltip.value = false;
  clearTimeout(timerTooltip);
}

function mapOption(opt: any) {
  return {
    ...opt,
    iconOrig: opt.icon,
    icon:
      opt.icon && renderIcon(opt.icon, opt.iconColor || opt.color, opt.size),
    label: opt.label && renderLabel(opt.label, opt.color),
    children: opt.children && [...opt.children.map(mapOption)],
    toolbarProps: {
      style: {
        fontWeight: props.checkOptSelected && props.checkOptSelected(opt.arg) ? 'bold' : 'normal',
      },
      onpointerdown: (e) => {
        // Keep the editor selection until a pointer-up option is applied.
        if (props.usePointerUp) {
          e.preventDefault();
          e.stopPropagation();
        } else processOptClick(e, opt);
      },
      onpointerup: props.usePointerUp? (e) => processOptClick(e, opt) : null,
    },
    onClick: null,
  };
}

function optionNodeProps(option: any) {
  // Naive UI does not forward option.props for children of a group.
  // Its shared node-props hook runs for grouped and ungrouped options alike.
  return option.toolbarProps;
}

function inputChangeEvt(val) {
  piniaInfo().setCurPopup("");
  // The input lives in an iframe that is removed when the popup closes.
  // Apply the committed value after that unmount so callbacks can restore
  // focus and selection in the parent editor without the iframe stealing it.
  nextTick(() => props.onInputChange && props.onInputChange(val));
}

function clickOutside(e) {
  const trigger = dropdownTrigger.value;
  const target = e.target;
  // Touch release can target any descendant (or the caption/wrapper), not
  // just NButton's root. Releasing the opening tap is still inside the trigger.
  if (trigger && (e.composedPath?.().includes(trigger) ||
      (target instanceof Node && trigger.contains(target)))) return;
  if (
    e.target !== dropDownInput.value &&
    e.button !== 2
  ) {
    piniaInfo().setCurPopup("");
  }
}

function clickItem(e: Event, cmd: any, arg: any) {
  if (props.disabled) return;
  e.stopPropagation();
  e.preventDefault();
  if (piniaInfo().curPopupId == uid) {
    piniaInfo().setCurPopup("");
    return;
  }
  touchUsed = false;
  // click the select box
  piniaInfo().setCurPopup(uid);
  showTooltip.value = false;
  if (props.onClick) {
    props.onClick(e);
  }
}

// function captureMouse(e) {
//   e.stopPropagation();
//   e.preventDefault();
// }

function renderIcon(icon: any, color?: any, size?: any) {
  return () => {
    return h(
      NIcon,
      { color, size: size || 25 },
      {
        default: () => h(icon),
      },
    );
  };
}

function renderLabel(label: any, color: any) {
  return () => {
    return h(
      "span",
      {
        style: {
          color,
          fontSize: "14px",
        },
      },
      [typeof label === "function" ? label() : label],
    );
  };
}

function processOptClick(e, selectedOpt) {
  if (selectedOpt.children) {
    selectedOpt.onOpen?.(e);
    e.preventDefault();
    e.stopPropagation();
    return;
  }
  if (selectedOpt.disabled) return;
  if (selectedOpt.disableEvent) return;
  if (selectedOpt.icon && props.displaySelectedIcon) {
    myIcon.value = selectedOpt.icon;
  }
  if (selectedOpt.label && props.displaySelectedLabel) {
    labelStr.value = selectedOpt.label;
  }

  if (selectedOpt.onClick) selectedOpt.onClick(e);

  // Permission requests can update the open submenu after they complete.
  if (!selectedOpt.keepOpen) piniaInfo().setCurPopup("");

  e.preventDefault();
  e.stopPropagation();
}

</script>

<style>
.n-button * {
  pointer-events: none;
}

.n-dropdown-menu {
  box-shadow:
    0 3px 6px -4px rgba(0, 0, 0, 0.12),
    0 6px 16px 0 rgba(0, 0, 0, 0.4),
    0 9px 28px 8px rgba(0, 0, 0, 0.25);
}

.n-dropdown-menu .n-dropdown-option {
  margin: 2px 0;
}

.n-dropdown-menu .n-dropdown-option * {
  user-select: none;
}

.n-dropdown-menu .n-dropdown-option .n-dropdown-option-body {
  gap: 8px;
  margin: 0 5px;
}

/* Override Naive UI's more-specific group rules, including when injected later. */
.n-dropdown-menu .n-dropdown-option-body--group .n-dropdown-option-body__prefix {
  width: var(--n-option-prefix-width) !important;
}

.n-dropdown-menu .n-dropdown-option-body--group .n-dropdown-option-body__prefix--show-icon {
  width: var(--n-option-icon-prefix-width) !important;
}

.labelInput {
  pointer-events: all;
}
</style>

<style scoped>
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
  cursor: pointer;
}

.with-caption:hover {
  background: #d3fad4;
}

.with-caption.active {
  background: #d3fad4;
}
</style>
