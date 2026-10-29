<template>
  <DialogBase title="Animation List" backLink="animations">
    <NCollapse accordion style="margin-top: 20px">
      <NCollapseItem
        v-for="grp in groupItems"
        :title="grp.label"
        :name="grp.value"
        :key="grp.value"
        :icon="grp.icon"
        :color="grp.color"
      >
        <template #arrow>
          <NIcon :size="25" :color="grp.color">
            <component :is="grp.icon"></component>
          </NIcon>
        </template>
        <template #header>
          <span :style="{ color: grp.color, fontWeight: 'bold' }">{{
            grp.label
          }}</span>
        </template>
        <NList hoverable>
          <NListItem
            v-for="item in mapItems(grp.value)"
            :key="item.value"
            @click="() => itemClick(item)"
            :style="{ cursor: 'pointer', padding: '5px' }"
          >
            <span :style="{ color: grp.color }">{{ item.label }}</span>
          </NListItem>
        </NList>
      </NCollapseItem>
    </NCollapse>
  </DialogBase>
</template>

<script setup lang="ts">

import DialogBase from "@/components/common/Layouts/DialogBase.vue";
// import ComboBox from "@/components/common/ComboBox.vue";
import defAnimList from "./arrAnimList";

import { NCollapse, NCollapseItem, NIcon, NList, NListItem } from "naive-ui";
import {
  StarArrowRightEnd24Regular,
  StarArrowRightStart24Regular,
  StarEdit24Regular,
  StarEmphasis24Regular,
} from "@vicons/fluent";
import { PlayCircleOutlineOutlined } from "@vicons/material";
import { addEffect } from "./addAnimation";


const groupItems = [
  {
    label: "Entrance",
    value: "0",
    icon: StarArrowRightStart24Regular,
    color: "green",
  },
  {
    label: "Emphasis",
    value: "1",
    icon: StarEmphasis24Regular,
    color: "#FFA500",
  },
  { label: "Exit", value: "2", icon: StarArrowRightEnd24Regular, color: "red" },
  {
    label: "Motion Paths",
    value: "3",
    icon: StarEdit24Regular,
    color: "purple",
  },
  {
    label: "Media & Button",
    value: "4",
    icon: PlayCircleOutlineOutlined,
    color: "blue",
  },
  // { label: "Group", value: "5", },
];

// const items = ref(mapItems(0));

// function groupClick(grp) {
//   items.value = mapItems(grp.value);
// }

function mapItems(m) {
  return Object.keys(defAnimList[m]).map((key) => {
    const item = defAnimList[m][key];
    return {
      label: (m == 3 ? "Add " : "") + item.l,
      // imgCls: item.i,
      options: { grp: m, d: item.d, id: key },
      value: key,
    };
  });
}

function itemClick(item) {
  if (item.options) {
    if (item.options.grp != 3) {
      addEffect(item.options.grp, item.options.id);
    } else {
      addEffect(item.options.grp, item.options.id, item.options.d);
      // piniaInfo().curMode = "drawMotion";
      // piniaInfo().curCmd = item.options.d;
      // gid("workcanvas").style.cursor = "crosshair";
      // showMessage("Drag to draw motion path", 1000);
    }
  }
}

</script>
