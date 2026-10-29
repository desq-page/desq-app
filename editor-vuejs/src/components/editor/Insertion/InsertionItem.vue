<template>
  <div
    :class="[
      $style.container,
      piniaInfo().currentTaskPane == taskpane ? $style.active : '',
    ]"
    :style="{
      width: width || piniaResize().windowWidth < 769 ? '50px' : '80%',
    }"
    @click="setMenu()"
    @pointerover="checkShowTooltip"
    @pointerout="showTooltip = false"
    @pointerleave="showTooltip = false"
  >
    <NTooltip
      :show="showTooltip"
      trigger="manual"
      placement="right"
      :keep-alive-on-hover="false"
    >
      <template #trigger>
        <div :class="[$style.icon]">
          <n-icon size="30">
            <component :is="icon" />
          </n-icon>
        </div>
      </template>
      <span>{{ tooltip }}</span>
    </NTooltip>
    <div :class="$style.label" v-if="piniaResize().windowWidth > 1024">
      {{ label }}
    </div>
  </div>
</template>
<script setup>
import { NIcon, NTooltip } from "naive-ui";
import { useCssModule, ref } from "vue";
import { piniaInfo, piniaResize } from "@/lib/common/store";
import { toggleTaskPane } from "@/lib/main/utils";

const $style = useCssModule();

const props = defineProps({
  label: String,
  icon: Object,
  taskpane: String,
  classStr: String,
  tooltip: String,
  disabled: Boolean,
  width: String,
  onClick: Function,
});

const showTooltip = ref(false);

function checkShowTooltip() {
  // SEEM DISTRACTING!!!
  // if (!piniaInfo().currentTaskPane) {
  //   showTooltip.value = true;
  // } else {
  showTooltip.value = false;
  // }
}
function setMenu() {
  if (props.disabled) return;
  if (props.onClick) {
    props.onClick();
  } else {
    toggleTaskPane(props.taskpane);
    showTooltip.value = false;
  }
}
</script>

<style module>
.container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  border-radius: 3px;
  padding: 0px 0 0px 0px;
  cursor: pointer;
  color: rgb(40, 40, 40);
  margin-left: 6px;
  border: 1px solid transparent;
}

.active,
.container.active:hover {
  background: white;
  color: green;
  border: 1px solid green;
}
.container:hover {
  background: #d3fad4;
}

.icon {
  display: flex;
  justify-content: center;
  margin-top: 4px;
}

.label {
  display: flex;
  justify-content: center;
  font-size: 10px;
  margin: 2px 0 5px 0;
}
</style>
<style>
/* .InsertShapes {
  position: relative;
}
.InsertShapes::after {
  content: "+";
  position: absolute;
  background: black;
  border-radius: 50%;
  width: 15px;
  height: 15px;
  color: white;
  left: calc(50% - 20px);
  top: 0px;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 10px;
  text-align: center;
} */
</style>
