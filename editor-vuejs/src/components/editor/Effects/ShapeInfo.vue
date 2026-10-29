<template>
  <!-- <SelectionToolbar /> -->
  <LayoutHeader label="Shape Name" />
  <div class="field-info">
    <input
      :value="piniaSelect().selShpFormat?.name"
      @change="(e) => updateField(e, 'name')"
      style="width: 100%"
    />
  </div>
  <LayoutHeader label="Dimensions" />
  <div class="field-info">
    <span>Left:</span>
    <input
      class="dim-field"
      :value="round(piniaSelect().selShpFormat?.x)"
      @change="(e) => updateField(e, 'x')"
    />
  </div>
  <div class="field-info">
    <span>Top:</span>
    <input
      class="dim-field"
      :value="round(piniaSelect().selShpFormat?.y)"
      @change="(e) => updateField(e, 'y')"
    />
  </div>
  <div class="field-info">
    <span>Width:</span>
    <input
      class="dim-field"
      :value="round(piniaSelect().selShpFormat?.w)"
      @change="(e) => updateField(e, 'w')"
    />
  </div>
  <div class="field-info">
    <span>Height:</span>
    <input
      class="dim-field"
      :value="round(piniaSelect().selShpFormat?.h)"
      @change="(e) => updateField(e, 'h')"
    />
  </div>
  <div class="field-info">
    <span>Rotation:</span>
    <input
      class="dim-field"
      :value="round(piniaSelect().selShpFormat?.rot || 0)"
      @change="(e) => updateField(e, 'rot')"
    />
  </div>
  <LayoutHeader label="Text Wrap" />
  <div class="field-info">
    <span>Wrap:</span>
    <select 
    @change="(e) => updateField(e, 'wrapText')" 
    :value="piniaSelect().selShpFormat?.wrapText || 'none'">
      <option value="none">None</option>
      <option value="tight">Tight</option>
      <option value="square">Square</option>
      <option value="inline">Inline with Text</option>
      <option value="topbottom">Top & Bottom</option>
    </select>
  </div>
</template>
<script setup lang="ts">
import { getShapeDeep, updateShape, getSelectSelGrpShps, getSelectSelShps } from "shared-vuejs/editor";

// import { applyShadow } from "shared-vuejs/api/layout";
// import ShapeSize from "./ShapeSize.vue";
import { piniaSelect, piniaShapes } from "@/lib/common/store";
import { round } from "shared-vuejs/api/utility";
import { saveDexie } from "shared-vuejs/api/dbutils";
import { resizeShape } from "shared-vuejs/api/draw";
import LayoutHeader from "@/components/common/Layouts/LayoutHeader.vue";


defineProps({
  backLink: String,
});

function updateField(e, f) {
  if (e.target.value) {
    let selShps;
    if (getSelectSelGrpShps().length > 0) {
      selShps = Array.from(getSelectSelGrpShps()).map((selShp) =>
        getShapeDeep(selShp),
      );
    } else {
      selShps = Array.from(getSelectSelShps()).map((selShp) =>
        getShapeDeep(selShp),
      );
    }

    selShps.forEach((shp) => {
      // if (f == "cont") {
      //   shp[f] = e.target.checked;
      // } else
      if (f == "name" || f == "wrapText") {
        shp[f] = e.target.value;
      } else if (f == "x" || f == "y") {
        shp[f] = +e.target.value;
      } else {
        let xscale = 1;
        let yscale = 1;
        if (f == "w") {
          xscale = e.target.value / shp.w || 1;
        } else if (f == "h") {
          yscale = e.target.value / shp.h || 1;
        }
        resizeShape(shp, null, xscale, yscale);
      }
      updateShape(shp);
    });

    saveDexie();
  }
}
</script>
<style scoped>
.field-info {
  display: flex;
  justify-content: space-between;
  margin: 10px 0;
}

.field-info input {
  border: none;
  outline: none;
}
.dim-field {
  text-align: right;
  width: 50px;
}
</style>
