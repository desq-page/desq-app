<script setup lang="ts">
import { getPendingCurrentTaskPaneProps } from "shared-vuejs/editor";

import DialogBase from "@/components/common/Layouts/DialogBase.vue";
import LocalMedia from "./LocalMedia.vue";
import { piniaInfo } from "@/lib/common/store";

const props = defineProps({
  clickFunc: Function,
})
</script>

<template>
  <DialogBase
    title="Uploaded Media"
    :backLink="piniaInfo().lastTaskPane || 'mediaPanel'"
  >
    <LocalMedia :clickFunc="getPendingCurrentTaskPaneProps()?.clickFunc"/>
  </DialogBase>
</template>
