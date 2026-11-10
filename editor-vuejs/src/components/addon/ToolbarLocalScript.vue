<template>
  <ToolbarItem
    caption="Local JavaScript…"
    :icon="Code24Regular"
    :size="30"
    :color="g.themeOverrides?.common?.primaryColor"
    :onClick="() => scriptDialogOpen = true"
  />
  <ScriptCodeDialog v-if="scriptDialogOpen" v-model:show="scriptDialogOpen" />
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Code24Regular } from '@vicons/fluent';
import g from 'shared-vuejs/api/global';
import ToolbarItem from '../editor/Toolbars/ToolbarItem.vue';
import ScriptCodeDialog from '../editor/Dialogs/ScriptCodeDialog.vue';

const scriptDialogOpen = ref(false);
</script>
