<template>
  <n-modal :show="!!piniaInfo().loadingBar" :mask-closable="false">
    <div :class="$style.loading">
      <n-spin stroke="white" v-if="typeof piniaInfo().loadingBar == 'string'">
        <template #description>
          <span style="color: white" v-html="piniaInfo().loadingBar"></span>
        </template>
      </n-spin>
      <div v-else>
        <div
          :class="$style.progress"
          v-html="piniaInfo().loadingBar.desc"
        ></div>
        <n-progress
          :percentage="piniaInfo().loadingBar.pct"
          :show-indicator="false"
          :style="{ width: '40vw' }"
        >
        </n-progress>
      </div>
    </div>
  </n-modal>
</template>
<script setup lang="ts">
import { NModal, NSpin, NProgress } from "naive-ui";
import { piniaInfo } from "@/lib/common/store";
import { useCssModule } from "vue";
const $style = useCssModule();
</script>
<style module>
.loading {
  cursor: wait;
  width: 100vw;
  height: 100vh;
  background-color: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
}

.progress {
  text-align: center;
  color: white;
  margin-bottom: 10px;
}
</style>
