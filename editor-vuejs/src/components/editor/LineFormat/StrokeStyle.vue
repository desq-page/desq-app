<template>
  <div class="section-container">
    <div
      class="section"
      :class="{
        sectionSelected:
          item.type == piniaSelect().selShpFormat?.ln?.prstDash?.$_val ||
          (!piniaSelect().selShpFormat?.ln?.prstDash?.$_val &&
            item.type == 'solid'),
      }"
      v-for="item in items"
      :key="item.type"
      :title="item.type"
      @click="setStrokeStyle(item.type)"
    >
      <div class="dialogSectionContent dialogSectionListItem">
        <svg
          pointer-events="none"
          width="120"
          height="25"
          preserveAspectRatio="none"
          :type="item.type"
        >
          <path
            stroke="rgb(38,172,222)"
            stroke-opacity="1"
            fill="none"
            fill-opacity="0"
            stroke-width="2"
            :stroke-dasharray="item.dash || null"
            d="M0,14L120,14"
          ></path>
        </svg>
      </div>
    </div>
  </div>
</template>

<script setup>
import { setStyles } from "shared-vuejs/api/selection";
import { piniaSelect } from "@/lib/common/store";

defineProps({
  onChange: Function,
});

// const items = [
//   { tooltip: "Solid", value: "0" },
//   {
//     tooltip: "Small Dot",
//     value: "5,5",
//   },
//   {
//     tooltip: "Tiny Dots",
//     value: "1,5",
//   },
//   {
//     tooltip: "Small Dash",
//     value: "10,5",
//   },
//   {
//     tooltip: "Dash Dot",
//     value: "15,10,5,10",
//   },
//   {
//     tooltip: "Long Dash",
//     value: "15,5",
//   },
// ];

const items = [
  {
    type: "solid",
    dash: "0",
  },
  {
    type: "dash",
    dash: "5",
  },
  {
    type: "dashDot",

    dash: "5,5,1,5",
  },
  {
    type: "dot",

    dash: "1,5",
  },
  {
    type: "lgDash",
    dash: "10,5",
  },
  {
    type: "lgDashDotDot",
    dash: "10,5,1,5,1,5",
  },
  {
    type: "sysDash",
    dash: "5,2",
  },
  {
    type: "sysDashDot",
    dash: "5,2,1,5",
  },
  {
    type: "sysDashDotDot",
    dash: "5,2,1,5,1,5",
  },
  {
    type: "sysDot",
    dash: "2,5",
  },
];

function setStrokeStyle(val) {
  setStyles("dashStyle", val /*.split(",")*/);
}
</script>

<style scoped>
.section-container {
  display: block;
}

.section {
  cursor: pointer;
  display: inline-block;
  width: 40%;
  margin: 0 5px;
}

.section:hover {
  background: #efefef;
}

.sectionSelected {
  background: #dce9ef;
}
</style>
