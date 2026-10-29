<template>
  <DialogBase title="Insert Autoshapes" :icon="Shapes24Regular">
    <AutoShapes mode="insert" />
  </DialogBase>
</template>

<script setup lang="ts">
import DialogBase from "@/components/common/Layouts/DialogBase.vue";
import { Shapes24Regular } from "@vicons/fluent";
import AutoShapes from "./AutoShapes.vue";
</script>
