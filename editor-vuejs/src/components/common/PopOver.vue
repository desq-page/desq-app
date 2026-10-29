<template>
  <Teleport to="body">
    <div
      class="sgFlyout sgFlyoutRoundBorder sgFlyoutBottomLeft"
      style="transform: translateZ(0px); z-index: 18000"
      :style="{
        width: `${width}px`,
        height: `${height}px`,
        left: `${left}px`,
        top: `${top}px`,
      }"
      ref="popover"
      v-if="show"
    >
      <div
        class="sgFlyoutContent sgFlyoutRoundBorder"
        style="top: 4px; height: 470px"
      >
        <div
          class="sgDialogOuter"
          style="z-index: 2; overflow: hidden; top: 0px; left: 0px"
          :style="{
            width: `${width}px`,
            height: `${height - 10}px`,
          }"
        >
          <div
            class="sgDialog"
            style="visibility: visible; transform: translate3d(0px, 0px, 0px)"
            :style="{
              width: `${width}px`,
              height: `${height - 10}px`,
            }"
          >
            <div class="sgDialogClose" style="visibility: hidden"></div>
            <div
              class="sgDialogContentContainer unselectable"
              style="position: relative"
              :style="{
                width: `${width}px`,
                height: `${height - 10}px`,
              }"
            >
              <div class="popupPanel sgDialogContent">
                <slot></slot>
              </div>
              <div
                style="
                  left: 0px;
                  top: 0px;
                  position: absolute;
                  z-index: 999999;
                  display: none;
                "
                :style="{ width: `${width}px`, height: `${height - 10}px` }"
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
<script setup>
import { onClickOutside } from "@vueuse/core";

import { ref, watch } from "vue";

const emit = defineEmits(["closePopover"]);

var props = defineProps({
  show: Boolean,
  el: Object,
});

const height = 480;
const width = 250;

const popover = ref(null);
const left = ref(0);
const top = ref(0);

watch(
  () => props.el,
  () => {
    if (props.el) {
      // mapping dialog to the target
      const bound = props.el.getBoundingClientRect();
      left.value = Math.max(bound.left - width / 2, 20);
      top.value = bound.top - height - 10;
      if (props.show) {
        onClickOutside(popover.value, () => {
          emit("closePopover");
        });
      }
    }
  },
);
</script>
