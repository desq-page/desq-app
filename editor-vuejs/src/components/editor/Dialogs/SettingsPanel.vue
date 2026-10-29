<template>
  <DialogBase title="File Settings" :icon="Settings">
    <LayoutHeader label="File Title"></LayoutHeader>
    <FileProperties />
  </DialogBase>
</template>
<script setup lang="ts">
// import DialogBase from "@/components/common/Layouts/DialogBase.vue";
import FileProperties from "./FileProperties.vue";
import LayoutHeader from "@/components/common/Layouts/LayoutHeader.vue";

import DialogBase from "@/components/common/Layouts/DialogBase.vue";
import { Settings } from "@vicons/carbon";

</script>
