<template>
  <template v-if="piniaSelect().selShpFormat?.tightWrap">
    <LayoutHeader label="Link Shape-aware textbox" />
    <select aria-label="Link Shape-aware textbox" :value="selectedLinkValue()" @change="setLinkedTextbox">
      <option value="">---select---</option>
      <option v-for="shp in getLinkable()" :key="`${shp.linkSlideId}:${shp.id}`" :value="JSON.stringify({ shapeId: shp.id, slideId: shp.linkSlideId })">
        {{ shp.linkSlideName }} · {{ shp.name || shp.id }}
      </option>
    </select>
  </template>
</template>
<script setup lang="ts">
import { getShapeDeep, updateShape, getSlideInfo } from "shared-vuejs/editor";

import { piniaSelect } from "@/lib/common/store";
import LayoutHeader from "@/components/common/Layouts/LayoutHeader.vue";
import { saveDexie } from "shared-vuejs/api/dbutils";

import { linkedSlides, textboxLinkId } from "shared-vuejs/api/linked-slides";
function setLinkedTextbox(e: Event) {
  const shp = getShapeDeep(piniaSelect().selShpFormat?.id);
  if (!shp) return;
  const value = (e.target as HTMLSelectElement).value;
  shp.linkedTextbox = value ? JSON.parse(value) : null;
  updateShape(shp);
  saveDexie();
}

function selectedLinkValue() {
  const link = piniaSelect().selShpFormat?.linkedTextbox;
  if (!link || link === true) return "";
  return JSON.stringify(typeof link === "string" ? { shapeId: link, slideId: getSlideInfo().id } : link);
}

function getLinkable() {
  const slides = linkedSlides.slides.size ? [...linkedSlides.slides.values()] : [getSlideInfo()];
  return slides.flatMap((slide, index) => (slide.shapes || [])
    .filter(shp => {
      if (!shp.tightWrap) return false;
      const sourceId = piniaSelect().selShpFormat?.id;
      const seen = new Set<string>();
      let candidate = shp;
      while (candidate) {
        if (candidate.id === sourceId || seen.has(candidate.id)) return false;
        seen.add(candidate.id);
        const next = textboxLinkId(candidate.linkedTextbox);
        candidate = next ? linkedSlides.find(next, candidate.linkedTextbox?.slideId)?.shape : undefined;
      }
      return true;
    })
    .map(shp => ({ ...shp, linkSlideId: slide.id, linkSlideName: slide.name || `Slide ${index + 1}` })));
}

</script>
