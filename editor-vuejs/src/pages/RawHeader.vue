<template>
  <div v-html="updatedHeaderHTML"></div>
</template>
<script setup lang="ts">
import { ref } from "vue";
import headerHTML from "../content/header.html?raw";

const props = defineProps({
  path: String,
});

const updatedHeaderHTML = ref("");

const headerPath = props.path; //== "/" ? "/home" : props.path;

updatedHeaderHTML.value = headerHTML.replace(
  `href="${headerPath}"`,
  `href="${headerPath}" class="disabled"`,
);
</script>
