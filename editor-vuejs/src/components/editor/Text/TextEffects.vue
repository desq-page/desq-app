<template>
  <DialogBase
    shapeOnly
    textOnly
    title="Format Text"
    :sub-tabbar-items="subTextTabbarItems"
  >
    <NFlex>
      <TextOutlinePanel />
      <LayoutHeader label="Text Shadow" />

      <ShadowComp target="text" />
      <LayoutHeader label="Glow" />
      <GlowComp target="text" />
      <LayoutHeader label="Reflection" />
      <ReflectionComp target="text" />
    </NFlex>
  </DialogBase>
</template>

<script setup lang="ts">
import DialogBase from "@/components/common/Layouts/DialogBase.vue";
import { piniaSelect } from "@/lib/common/store";
import LayoutHeader from "@/components/common/Layouts/LayoutHeader.vue";
import { NFlex } from "naive-ui";
import { watch } from "vue";
// import { hideTextToolbar } from "./ToolbarTextOptions.js";
import {
  // shapeTabbarItems,
  subTextTabbarItems,
} from "../Selection/ShapeTabbarOptions.js";
import ShadowComp from "../Effects/ShadowComp.vue";
import GlowComp from "../Effects/GlowComp.vue";
import ReflectionComp from "../Effects/ReflectionComp.vue";
import TextOutlinePanel from "./TextOutlinePanel.vue";
;

const props = defineProps({
  onChange: Function,
});

watch(
  [() => piniaSelect().selShpFormat, () => piniaSelect().editingInfo],
  getDefaultValues,
);

function getDefaultValues() {

}
</script>

<style scoped>
.subtitle {
  margin-top: 10px;
  margin-bottom: 5px;
  font-size: 14px;
  font-weight: bold;
}

.empty {
  padding-top: 20px;
}
.textcolor {
  padding: 0 20px;
}

/* .guide {
  font-size: 12px;
  color: #888;
} */
</style>
