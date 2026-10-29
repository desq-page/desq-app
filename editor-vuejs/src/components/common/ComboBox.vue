<template>
  <li
    class="sgToolItem"
    :class="{
      sgToolItemRight: props.right,
      sgToolItemGray: props.gray,
      sgDisabled: props.disabled,
    }"
    v-show="props.show"
    @click="showPop"
    @touchstart.passive="showPop"
    ref="selectBox"
  >
    <span class="sgButton sgButtonCombo" :title="props.tooltip || props.label">
      <img
        v-if="selectedItem.imgCls"
        class="sgButtonIcon"
        :class="selectedItem.imgCls"
        alt="Build Type"
      />
      <span
        class="sgButtonLabel sgButtonLabelAlignRight"
        style="margin-left: 5px; margin-right: 5px; overflow: hidden"
        >{{ selectedItem.label }}</span
      >
      <img src="" class="sgButtonTrigger" />
    </span>
    <Teleport to="body">
      <div
        class="sgMenu sgButtonLabelAlignRight"
        style="overflow-y: auto"
        :style="{ left, top }"
        ref="popover"
        tabindex="0"
        v-show="showState"
      >
        <div
          class="sgMenuItem"
          v-for="item in items"
          :key="item.label"
          @click="() => itemClick(item)"
        >
          <button class="sgButton">
            <img
              v-if="item.imgCls"
              src=""
              class="sgButtonIcon"
              :class="item.imgCls"
              alt="Build Type"
            />
            <span class="sgButtonLabel">{{ item.label }}</span>
          </button>
        </div>
      </div>
    </Teleport>
  </li>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { onClickOutside } from "@vueuse/core";

const props = defineProps({
  show: {
    type: Boolean,
    default: true,
  },
  right: Boolean,
  disabled: Boolean,
  gray: Boolean,
  label: String,
  tooltip: String,
  icon: String,
  onClick: Function,
  items: Array,
});

const showState = ref(false);
const popover = ref(null);
const selectBox = ref(null);

const selectedItem = ref({ label: props.label, icon: props.icon });

const left = ref("");
const top = ref("");

onMounted(() => {
  onClickOutside(popover.value, handleClickOutside);
});

function setPos() {
  var bounding = selectBox.value.getBoundingClientRect();
  left.value = bounding.left + "px";
  top.value = `${bounding.top + 40}px`;
}

async function showPop(e) {
  setPos();
  showState.value = true;
  e.stopPropagation();
}

function handleClickOutside() {
  showState.value = false;
}

function itemClick(item) {
  selectedItem.value = item;
  props.onClick && props.onClick(item);
  showState.value = false;
}
</script>

<style>
.sgMenuItem:hover {
  background: lightcyan;
}
</style>
