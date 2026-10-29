<script setup lang="ts">
import {  } from "shared-vuejs/editor";

import { piniaInfo } from "@/lib/common/store";

import { ArrowLeft24Filled } from "@vicons/fluent";
import { NButton, NButtonGroup, NIcon } from "naive-ui";
const props = defineProps({
  title: String,
  backLink: String,
});
</script>

<template>
  <NButtonGroup
    :style="{
      marginTop: '10px',
      marginLeft: '-15px',
    }"
  >
    <NButton
      type="primary"
      quaternary
      @click="
        () => {
          piniaInfo().setCurTaskPane(props.backLink || '');
        }
      "
    >
      <template #icon>
        <NIcon><ArrowLeft24Filled /></NIcon>
      </template>
    </NButton>
    <NButton type="primary"> {{ title }} </NButton>
  </NButtonGroup>
</template>
