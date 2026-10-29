<template>
  <RangeSlider
    :value="
      piniaSelect().selShpFormat?.blipFill?.blip?.alphaModFix?.$_amt !== undefined
        ? round(piniaSelect().selShpFormat?.blipFill?.blip?.alphaModFix.$_amt / 1000)
        : 100
    "
    :on-input="updateOpacity"
    :on-change="saveOpacity"
    :style="{
      padding: '10px 20px 0 0px',
      width: '100%',
      height: '20px',
    }"
  />
</template>

<script setup lang="ts">
import { getShapeDeep, updateShape } from "shared-vuejs/editor";

// import { JxSlider } from "shared-vuejs/src/edlib/editor.sglib.js";
import { setStyles } from "shared-vuejs/api/selection";
import { onMounted } from "vue";
import RangeSlider from "@/components/common/RangeSlider.vue";
import { round3, round } from "shared-vuejs/api/utility";
import { piniaSelect } from "@/lib/common/store";

import { saveDexie } from "shared-vuejs/api/dbutils";

// const shpOpacity = ref(100);

function updateOpacity(opacity) {
  // setStyles("fx.opacity", round3(opacity / 100), true);
  const shp = getShapeDeep(piniaSelect().selShpFormat?.id)
  shp.blipFill.blip = {
    ...shp.blipFill.blip ,
    alphaModFix: {
      $_amt: round3(opacity * 1000)
    }
  }
  updateShape(shp);
}

function saveOpacity(opacity) {
  // setStyles("fx.opacity", round3(opacity / 100));
  saveDexie();
}

onMounted(() => {
  // var alphaDiv = this.renderRoot.querySelector("#selShapeTransparency");
  // g.jxAlphaSlider = new JxSlider({
  //   parent: alphaDiv.value,
  //   default: 100,
  //   label: "Opacity",
  //   onChange: function (val, noUndo) {
  //     setStyles("opacity", (val / 100).toFixed(2), noUndo);
  //   },
  // });
});
</script>
