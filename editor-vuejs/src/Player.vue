<script setup>
// import PlayerApp from "player-vuejs/src/lib/PlayerApp";
import { useUrlSearchParams } from "@vueuse/core";
import { nextTick, onMounted, ref } from "vue";
// import SlideEdit from "@/components/editor/SlideEdit.vue";
// import SlideThumb from "@/components/editor/SlideThumb.vue";
// import "player-vuejs/src/player.css";

// const SlideThumb = defineAsyncComponent(
//   () => import("@/components/editor/SlideThumb.vue"),
// );

// const playerRef = ref();

import * as player from "@savanna/player";
import "@savanna/player/player.css";
import { extractSld } from "@savanna/player";
import { setupDB } from "shared-vuejs/api/db";
import { prepareExportFile } from "shared-vuejs/api/html";
import { getMediaRecordFromOPFS } from "shared-vuejs/api/opfs";
import { genPlayerIndexName } from "shared-vuejs/api/slideUtils";

const params = useUrlSearchParams();
const html = ref("");
let fileId,
  slideId,
  slideData,
  prevData,
  fileInfo,
  layoutInfo,
  masterInfo,
  theme;
const ready = ref(false);
onMounted(async () => {
  await initInfo();
  if (params.layoutType == "thumb" || params.layoutType == "slide") {
    const indexName = genPlayerIndexName(Number(params.slideIndex));
    let slideHtml;
    try {
      const page = await getMediaRecordFromOPFS(fileId, indexName);
      slideHtml = typeof page.data === "string"
        ? page.data
        : new TextDecoder().decode(page.data);
    } catch {
      // Keep already-published pages working while older files migrate to OPFS.
      slideHtml = await fetch(params.baseHref + indexName).then((res) => res.text());
    }


    const parser = new DOMParser();
    const doc = parser.parseFromString(slideHtml, "text/html");
    const styles = Array.from(doc.head?.children ?? [])
      .filter(c =>
        c.tagName == 'LINK' &&
        c.rel == 'stylesheet' &&
        !c.href?.split('/').pop().match(/player\.css$/),
      );

    slideHtml = extractSld(slideHtml, "sld" + params.slideIndex);


    html.value =
      "<div id='" +
      "sld" +
      params.slideIndex +
      "' class='slide'>" +
      slideHtml +
      "</div>";

    await nextTick();
    styles?.forEach(link => {
      const clone = link.cloneNode(true);
      document.head.appendChild(clone);
    });
    player.initSlides({
      slides: fileInfo.slides.map((sld) => ({
        id: sld.id,
        title: sld.title,
        layoutid: sld.layoutid,
        timing: sld.timing,
        transition: sld.transition,
        show: sld.show,
      })),
      layouts: fileInfo.layouts.map((lt) => ({
        id: lt.id,
        parent: lt.parent,
        timing: lt.timing,
      })),
      width: fileInfo.width,
      height: fileInfo.height,
      grid: fileInfo.grids,
      publish: fileInfo.publish,
    });
  } else {
    ready.value = true;
    // playerRef.value?.replaceChildren(PlayerApp({}));
  }
});

async function initInfo() {
  const base = document.getElementsByTagName("base")[0];
  if (base) {
    base.href = params.baseHref;
  }

  await setupDB();

  // use this to debug rendering of exportSlideHtml, wehich is used to export video
  fileId = params.fileId;
  fileInfo = await prepareExportFile(fileId);

  // slideId = fileInfo.slides[+params.slideIndex - 1]?.id;

  // const info = await loadAllAssetsFromDexie(fileInfo, slideId);
  // slideData = info.slideInfo;
  // layoutInfo = info.layoutInfo;
  // masterInfo = info.masterInfo;
  // theme = info.theme;

  return fileInfo;
}
</script>

<template>
  <div id="mainframe" class="mainframe">
    <div
      id="viewport"
      class="viewport"
      v-html="html"
      v-if="params.layoutType == 'thumb' || params.layoutType == 'slide'"
    ></div>
  </div>
  <!-- <iframe
    v-if="params.layoutType == 'slide'"
    style="width: 100vw; height: 100%"
    :src="`${getBaseHref(params.fileId)}media/index.html`"
  ></iframe> -->
</template>
