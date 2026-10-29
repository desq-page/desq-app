<template>
  <ToolbarItem
    quaternary
    :icon="TabArrowLeft24Regular"
    :size="30"
    :color="g.themeOverrides.common.primaryColor"
    :onClick="
      () => {
        deselectAll();
        setInfoUseGrid('');
        showMessage(null);
      }
    "
    caption="Original Layout"
  />

  <ToolbarItem
    quaternary
    :icon="SlideSize24Regular"
    :size="30"
    :onClick="
      () => {
        deselectAll();
        toggleTaskPane('sizingpanel');
      }
    "
    caption="Manage Variants..."
  />
  <ToolbarItemDropdown
    quaternary
    :icon="PhoneEraser16Regular"
    caption="Clear Changes"
    :options="[
      {
        label: 'Reset selected shape',
        key: 'reset1',
        onClick: (e) => {
          const shapes = getSelectSelShps().map((selShp) =>
            getShapeDeep(selShp),
          );
          resetGrid(shapes);
        },
        disabled: piniaSelect().selShps.length == 0,
      },
      {
        label: 'Reset all shapes',
        key: 'reset2',
        color: 'red',
        onClick: (e) => {
          resetGrid(getSlideInfo().shapes);
        },
      },
    ]"
    :disabled="piniaInfo().currentTaskPane == 'animations'"
    tooltip="Reset to Original Layout"
  />
  <ToolbarItem type="divider" />
    <ToolbarItem
    quaternary
    :icon="Crop24Filled"
    :size="26"
    :onClick="
      (e) => {
        if (getSelectCropShp()) {
          // piniaSelect().cropShp = '';
          deactivateCropImage();
        } else {
          // piniaSelect().cropShp = selShpFormat.id;
          activateCropImage();
        }
      }
    "
    :disabled="!showCrop()"
    caption="Crop"
    :active="!!piniaSelect().cropShp"
  />
  <span class="text-label">Font Scale</span>
  <ToolbarItemDropdown
    :label="
      piniaSelect().selShpFormat?.grid?.[piniaInfo().useGrid]?.fontScaleGrid ||
      1
    "
    :options="
      [
        0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9,
        2.0,
      ].map((k) => ({
        label: k,
        value: k,
        key: k,
        onClick: () => updateFontScale(k),
      }))
    "
    button-type="default"
    :select-on-pointerdown="true"
    v-if="piniaInfo().useGrid"
    :disabled="!piniaSelect().selShpFormat?.txBody"
  />
</template>

<script setup lang="ts">
import { getShapeDeep, updateShape, getInfoUseGrid, getSelectCropShp, getSelectSelShps, getSlideAnimations, getSlidesSlideId, getSlideInfo, setInfoUseGrid } from "shared-vuejs/editor";

import { piniaInfo, piniaSelect } from "@/lib/common/store";
import { computed, nextTick } from "vue";
import ToolbarItemDropdown from "./ToolbarItemDropdown.vue";
import { Crop24Filled, PhoneEraser16Regular, SlideSize24Regular, TabArrowLeft24Regular } from "@vicons/fluent";
import { deselectAll } from "shared-vuejs/api/handle";
import { saveDexie } from "shared-vuejs/api/dbutils";
import { selectSlide } from "shared-vuejs/api/slide";
import ToolbarItem from "./ToolbarItem.vue";
import { activateCropImage, deactivateCropImage, showMessage } from "shared-vuejs/api/utils";


import g from "shared-vuejs/api/global.js";
import { toggleTaskPane } from "@/lib/main/utils.js";
import { showCrop } from "./ToolbarUtils.js";

const hasGridChanges = computed(() => {
  if (piniaInfo().useGrid) {
    return getSlideInfo().shapes.find((shp) => {
      const gridData = shp.grid?.[piniaInfo().useGrid];
      return (
        gridData?.x ||
        gridData?.y ||
        gridData?.w ||
        gridData?.h ||
        gridData?.d ||
        gridData?.rot ||
        gridData?.rows ||
        gridData?.cols
      );
    });
  }
  return false;
});

async function resetGrid(shapes) {
  // const slideInfo = piniaSlides().slideInfo;
  shapes.forEach((shp) => {
    shp.grid = {
      ...shp.grid,
      [getInfoUseGrid()]: null,
    };
    // search anim also
    let anims =
      getSlideAnimations()?.m?.filter((anim) => anim.sh == shp.id) || [];
    getSlideAnimations()?.i?.forEach((iAnim) => {
      anims = anims.concat(iAnim?.ef?.filter((eff) => eff.sh == shp.id) || []);
    });
    anims.forEach((eff) => {
      if (eff && eff.bh?.[0]?.grid) {
        delete eff.bh?.[0]?.grid;
      }
    });
    
    if (shp.children) {
      resetGrid(shp.children);
    }

    updateShape(shp);
  });
  await saveDexie();
  nextTick(() => {
    // rebuildShapeGrid();
    selectSlide(getSlidesSlideId(), true);
  });
}

function updateFontScale(val) {
  const useGrid = getInfoUseGrid();
  if (useGrid) {
    getSelectSelShps().forEach((shpId) => {
      const shp = getShapeDeep(shpId);
      if (shp) {
        shp.grid = {
          ...shp.grid,
          [useGrid]: {
            ...shp.grid?.[useGrid],
            fontScaleGrid: val,
          },
        };
        updateShape(shp);
      }
    });
    saveDexie();
    return;
  }
}
</script>
<style scoped>
.text-label {
  font-size: 14px;
  white-space: nowrap;
  margin-right: 10px;
}
</style>
