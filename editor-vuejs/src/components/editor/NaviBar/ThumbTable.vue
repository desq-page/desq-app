<template>
  <div class="list" @drop="(e) => moveElem(e, null, 1000)">
    <div
      class="thumbRow"
      :style="{
        height: genThumbHeight(thumb) + 10 + 'px',
      }"
      :class="[
        {
          thumbActive: isActive(thumb),
        },
        { thumbCurrent: thumb.id == piniaSlides().slideId },
        {
          thumbMultiSelected: piniaSlides().multiSelected?.includes(thumb.id),
        },
        {
          thumbHidden: thumb.hidden,
        },
        handleDropClasses(thumb),
      ]"
      v-for="(thumb, index) in thumbList"
      :key="thumb.id || genId()"
      :data-slideid="thumb.id"
      :draggable="!getSlidesMasterView()"
      @dragstart.self="(e) => pickupElem(e, thumb, index)"
      @dragover.prevent="(e) => showDropPlace(e, thumb, index)"
      @dragenter.prevent
      @drop="(e) => moveElem(e, thumb, index)"
      @dragend.prevent="dragEndClear()"
    >
      <div
        class="list__elem"
        :class="{
          'list__elem--is-dragged': dragedElem && thumb.id === dragedElem.id,
        }"
        v-if="getSlidesMasterView() || (+index >= +start && +index <= +end)"
        :key="index"
      >
        <div class="btn-drag" v-if="!getSlidesMasterView()">
          <span>{{ thumb.order }}</span>
        </div>
        <img
          :id="`thumb-${thumb.id}`"
          :src="`${genThumbUrl(thumb.id)}`"
          draggable="false"
          :style="{
            width: genThumbWidth(thumb) + 'px',
            height: genThumbHeight(thumb) + 'px',
            left: thumb.master ? 0 : '30px',
            cursor: 'pointer',
            opacity: thumb.show == 0 ? 0.5 : 1,
          }"
          @mousedown.stop="(e) => onMouseDown(e, thumb.id)"
          :title="thumb.title"
        />
        <span
          v-if="thumb.show == 0"
          class="thumbStop"
          :style="{ left: thumb.master ? '10px' : '40px' }"
          role="img"
          aria-label="Hidden slide"
          title="Hidden slide"
        >
          <Prohibited24Filled aria-hidden="true" />
        </span>
        <div class="slideTitle">
          {{
            thumb.id == getSlidesSlideId()
              ? getSlideInfo()?.title
              : thumb.title
          }}
        </div>
        <!-- <NButton
          secondary
          class="thumbMenu"
          v-if="isActive(thumb)"
          :onClick="
            (e) => {
              toggleTaskPane('formatslide');
            }
          "
          :disabled="!!piniaInfo().useGrid"
        >
          <template #icon>
            <NIcon size="24"><DocumentSettings16Regular /></NIcon>
          </template>
        </NButton> -->
        <div class="thumbMenu">
          <ToolbarItem
            quaternary
            :icon="StarHalf24Filled"
            :color="thumb.transition?.ef ? 'green' : '#cdcdcd'"
            tooltip="Transition"
            :size="18"
            button-size="small"
            :onClick="() => selectTransition(thumb.id)"
          />
          <ToolbarItem
            quaternary
            :icon="CursorClick20Regular"
            :color="thumb.transition?.advClick ? 'green' : '#cdcdcd'"
            tooltip="Advance"
            :size="22"
            button-size="small"
            :onClick="() => selectTransition(thumb.id)"
          />
        </div>
        <!-- <NIcon
          size="20"
          class="thumbMenu"
          v-if="thumb.transition"
          @click="toggleTaskPane('transition')"
          ><Lightning
        /></NIcon> -->
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { updateFile, getSelectEditingTextObject, getSlidesMasterView, getSlidesMultiSelected, getSlidesSlideId, getFileInfo, getSlideInfo, setInfoCurMode, setSlidesMultiSelected } from "shared-vuejs/editor";

import { isWordDocument } from "shared-vuejs/api/save-document";
import { wordMasterId } from "shared-vuejs/api/master";
import { nextTick, onMounted, ref, watch } from "vue";
import {
  piniaInfo,
  piniaResize,
  piniaSlides,
} from "@/lib/common/store";
import { genThumbUrl, saveDexie, saveThumb } from "shared-vuejs/api/dbutils";

import { genId, gid } from "shared-vuejs/api/utility";
import {
  activeSlideHeight,
  activeSlideWidth,
  selectSlide,
} from "shared-vuejs/api/slide";
import ToolbarItem from "../Toolbars/ToolbarItem.vue";
import { CursorClick20Regular, StarHalf24Filled, Prohibited24Filled } from "@vicons/fluent";
import { deselectAll } from "shared-vuejs/api/handle";
import { deepUnref } from "@/components/vue-utils/unref";


const props = defineProps({
  start: {
    type: Number,
    default: 0,
  },
  end: {
    type: Number,
    default: 10,
  },
});

const thumbList = ref([] as any);
const dragedElem = ref(null as any);
const overElem = ref(null as any);

let observer;

// const deleting = ref(false);

// const queueThumb = ref({});

const observerOptions = {
  root: document.querySelector(".navi"),
  rootMargin: "0px",
  threshold: 0.3,
};

const cbThumbInViewport = (entries) => {
  // console.log(entries)
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      const sldId = entry.target.dataset?.slideid;
      if (sldId) {
        entry.target.timeoutThumb = setTimeout(() => {
          const thumbImg = gid("thumb-" + sldId);
          if (!thumbImg || thumbImg?.naturalWidth <= 8) {
            // queueThumb.value[sldId] = true;
            saveThumb(sldId);
            entry.target.timeoutThumb = undefined;
          }
        }, 1);
      }
    } else {
      if (entry.target.timeoutThumb) {
        clearTimeout(entry.target.timeoutThumb);
        entry.target.timeoutThumb = undefined;
      }
    }
  });
};

onMounted(() => {
  observeThumbInViewport();
});

function observeThumbInViewport() {
  if (!observer) {
    setTimeout(() => {
      if (!observer) {
        const rows = document.querySelectorAll(".thumbRow");
        if (rows.length > 0) {
          observer = new IntersectionObserver(
            cbThumbInViewport,
            observerOptions,
          );
          rows.forEach((row) => observer.observe(row));
        }
      }
    }, 2000);
  }
}

// const emptyPng =
//   "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAH0lEQVQoU2NkYGAwZkAFZ5G5jPRRgOYEVDeB3EBjBQBOZwTVugIGyAAAAABJRU5ErkJggg==";
function genThumbWidth(thumb) {
  const THUMBWIDTH = piniaResize().THUMBWIDTH;
  return thumb.master ? THUMBWIDTH + 30 : THUMBWIDTH;
}
function genThumbHeight(thumb) {
  return (genThumbWidth(thumb) * thumb.height) / thumb.width;
}

function isActive(thumb) {
  return thumb.id == getSlidesSlideId();
}
async function updateThumbList() {
  const _thumbList = [] as any;
  let sldType = "slides";
  if (getSlidesMasterView()) {
    sldType = "layouts";
  }

  const slides = getFileInfo()?.[sldType];
  // const fileId = getFileInfo().id;

  for (let i = 0; i < slides?.length; i++) {
    const sldInfo = slides[i]; //await db[sldType].get([fileId, sldId]);

    if (sldInfo) {
      _thumbList.push({
        id: sldInfo.id,
        parentid: sldInfo.parentid,
        width: activeSlideWidth(),
        height: activeSlideHeight(),
        order: i + 1,
        transition: sldInfo.transition,
        show: sldInfo.show ?? 1,
        hidden: sldInfo.hidden,
        title: sldInfo.title,
      });
    }
  }
  if (getSlidesMasterView()) {
    if (isWordDocument(getFileInfo(), [getSlideInfo()])) {
      thumbList.value = _thumbList.filter(thumb => thumb.id === wordMasterId()).map(thumb => ({ ...thumb, master: true }));
      scrollToSlide();
      observeThumbInViewport();
      return;
    }
    const masters = _thumbList.filter((mst) => !mst.parentid);
    let layouts: any = [];
    masters.forEach((mst) => {
      mst.master = true;
      layouts.push(mst);
      const _layouts = _thumbList.filter((layout) => layout.parentid == mst.id);
      layouts = [...layouts, ..._layouts];
    });
    thumbList.value = layouts;
  } else {
    thumbList.value = _thumbList;
  }
  // nextTick(updateThumbs);
  scrollToSlide();
  // watchLazyLoad();
  observeThumbInViewport();
}

updateThumbList();

watch([() => piniaSlides().slideId, () => piniaSlides().sldState, () => piniaSlides()], () => {
  if (
    (piniaSlides().masterView &&
      getFileInfo().layouts?.length !== thumbList.value.length) ||
    (!piniaSlides().masterView &&
      getFileInfo().slides?.length !== thumbList.value.length)
  ) {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }
  updateThumbList();
});

watch(() => piniaInfo().useGrid, () => {
  if (observer) {
    observer.disconnect();
    observer = null;
  } 
  updateThumbList();
})

// watch(
//   [() => getFileInfo().layouts, () => getFileInfo().slides],
//   () => {
//     updateThumbList();
//   },
// );

// watch(
//   [
//     () => getSlidesMasterView(),
//     () => piniaInfo().useGrid,
//     () => getSlideInfo()?.transition?.tr,
//     () => getSlideInfo()?.hidden,
//   ],
//   () => {
//     if (observer) {
//       observer.disconnect();
//       observer = null;
//     }
//     updateThumbList();
//   },
// );

function scrollToSlide() {
  setTimeout(() => {
    const el: any = document.querySelector(".thumbActive");
    if (el) {
      const navi: any = document.querySelector(".navi");
      const elTop = el.offsetTop - navi.scrollTop;
      if (
        navi &&
        (elTop > navi.offsetHeight - 40 || elTop < navi.offsetTop - 40)
      ) {
        navi.scrollTop = el.offsetTop - 40;
      }
    }
  }, 100);
}

function selectThumb(e: MouseEvent, id: string) {
  setInfoCurMode("slide");
  if (e.ctrlKey /*|| (e.shiftKey && getSlidesMasterView())*/) {
    setSlidesMultiSelected([...getSlidesMultiSelected(), id]);
  } else if (e.shiftKey) {
    let sldType = "slides";
    if (getSlidesMasterView()) {
      sldType = "layouts";
    }
    const curIdx = thumbList.value.findIndex(
      (t) => t.id == getSlidesSlideId(),
    );
    const selectedIdx = thumbList.value.findIndex((t) => t.id == id); //getFileInfo()[sldType].indexOf(id);
    let small = curIdx,
      big = selectedIdx;
    if (curIdx > selectedIdx) {
      small = selectedIdx;
      big = curIdx;
    }
    for (let i = small; i <= big; i++) {
      setSlidesMultiSelected([
        ...getSlidesMultiSelected(),
        thumbList.value[i].id,
      ]);
    }
  } else {
    let waiting = 0;
    if (getSelectEditingTextObject()) {
      // delay so that it save
      waiting = 100;
    }
    deselectAll();
    setTimeout(() => selectSlide(id), waiting);
  }
}

async function selectTransition(id) {
  await selectSlide(id);
  await nextTick();
  piniaInfo().toolbarTab = "transition";
  if (piniaInfo().currentTaskPane === "transition") {
    piniaInfo().currentTaskPane = "";
  }
}

function handleDropClasses(item: any) {
  if (!overElem.value || !overElem.value?.id) {
    return "";
  }
  if (overElem.value.id === item.id && item.order < dragedElem.value?.order) {
    console.log("before");
    return "drop-place drop-place--before";
  }
  if (overElem.value.id === item.id && item.order > dragedElem.value?.order) {
    console.log("after");
    return "drop-place drop-place--after";
  }
}

function dragEndClear() {
  console.log("dragEnd");
  dragedElem.value = null;
  overElem.value = null;
  let sldType = "slides";
  if (getSlidesMasterView()) {
    sldType = "layouts";
  }
  // Step 1: Create a map from id to its order
  const orderMap: any = new Map(
    thumbList.value.map((item, index) => [item.id, index]),
  );

  const slides = deepUnref(getFileInfo()[sldType]);

  // Step 2: Sort arrToSort using the order from the map
  slides.sort((a, b) => {
    return orderMap.get(a.id) - orderMap.get(b.id);
  });
  updateFile({
    [sldType]: slides,
  });
  saveDexie();
}

let startY;

function pickupElem(event: any, elem: any, index: number) {
  if (elem.master) return;
  event.dataTransfer.dropEffect = "move";
  event.dataTransfer.effectAllowed = "move";
  const img = event.target.querySelector("img");
  console.log(event);
  startY = event.offsetY;
  event.dataTransfer.setDragImage(img, event.offsetX - 25, event.offsetY);
  // event.target.scrollIntoViewIfNeeded();
  dragedElem.value = { ...elem };
}
function showDropPlace(event: any, elem: any, index: number) {
  if (Math.abs(event.offsetY - startY) < 10) {
    overElem.value = null;
    return;
  }
  if (!elem || !dragedElem.value) return;
  if (elem.id !== dragedElem.value.id) {
    overElem.value = { ...elem };
  } else {
    overElem.value = null;
  }
}
function moveElem(event: any, elem: any, index: number) {
  console.log(event);
  if (Math.abs(event.offsetY - startY) < 10) return;
  if (index == 1000) {
    // drag on the list, append to end
    elem = thumbList.value[thumbList.value.length - 1];
    index = thumbList.value.length - 1;
  }
  event.stopPropagation();
  console.log(index, elem, dragedElem.value);
  if (!elem || !dragedElem.value) return;
  console.log(`moveElem: event: ${event} | elem: ${elem} | index: ${index}`);
  thumbList.value = thumbList.value.filter(
    (item: any) => item.id !== dragedElem.value.id,
  );

  thumbList.value.splice(index, 0, { ...dragedElem.value });
  thumbList.value.forEach(
    (item: any, index: number) => (item.order = index + 1),
  );
}

function onMouseDown(e, id) {
  if (
    (!getSlidesMultiSelected()?.includes(id) &&
      getSlidesSlideId() !== id) ||
    (e.which == 1 && !e.shiftKey)
  ) {
    selectThumb(e, id);
  }
  // if (e.button == 2) {
  //   useDebounceFn(() => showContextMenu(e), 300);
  // }
}

// function showContextMenu(e) {
//   piniaInfo().curPopupXY = { x: e.pageX, y: e.pageY + 10 };
//   piniaInfo().curPopupId = "popover-slide-options";
// }
</script>

<style scoped>
.thumbStop {
  position: absolute;
  top: 10px;
  z-index: 10;
  display: flex;
  width: 20px;
  height: 20px;
  padding: 2px;
  box-sizing: border-box;
  color: #d03050;
  border-radius: 3px;
  pointer-events: none;
}

.slideTitle {
  position: absolute;
  z-index: 10;
  bottom: 10px;
  left: 38px;
  background-color: white;
  font-size: 10px;
  padding: 2px;
  border: 1px solid #888;
  border-radius: 3px;
  max-width: 100px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.slideTitle:empty {
  display: none;
}

.thumbRow {
  position: relative;
}
@media screen and (max-width: 600px) {
  .thumbRow {
    max-width: 160px;
  }
}
.thumbActive .list__elem img {
  outline: 2px solid red;
}

.thumbHidden {
  opacity: 0.2;
}

.thumbMultiSelected .list__elem img {
  outline: 2px solid rgb(225, 150, 10);
}
.list {
  text-align: initial;
  margin: 10px 5px 5px 5px;
  padding-bottom: 100px;
}
.list__elem {
  padding: 5px 5px 0px 5px;
  transition: all 0.3s ease;
  position: relative;
}
.list__elem img {
  border: 1px solid #ccc;
  position: relative;
  left: 20px;
  background: white;
}
.list__elem--is-dragged {
  opacity: 0;
  border: 1px dashed skyblue;
  cursor: none;
}

.list__elem--is-dragged .btn-drag {
  display: none;
}
.drop-place {
  position: relative;
  transition: all 0.3s ease;
}
/*.drop-place--before {
  padding-top: 0px;
}
.drop-place--after {
  padding-bottom: 0px;
}*/
.drop-place--before:before,
.drop-place--after:after {
  position: absolute;
  top: 0px;
  left: 25px;
  text-align: center;
  content: "";
  width: calc(100% - 25px);
  height: 0;
  padding: 0;
  opacity: 0.5;
  outline: 1px solid red;
}

.drop-place--after:after {
  top: 100%;
}
.btn-drag {
  /* color: black; */
  border-radius: 50%;
  border: none;
  position: absolute;
  width: 18px;
  height: 18px;
  left: 5px;
  top: 10px;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 11px;
  font-weight: bold;
  display: flex;
  flex-direction: column;
}

.slideMenu {
  position: absolute;
  height: 22px;
  left: 30px;
  top: 0px;
  background-color: white;
  box-shadow: 1px 1px 1px rgba(0, 0, 0, 0.6);
  border-radius: 3px;
}

.menu-enter-active,
.memu-leave-active {
  transition: opacity 0.5s;
}
.menu-enter-from,
.menu-leave-to {
  opacity: 0;
}

.slide-leave-active {
  transition: opacity 0.5s;
}

.slide-enter-active {
  transition: none;
}

.slide-enter-from {
  opacity: 1;
}

.slide-leave-to {
  opacity: 0;
}

.thumbMenu {
  position: absolute;
  top: 30px;
  left: -5px;
  padding: 0px;
}
</style>
