<template>
  <!--iframe source in public folder-->
  <iframe
    class="labelInput"
    ref="inputRef"
    :style="{
      width: '40px',
      height: '25px',
      border: 'none',
      pointerEvents: disabled ? 'none' : 'all',
      backgroundColor: 'white',
    }"
    :srcdoc="inputHTML"
    @load="initInputbox"
    @beforeunload="removeListener"
    :disabled
  >
  </iframe>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
//@ts-ignore //?raw to import assets as string
import inputHTML from "./input.html?raw";

const props = defineProps({
  value: [String, Number],
  inputAttr: Object,
  onChange: Function,
  onInput: Function,
  disabled: Boolean,
  autofocus: Boolean,
});

const inputRef = ref(null as any);

watch([() => props.value, () => props.disabled], (newVal, oldVal) => {
  // console.log(newVal, oldVal)
  inputRef.value?.contentWindow?.updateValue?.(props.value, props.disabled);
});

let listener;

function updateInputViaIframeMsg(e) {
  if (inputRef.value == null) {
    removeListener();
  } else {
    const src: any = e.source;
    // if (src?.location?.href.includes("components/dropdown/input.html")) {
    if (src === inputRef.value?.contentWindow) {
      if (e.data.evt == "change") {
        if (props.onChange) props.onChange(e.data.val);
      }
      if (e.data.evt == "input") {
        if (props.onInput) {
          props.onInput?.(e.data.val);
        }
      }
    }
  }
}

function removeListener() {
  window.removeEventListener("message", updateInputViaIframeMsg);
  listener = null;
}

function initInputbox() {
  inputRef.value?.contentWindow?.initValue?.(
    props.value,
    props.autofocus,
    props.disabled,
  );
  if (props.inputAttr) {
    inputRef.value?.contentWindow?.setAttr?.(props.inputAttr);
  }
  if (!listener) {
    window.addEventListener("message", updateInputViaIframeMsg);
    listener = true;
  }
}
</script>

<style>
.labelInput {
  pointer-events: all;
}
</style>
