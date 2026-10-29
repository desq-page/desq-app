<template>
  <NModal
    v-model:show="piniaSlides().changeLayout"
    :on-update:show="(val) => setSlidesChangeLayout(val)"
    :mask-closable="true"
    preset="dialog"
    title="Change Page Layout"
    :closable="true"
    :style="{
      cursor: !disabled ? 'auto' : 'wait',
      width: '80vw',
      height: '80vh',
    }"
    class="layout-modal"
    :actionStyle="{
      justifyContent: 'center',
    }"
  >
    <template #icon>
      <NIcon><SlideLayout20Regular /></NIcon>
    </template>
    <div class="layout-container">
      <div
        v-for="thumb in thumbList"
        :key="thumb.id || genId()"
        @mousedown.stop="(e) => selectThumb(e, thumb.id)"
        class="layout-thumb"
        :title="thumb.title"
        :class="{
          selected: selectedLayout == thumb.id,
        }"
        draggable="false"
        :style="{
          left: thumb.master ? 0 : '30px',
          width: genThumbWidth(thumb) + 'px',
        }"
      >
        <div class="preview" :style="{ height: genThumbHeight(thumb) + 'px' }">
        <img
          :id="`thumb-${thumb.id}`"
          :src="thumbnailUrls[thumb.id] || genThumbUrl(thumb.id)"
          @load="onThumbnailLoad(thumb.id, $event)"
          @error="requestThumbnail(thumb.id)"
          :alt="thumb.title ? `${thumb.title} layout preview` : 'Layout preview'"
          :style="{
            width: genThumbWidth(thumb) + 'px',
            height: genThumbHeight(thumb) + 'px',
            cursor: 'pointer',
          }"
        />
        <div v-if="thumbnailErrors[thumb.id]" class="thumbnail-error">Preview unavailable</div>
        </div>
        <div class="slideTitle">
          {{ thumb.title }}
        </div>
      </div>
    </div>
    <template #action>
      <NButton type="primary" @click="changeLayout()">Apply layout</NButton>
    </template>
  </NModal>
</template>
<script setup lang="ts">
import { getSlidesSlideId, getFileInfo, getSlideInfo, setSlidesChangeLayout } from "shared-vuejs/editor";

import {
  piniaResize,
  // piniaInfo,
  // piniaResize,
  // piniaShapes,
  piniaSlides,
} from "@/lib/common/store";

import { NModal, NIcon, NButton } from "naive-ui";
import { SlideLayout20Regular } from "@vicons/fluent";
import { onBeforeUnmount, onMounted, ref } from "vue";
import { createLayoutThumbnailQueue } from "./layoutThumbnailQueue.mjs";
import {
  activeSlideHeight,
  activeSlideWidth,
  selectSlide,
} from "shared-vuejs/api/slide";
import { genId, nodeAsArray } from "shared-vuejs/api/utility";
import {
  genThumbUrl,
  loadSlideFromDexie,
  saveDexie,
  saveThumb,
} from "shared-vuejs/api/dbutils";
// import { traverseShapes } from "shared-vuejs/api/sharedMaster";

import { addPlaceholders } from "shared-vuejs/api/load";
import { deselectAll } from "shared-vuejs/api/handle";
import { Vlan } from "@vicons/carbon";

defineProps({
  disabled: Boolean,
});

const thumbList = ref([] as any);
const selectedLayout = ref("");
const thumbnailUrls = ref<Record<string, string>>({});
const thumbnailErrors = ref<Record<string, boolean>>({});
const documentId = getFileInfo().id;
const thumbnailQueue = createLayoutThumbnailQueue({
  generate: (id: string) => saveThumb(id, { timeoutMs: 60_000 }),
  onGenerated: (id: string) => {
    if (getFileInfo()?.id !== documentId) return;
    thumbnailUrls.value = { ...thumbnailUrls.value, [id]: `${genThumbUrl(id)}?v=${Date.now()}` };
  },
  onError: (id: string, error: unknown) => {
    if (getFileInfo()?.id !== documentId) return;
    console.warn("Could not generate layout preview", id, error);
    thumbnailErrors.value = { ...thumbnailErrors.value, [id]: true };
  },
});

function requestThumbnail(id: string) {
  if (getFileInfo()?.id === documentId) thumbnailQueue.request(id);
}

function onThumbnailLoad(id: string, event: Event) {
  // The resource worker returns a 1px transparent image for missing thumbnails.
  if ((event.target as HTMLImageElement).naturalWidth <= 8) requestThumbnail(id);
}

onBeforeUnmount(() => thumbnailQueue.dispose());

onMounted(() => {
  updateThumbList();
});

// watch([() => piniaSlides().changeLayout], () => {
//   // evry time this reopen, needs to update
//   if (piniaSlides().changeLayout) {
//     updateThumbList();
//   }
// });

async function updateThumbList() {
  const _thumbList = [] as any;
  const layouts = getFileInfo().layouts;

  for (let i = 0; i < layouts?.length; i++) {
    const layoutId = layouts[i].id;
    const layoutInfo = layouts[i];

    if (layoutInfo.parentid) {
      // only show layout not master
      if (layoutInfo && layoutInfo.parentid) {
        _thumbList.push({
          id: layoutInfo.id,
          parentid: layoutInfo.parentid,
          width: activeSlideWidth(),
          height: activeSlideHeight(),
          order: i + 1,
          title: layoutInfo.name && layoutInfo.name !== layoutInfo.id ? layoutInfo.name : layoutInfo.title || `Layout ${_thumbList.length + 1}`,
        });
      }
    }
  }

  selectedLayout.value = getSlideInfo().layoutid;

  thumbList.value = _thumbList;
  await Promise.all(_thumbList.map(async (thumb) => {
    try {
      const layout = await loadSlideFromDexie(documentId, thumb.id, "slideLayouts");
      const name = layout?.$_name || layout?.title;
      const displayed = thumbList.value.find((item) => item.id === thumb.id);
      if (name && displayed && getFileInfo()?.id === documentId) displayed.title = name;
    } catch (error) {
      console.warn("Could not load layout name", thumb.id, error);
    }
  }));
}

function genThumbWidth(thumb) {
  return piniaResize().THUMBWIDTH;
}
function genThumbHeight(thumb) {
  return (genThumbWidth(thumb) * thumb.height) / thumb.width;
}

function selectThumb(e: MouseEvent, id: string) {
  selectedLayout.value = id;
}

async function changeLayout() {
  deselectAll();
  // const textPhs = ["title", "ctrTitle", "subTitle", "body", "ftr"];
  const layoutInfo = getFileInfo().layouts.find(
    (lt) => lt.id == selectedLayout.value,
  );
  const layoutShapes = await loadSlideFromDexie(
    getFileInfo().id,
    selectedLayout.value,
    "slideLayouts"
  );

  const slideInfo = getSlideInfo()
  // change current slide layout
  slideInfo.layoutid = selectedLayout.value;
  slideInfo.bg = layoutInfo.bg;
  const sldMeta = getFileInfo().slides.find(sld => sld.id == slideInfo.id)
  sldMeta.layoutid = selectedLayout.value;

  const newshapes = addPlaceholders(layoutShapes);

  // go through layout shapes, and add
  newshapes.forEach((layoutSh, idx) => {
    let existing = slideInfo.shapes?.find( (shp) =>
      shp.ph && shp.ph.$_type == layoutSh.ph.$_type && (!layoutSh.ph.$_idx || layoutSh.ph?.$_idx == shp.ph.$_idx)
    )

    //title and ctrTitle is interchangeable
    if (!existing && layoutSh.ph.$_type == 'title') {
       existing = slideInfo.shapes.find((shp) => shp.ph?.$_type == 'ctrTitle')
    } else if (!existing && layoutSh.ph.$_type == 'ctrTitle') {
       existing = slideInfo.shapes.find((shp) => shp.ph?.$_type == 'title')
    }

    //body and content is interchangeable?
    if (!existing && layoutSh.ph.$_type == 'content') {
       existing = slideInfo.shapes.find((shp) => shp.ph && shp.ph?.$_type == 'body' && (!layoutSh.ph.$_idx || layoutSh.ph?.$_idx == shp.ph.$_idx))
    } else if (!existing && layoutSh.ph.$_type == 'body') {
       existing = slideInfo.shapes.find((shp) => shp.ph && shp.ph?.$_type == 'content' && (!layoutSh.ph.$_idx || layoutSh.ph?.$_idx == shp.ph.$_idx))
    }

    if (existing) {
      newshapes[idx] = {
        ...existing,
        ...layoutSh,
        txBody: {
          ...layoutSh.txBody,
          p: nodeAsArray(existing.txBody.p || []).map(p => ({
            ...layoutSh.txBody.p[0], //copy layout props
            r: p.r,
          }))
        }
      }
    }
  });
  // go through all shapes and change
  // const keepItems = slideInfo.shapes.filter(sh => !.ph && used[sh.id]);
  // for (let i = slideInfo.shapes.length - 1 ; i >= 0; i--) {
  //   const sh = slideInfo.shapes[i]
  //   if (sh.ph && !used[sh.id]) {
  //     slideInfo.shapes.splice(i, 1);
  //   }
  // }

  const noPhShapes = slideInfo.shapes.filter(sh => !sh.ph);

  slideInfo.shapes = [...newshapes, ...noPhShapes];
  await saveDexie();

  selectSlide(getSlidesSlideId(), true);
  setTimeout(() => {
    saveThumb();
  }, 1000);
  setSlidesChangeLayout(false);
  piniaSlides().changeLayout = false;
}
</script>
<style scoped>
.layout-container {
  display: block;
  width: 100%;
}

.layout-modal {
  width: calc(100vw - 40px);
  height: calc(100vh - 40px);
  max-width: calc(100vw - 40px);
}

.layout-thumb {
  border: 1px solid #ccc;
  margin: 10px;
  display: inline-block;
  position: relative;
  vertical-align: top;
}
.preview { position: relative; }
.layout-thumb img {
  display: block;
  width: 100%;
  height: 100%;
}
.selected {
  outline: 2px solid red;
  outline-offset: 2px;
}

.thumbnail-error {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: #66736a;
  background: #f4f6f2;
  font-size: 11px;
}

.slideTitle {
  box-sizing: border-box;
  font-size: 12px;
  padding: 5px 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

</style>
<style>
.layout-modal .n-dialog__content {
  overflow-y: auto;
  overflow-x: hidden;
  height: calc(100% - 80px);
}
</style>
