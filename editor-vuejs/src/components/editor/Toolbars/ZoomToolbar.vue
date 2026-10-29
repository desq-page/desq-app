<template>
  <n-slider
    :value="
      piniaResize().slideScale <= 1
        ? round(piniaResize().slideScale * 100)
        : round(100 + (piniaResize().slideScale - 1) * 20)
    "
    color="black"
    :min="10"
    :max="160"
    :style="{
      width: '120px',
      marginRight: '10px',
    }"
    :on-update-value="changeZoom"
    :format-tooltip="formatTooltip"
    placement="bottom"
    v-if="piniaResize().windowWidth >= 769"
  />
  <ToolbarItem
    quaternary
    :size="25"
    :onClick="(e) => setSlideScaleText('Fit')"
    tooltip="Fit To Window"
    :icon="PageFit24Regular"
  />
  <ToolbarItem
    quaternary
    :size="24"
    :onClick="(e) => setSlideScaleText('Wdt')"
    tooltip="Fit To Width"
    :icon="ScaleFit24Regular"
  />
</template>
<script setup lang="ts">
import { setSlideScaleText, getResizeSlideLeft, getResizeSlideTop } from "shared-vuejs/editor";

import { piniaResize } from "@/lib/common/store";
import { round } from "shared-vuejs/api/utility";
import { nextTick } from "vue";
import ToolbarItem from "./ToolbarItem.vue";
import { NSlider } from "naive-ui";

import { PageFit24Regular, ScaleFit24Regular } from "@vicons/fluent";

function changeZoom(value) {
  if (value > 100) value = (value - 100) * 5 + 100;
  const workcanvas = document.getElementById("workcanvas");
  const resize = piniaResize();
  const oldScale = resize.slideScale;
  const newScale = value / 100;
  const centerX = workcanvas
    ? workcanvas.scrollLeft + workcanvas.clientWidth / 2
    : 0;
  const centerY = workcanvas
    ? workcanvas.scrollTop + workcanvas.clientHeight / 2
    : 0;
  const slidePointX = (centerX - resize.slideLeft) / oldScale;
  const slidePointY = (centerY - resize.slideTop) / oldScale;

  setSlideScaleText(value + "%");
  nextTick(() => {
    requestAnimationFrame(() => {
      if (!workcanvas) return;

      workcanvas.scrollLeft =
        getResizeSlideLeft() + slidePointX * newScale - workcanvas.clientWidth / 2;
      workcanvas.scrollTop =
        getResizeSlideTop() + slidePointY * newScale - workcanvas.clientHeight / 2;
    });
  });
}

function formatTooltip(value: number) {
  if (value > 100) {
    return `Zoom ${(value - 100) * 5 + 100}%`;
  }
  return `Zoom ${value}%`;
}
</script>
