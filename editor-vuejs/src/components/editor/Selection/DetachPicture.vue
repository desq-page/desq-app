<script setup lang="ts">
import { piniaSelect } from "@/lib/common/store";
import ToolbarItem from "../Toolbars/ToolbarItem.vue";
import { HideImageOutlined } from "@vicons/material";
import { detachImageBackground } from "shared-vuejs/api/selection";
import g from "shared-vuejs/api/global";

</script>

<template>
  <ToolbarItem
    quaternary
    v-if="piniaSelect().selShpFormat?.blipFill"
    label="Detach Picture"
    labelGap="15px"
    :icon="HideImageOutlined"
    :size="30"
    :color="g.themeOverrides?.common?.primaryColor"
    n-padding="0"
    :disabled="piniaSelect().selShpFormat?.type == 'image'"
    :onClick="
      () => {
        detachImageBackground();
      }
    "
  />
</template>

<style scoped>
hr {
  border-top: 1px solid #ccc;
}
</style>
