<template>
  <!-- <NButton
    @pointerdown.stop="autoIncrement"
    @pointerup.stop="clickButton"
    :disabled="disabled"
    quaternary
    size="20"
    :style="{
      width: '25px',
      height: '26px',
      alignSelf: 'center',
    }"
  >
    <span>{{ label }}</span>
  </NButton> -->
  <ToolbarItem
    @pointerdown.stop="autoIncrement"
    @pointerup.stop="clickButton"
    :disabled="disabled"
    quaternary
    size="24"
    :style="{
      width: '25px',
      height: '26px',
      alignSelf: 'center',
    }"
    :tooltip
    :icon
  >

  </ToolbarItem>
</template>
<script setup>
import { NButton } from "naive-ui";
import ToolbarItem from "./ToolbarItem.vue";

const props = defineProps({
  label: String,
  step: Number,
  value: Number,
  update: Function,
  disabled: Boolean,
  tooltip: String,
  icon: Object,
});
let timer;

// watch([props], () => {
// //   if (timer) {
// //     clearTimeout(timer);
// //     timer = null;
// //   }
// });

function clickButton(e) {
  if (props.disabled) return;
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  const newVal = props.value + (props.step * 1.5 || 1);
  props.update(newVal, props);
  console.log(e);
  e.preventDefault();
}

function autoIncrement(e) {
  //   if (timer) {
  //   clearInterval(timer);
  //   timer = null;
  // }
  // timer = setInterval(() => {
  //   const newVal = props.value + (props.step * 1.5 || 1);
  //   props.update(newVal);
  //   console.log(e);
  //   // autoIncrement();
  // }, 200);
  // e.preventDefault();
}
</script>
