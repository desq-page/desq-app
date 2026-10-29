<template>
  <ToolbarItem
    quaternary
    :onClick="
      (e) => {
        if (
          piniaSelect().selShpFormat?.$_otag == 'pic' ||
          piniaSelect().selShpFormat?.ph?.$_type == 'pic'
        ) {
          toggleTaskPane('pictureoptions');
        } else {
          toggleTaskPane('shapefill');
        }
      }
    "
    :shp-old="{
      blipFill: piniaSelect().selShpFormat?.blipFill,
      gradFill: piniaSelect().selShpFormat?.gradFill,
      solidFill: piniaSelect().selShpFormat?.solidFill,
      ln: piniaSelect().selShpFormat?.ln,
      d: 'FR0,0,22,22',
      w: 22,
      h: 22,
      id: 'fillshp-tb',
    }"
    :icon="PaintBucket24Filled"
    caption="Format Shape"
    :size="26"
    :active="
      [
        'shapefill',
        'lineformat',
        'shapefx',
        'shapeoptions',
        'pictureoptions',
      ].includes(piniaInfo().currentTaskPane)
    "
    :disabled
  />
  <!-- <ToolbarItem
    quaternary
    :icon="LineStyle24Filled"
    :size="25"
    :onClick="
      (e) => {
        toggleTaskPane('lineformat');
      }
    "
    caption="Line Style"
    :active="piniaInfo().currentTaskPane == 'lineformat'"
    :disabled
  /> -->
</template>
<script setup lang="ts">
import { piniaInfo, piniaSelect } from "@/lib/common/store";
import { toggleTaskPane } from "@/lib/main/utils";
import ToolbarItem from "./ToolbarItem.vue";
import { PaintBucket24Filled } from "@vicons/fluent";
defineProps({
  caption: String,
  disabled: Boolean,
});
</script>
