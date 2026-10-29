<template>
  <NSlider
    :value="val"
    :step="step || 1"
    :on-update:value="valueUpdated"
    :on-dragend="valueChanged"
    @touchstart.prevent
    :style="style"
    :marks="marks"
    :max="max"
    :min="min"
    :disabled="disabled"
    :show-tooltip="showTooltip"
    :placement="(tooltipPlacement as any) || undefined"
  />
</template>

<script setup lang="ts">
import { NSlider } from "naive-ui";
import { round3 } from "shared-vuejs/api/utility";
import { ref, watch } from "vue";

const props = defineProps({
  value: Number,
  onInput: Function,
  onChange: Function,
  style: Object,
  marks: Object,
  step: Number,
  max: Number,
  min: Number,
  disabled: Boolean,
  showTooltip: Boolean,
  tooltipPlacement: String,
});

const val = ref(round3(props.value) || 0);

watch(
  () => props.value,
  () => {
    val.value = round3(props.value) || 0;
  },
);

let valChanged = false;

function valueUpdated(val) {
  valChanged = true;
  if (props.onInput) props.onInput(val);
}

function valueChanged() {
  if (valChanged && props.onChange) {
    props.onChange(val.value);
    valChanged = false;
  }
}
</script>
