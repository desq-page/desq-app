<template>
  <div
    class="section"
    :class="{
      dialogSectionSelected: isSelected(item.value),
    }"
    v-for="item in items"
    :key="item.value"
    :title="item.tooltip"
    @click="setArrowStyle(item.value)"
  >
    <div class="dialogSectionContent dialogSectionListItem">
      <div class="dialogSectionContent dialogSectionListItem">
        {{ item.label }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { setStyles } from "shared-vuejs/api/selection";
import { piniaSelect } from "@/lib/common/store";

const props = defineProps({
  position: String,
});

const items = [
  { tooltip: "None", label: "(none)", value: 0 },
  {
    tooltip: "Arrow",
    value: 1,
    label: props.position == "head" ? "←" : "→",
  },
];

function isSelected(value) {
  if (props.position == "head") {
    return !!piniaSelect().selShpFormat?.ln?.headEnd?.$_type == !!value;
  } else if (props.position == "tail") {
    return !!piniaSelect().selShpFormat?.ln?.tailEnd?.$_type == !!value;
  }
}

function setArrowStyle(val) {
  if (props.position == "head") {
    // start
    setStyles("headEnd", val ? { type: "triangle" } : null);
  } else if (props.position == "tail") {
    setStyles("tailEnd", val ? { type: "triangle" } : null);
  }
}
</script>
<style scoped>
.section-container {
  display: block;
}

.section {
  cursor: pointer;
  display: inline-block;
  width: 100%;
  margin: 0 5px;
}

.section:hover {
  background: #efefef;
}

.sectionSelected {
  background: #dce9ef;
}
</style>
