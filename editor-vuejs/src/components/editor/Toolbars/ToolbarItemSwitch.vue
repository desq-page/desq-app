<script setup lang="ts">
import { NButton, NSwitch, NTooltip } from "naive-ui";

defineProps({
  defaultVal: Boolean,
  onClick: Function,
  label: String,
  tooltip: String,
  disabled: Boolean,
});
</script>

<template>
  <NTooltip :disabled :show="!!tooltip">
    <template #trigger>
      <div class="switch-container">
        <NSwitch
          size="small"
          :value="defaultVal"
          :on-update:value="(val) => onClick && onClick(val)"
          style="margin: 0 12px 0 -6px"
          :disabled
        />
        <NButton
          class="label"
          text
          @click="() => onClick && onClick(!defaultVal)"
          :disabled
        >
          {{ label }}
        </NButton>
      </div>
    </template>
    <span>
      {{ tooltip }}
    </span>
  </NTooltip>
</template>

<style scoped>
.label {
  font-size: 14px;
  color: var(--n-primary-color);
}
.switch-container {
  padding: 10px 20px 10px 20px;
  width: 100%;
  margin-left: -15px;
  margin-right: 40px;
  margin-top: 10px;
  display: flex;
  align-items: center;
}

.switch-container:hover {
  background-color: #efefef;
}
</style>
