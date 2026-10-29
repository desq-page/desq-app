<template>
  <div class="trans-cont">
    <n-radio
      :checked="!piniaSelect().selShpFormat?.ph"
      :value="0"
      name="basic-demo"
      @change="setPlaceholderType('')"
    >
      None
    </n-radio>
    <n-radio
      :checked="piniaSelect().selShpFormat?.ph?.$_type === 'title'"
      :value="0"
      name="basic-demo"
      @change="setPlaceholderType('title')"
    >
      Title
    </n-radio>
    <n-radio
      :checked="piniaSelect().selShpFormat?.ph?.$_type === 'ctrTitle'"
      :value="0"
      name="basic-demo"
      @change="setPlaceholderType('ctrTitle')"
    >
      Centered Title
    </n-radio>
    <n-radio
      :checked="piniaSelect().selShpFormat?.ph?.$_type === 'subTitle'"
      :value="3849"
      name="basic-demo"
      @change="setPlaceholderType('subTitle')"
    >
      Subtitle
    </n-radio>
    <n-radio
      :checked="piniaSelect().selShpFormat?.ph?.$_type === 'body'"
      :value="3849"
      name="basic-demo"
      @change="setPlaceholderType('body')"
    >
      Body
    </n-radio>
    <n-radio
      :checked="piniaSelect().selShpFormat?.ph?.$_type === 'content'"
      :value="3849"
      name="basic-demo"
      @change="setPlaceholderType('content')"
    >
      Content
    </n-radio>
    <n-radio
      :checked="piniaSelect().selShpFormat?.ph?.$_type === 'pic'"
      :value="3849"
      name="basic-demo"
      @change="setPlaceholderType('pic')"
    >
      Picture
    </n-radio>
    <n-radio
      :checked="piniaSelect().selShpFormat?.ph?.$_type === 'dt'"
      :value="3849"
      name="basic-demo"
      @change="setPlaceholderType('dt')"
    >
      Date Time
    </n-radio>
    <n-radio
      :checked="piniaSelect().selShpFormat?.ph?.$_type === 'sldNum'"
      :value="3849"
      name="basic-demo"
      @change="setPlaceholderType('sldNum')"
    >
      Page Number
    </n-radio>
    <n-radio
      :checked="piniaSelect().selShpFormat?.ph?.$_type === 'ftr'"
      :value="3849"
      name="basic-demo"
      @change="setPlaceholderType('ftr')"
    >
      Footer
    </n-radio>
  </div>
</template>
<script setup lang="ts">
import { getShapeInfo, updateShape, getSlideInfo } from "shared-vuejs/editor";

import { NRadio } from "naive-ui";
import { piniaSelect, piniaShapes } from "@/lib/common/store";
import { saveDexie } from "shared-vuejs/api/dbutils";

function setPlaceholderType(type) {
  const shpInfo = getShapeInfo(piniaSelect().selShpFormat?.id);
  if (type) {
    const idxCounter = {};
    getSlideInfo().shapes.forEach((shp) => {
      if (shp.ph && shp.id !== piniaSelect().selShpFormat?.id) {
        idxCounter[shp.ph] = (idxCounter[shp.ph] ?? -1) + 1;
        shp.phidx = idxCounter[shp.ph];
      }
    });

    shpInfo.phidx = (idxCounter[type] ?? -1) + 1;
    shpInfo.ph = type;
  } else {
    delete shpInfo.phidx;
    delete shpInfo.ph;
  }
  updateShape(shpInfo);
  saveDexie();
}
</script>
<style scoped>
.subtitle {
  margin-top: 10px;
  font-size: 14px;
  font-weight: bold;
}

.trans-cont {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 10;
}
</style>
