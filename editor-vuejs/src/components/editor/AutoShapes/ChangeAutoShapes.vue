<template>
  <DialogBase title="Change Shape" :icon="Shapes24Regular">
    <AutoShapes mode="change" />
  </DialogBase>
</template>

<script setup lang="ts">
import DialogBase from "@/components/common/Layouts/DialogBase.vue";
import { Shapes24Regular } from "@vicons/fluent";
import AutoShapes from "./AutoShapes.vue";
// import { watch } from "vue";
// import { piniaInfo, piniaSelect } from "@/lib/common/store.js";

// watch(
//   () => piniaSelect().selShpFormat?.id,
//   () => {
//     if (
//       piniaInfo().currentTaskPane == "changeAutoshapes" &&
//       piniaInfo().lastTaskPane
//     ) {
//       piniaInfo().setCurTaskPane(piniaInfo().lastTaskPane);
//     }
//   },
// );
</script>
