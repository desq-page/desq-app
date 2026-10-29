<template>
  <ToolbarItem
    quaternary
    :icon="ArrowBackIosNewSharp"
    :onClick="
      () => {
        setSelectEditingPoint(-1);
      }
    "
    color="#FF0000"
    v-if="!piniaSelect().selShpFormat?.motionSh"
    caption="Exit Editing"
  />
  <ToolbarItem
    quaternary
    :icon="AddCircle20Filled"
    :class="{
      disabled: getSelectEditingPoint() == -1,
    }"
    :onClick="addPoint"
    color="#FF0000"
    caption="Add Point"
  />

  <ToolbarItem
    quaternary
    :icon="SubtractCircle20Filled"
    :class="{
      disabled:
        piniaSelect().editingPoint <= 0 ||
        piniaSelect().editingPoint == piniaSelect().totalEditingPoints - 1,
    }"
    :onClick="deletePoint"
    color="#FF0000"
    caption="Delete Point"
  />

  <ToolbarItem
    :icon="BezierCurveSquare12Filled"
    :class="{
      disabled: getSelectEditingPoint() <= 0,
    }"
    :onClick="() => toggleBezierPath()"
    color="#C6C60A"
    caption="Toggle Curve"
  />
</template>
<script setup lang="ts">
import { getSelectEditingPoint, setSelectEditingPoint } from "shared-vuejs/editor";

import { piniaSelect } from "@/lib/common/store";
import {
  AddCircle20Filled,
  BezierCurveSquare12Filled,
  SubtractCircle20Filled,
} from "@vicons/fluent";
import { ArrowBackIosNewSharp } from "@vicons/material";
import {
  addPoint,
  deletePoint,
  toggleBezierPath,
} from "shared-vuejs/api/pointEvents";
import ToolbarItem from "./ToolbarItem.vue";


// NOTE: use watch in ToolbarTop.vue to select menu
</script>
