<template>
  <ToolbarItemDropdown
    caption="Align"
    tooltip="Align"
    :icon="AlignLeft20Regular"
    :options="options"
    :disabled="!targets.length || !!piniaInfo().useGrid"
    use-pointer-up
  />
</template>

<script setup lang="ts">
import { computed } from "vue";
import {
  AlignBottom20Regular,
  AlignCenterHorizontal20Regular,
  AlignLeft20Regular,
  AlignCenterVertical20Regular,
  AlignRight20Regular,
  AlignSpaceEvenlyHorizontal20Regular,
  AlignSpaceEvenlyVertical20Regular,
  AlignTop20Regular,
} from "@vicons/fluent";
import { getFileInfo, getShapeInfo, getSlideInfo, updateShape } from "shared-vuejs/editor";
import { saveDexie } from "shared-vuejs/api/dbutils";
import { updateGroupBound } from "shared-vuejs/api/group";
import { getShapeBounds } from "shared-vuejs/api/utils";
import { round3 } from "shared-vuejs/api/utility";
import { piniaInfo, piniaSelect } from "@/lib/common/store";
import ToolbarItemDropdown from "./ToolbarItemDropdown.vue";

type Axis = "x" | "y";
type Alignment = "start" | "center" | "end" | "distribute";

function selectedShapes() {
  const { selGrpShps, selShps } = piniaSelect();
  const ids = selGrpShps.length ? selGrpShps : selShps;
  const shapes = ids.map(id => getShapeInfo(id)).filter(shape =>
    shape && !shape.locked && Number.isFinite(shape.x) && Number.isFinite(shape.y));
  const parentId = shapes[0]?.parentid;
  if (shapes.some(shape => shape.parentid !== parentId)) return [];
  if (parentId) {
    const parent = getShapeInfo(parentId);
    if (!parent || parent.locked || parent.container || parent.flexLayout) return [];
  }
  return shapes;
}

const targets = computed(selectedShapes);

function align(axis: Axis, alignment: Alignment) {
  if (piniaInfo().useGrid) return;
  const shapes = selectedShapes();
  const items = shapes.flatMap(shape => {
    const bounds = getShapeBounds(shape);
    const [start, end] = axis === "x" ? [bounds.left, bounds.right] : [bounds.top, bounds.bottom];
    return Number.isFinite(start) && Number.isFinite(end)
      ? [{ shape, start, end, size: end - start }]
      : [];
  });
  if (items.length < (alignment === "distribute" ? 3 : 1)) return;

  const parentId = items[0].shape.parentid;
  const dimension = axis === "x" ? "w" : "h";
  const slideDimension = axis === "x" ? "width" : "height";
  const frameSize = parentId
    ? getShapeInfo(parentId)?.[dimension]
    : getSlideInfo()?.[slideDimension] || getFileInfo()?.[slideDimension];
  const left = items.length === 1 ? 0 : Math.min(...items.map(item => item.start));
  const right = items.length === 1 ? frameSize : Math.max(...items.map(item => item.end));
  if (!Number.isFinite(right)) return;

  let changed = false;
  const place = (item: typeof items[number], position: number) => {
    const coordinate = round3(item.shape[axis] + position - item.start);
    if (coordinate === item.shape[axis]) return;
    updateShape({ id: item.shape.id, [axis]: coordinate });
    changed = true;
  };

  if (alignment === "distribute") {
    items.sort((a, b) => a.start - b.start);
    const gap = (right - left - items.reduce((sum, item) => sum + item.size, 0)) / (items.length - 1);
    let position = left;
    for (const item of items) {
      place(item, position);
      position += item.size + gap;
    }
  } else {
    const fraction = alignment === "start" ? 0 : alignment === "center" ? 0.5 : 1;
    for (const item of items) place(item, left + (right - left - item.size) * fraction);
  }

  if (changed) {
    if (parentId) updateGroupBound();
    saveDexie();
  }
}

function option(label: string, axis: Axis, alignment: Alignment, icon: object) {
  return {
    key: `${axis}-${alignment}`,
    label,
    icon,
    size: 20,
    disabled: targets.value.length < (alignment === "distribute" ? 3 : 1),
    onClick: () => align(axis, alignment),
  };
}

const options = computed(() => [
  {
    type: "group", key: "horizontal", label: "Horizontal",
    children: [
      option("Align to Left", "x", "start", AlignLeft20Regular),
      option("Align to Centre", "x", "center", AlignCenterHorizontal20Regular),
      option("Align to Right", "x", "end", AlignRight20Regular),
    ],
  },
  {
    type: "group", key: "vertical", label: "Vertical",
    children: [
      option("Align to Top", "y", "start", AlignTop20Regular),
      option("Align to Middle", "y", "center", AlignCenterVertical20Regular),
      option("Align to Bottom", "y", "end", AlignBottom20Regular),
    ],
  },
  {
    type: "group", key: "distribute", label: "Distribute",
    children: [
      option("Distribute Horizontally", "x", "distribute", AlignSpaceEvenlyHorizontal20Regular),
      option("Distribute Vertically", "y", "distribute", AlignSpaceEvenlyVertical20Regular),
    ],
  },
]);
</script>
