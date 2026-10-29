<template>
  <NButton text tag="a" :href="url" target="unsplash" @click="closeModal">
    <template #icon>
      <n-icon :size="22">
        <ArrowOutlineUpRight32Regular />
      </n-icon>
    </template>
    &nbsp;{{ title }}
  </NButton>
</template>
<script setup lang="ts">
import { piniaInfo } from "@/lib/common/store";
import { ArrowOutlineUpRight32Regular } from "@vicons/fluent";
import { NButton, NIcon } from "naive-ui";

defineProps({
  title: String,
  url: String,
});

function closeModal() {
  piniaInfo().openMediaOnline = false;
}
</script>
