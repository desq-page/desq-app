<template>
  <!-- <MediaToolbar /> -->
  <!-- <MediaPanel /> -->
  <div
    style="width: 100%"
    v-for="(grp, grpIdx) in suppliedShapes.filter((grp) =>
      mode == 'change' ? !grp.draw : true,
    )"
    :key="grp"
  >
    <LayoutHeader :label="grp.type" />
    <div class="taskpane-guide" v-html="grp.guide" v-if="grp.guide"></div>
    <div class="autoshapeBlock clearfix">
      <template v-for="shp in grp.shapes" :key="shp">
        <NTooltip trigger="hover" :delay="300" :keep-alive-on-hover="false">
          <template #trigger>
            <div
              class="autoshape"
              :class="{
                noswap: shp.swap == 'no',
                selected:
                  piniaInfo().curMode == 'draw' &&
                  (shp.prst
                    ? piniaInfo().curCmd == 'preset' &&
                      g.curSVG?.preset?.n == shp.n
                    : piniaInfo().curCmd == shp.p?.substr(5)),
              }"
              @click="
                (evt) => {
                  grp.draw || mode == 'insert'
                    ? drawFunc(evt, shp)
                    : clickFunc(evt, shp);
                }
              "
              :draggable="grp.draw ? undefined : 'true'"
              @dragstart.self="(e) => dragShapeOnStart(e, shp, 'svg')"
              @drag.self="(e) => dragShapeOnDrag(e)"
              @dragend="(e) => dragShapeOnEnd(e, shp)"
              :data-name="shp.n"
              @pointerdown.stop
            >
              <svg
                :data-name="shp.n"
                viewBox="0 0 100 100"
                style="width: 25px; height: 25px"
                :style="{
                  pointerEvents: 'none',
                  position: 'static',
                  display: 'block',
                  transition: 'transform 0.2s ease',
                }"
              >
                <defs>
                  <marker
                    v-if="shp.arrow"
                    id="autoshape_marker"
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="10"
                    markerHeight="10"
                    stroke="black"
                    stroke-opacity="1"
                    fill="black"
                    orient="auto-start-reverse"
                    markerUnits="strokeWidth"
                  >
                    <path d="M 0 0 L 10 5 L 0 10 z"></path>
                  </marker>
                </defs>

                <path
                  v-for="(path, pid) in getPaths(shp)"
                  :key="pid"
                  :d="path.d"
                  fill="none"
                  stroke="black"
                  :stroke-width="3"
                  :style="{
                    pointerEvents: 'none',
                    position: 'static',
                    display: 'block',
                  }"
                  :marker-end="shp.arrow && 'url(#autoshape_marker)'"
                />
              </svg>
            </div>
          </template>
          <span style="pointer-events: none">{{ shp.n }}</span>
        </NTooltip>
      </template>
    </div>
  </div>
  <div>&nbsp;</div>
</template>

<script setup lang="ts">
import { getShapeDeep, updateShape, getSelectSelShpFormat } from "shared-vuejs/editor";

import { NTooltip } from "naive-ui";
import {
  dragShapeOnStart,
  dragShapeOnDrag,
  dragShapeOnEnd,
} from "shared-vuejs/api/dragAutoshapes";
import { drawAutoShape } from "shared-vuejs/api/drawAutoshapes";
import {
  genSVGPaths,
  normalizePath,
  resizePath,
} from "shared-vuejs/api/genSVGPaths";
import { buildShapePath, parseShapePath } from "shared-vuejs/api/utility";
import { drawSvgAutoshape } from "shared-vuejs/api/drawSpecialshapes";
import g from "shared-vuejs/api/global";
import { saveDexie } from "shared-vuejs/api/dbutils";
import LayoutHeader from "@/components/common/Layouts/LayoutHeader.vue";
import suppliedShapes from "shared-vuejs/api/suppliedShapes";
import { addShapeFromPanel } from "shared-vuejs/api/drawAutoshapes";
import { piniaInfo } from "@/lib/common/store";
import { getPrstInfo } from "shared-vuejs/api/shapeImportUtils";
import { stripStroke } from "shared-vuejs/api/VanUtils";

import { toggleTaskPane } from "@/lib/main/utils";

const props = defineProps({
  mode: String,
});

function getPaths(shp) {
  let paths;
  if (shp.prst) {
    let prstGeom = shp.prst;
    if (typeof shp.prst == "string") {
      prstGeom = {
        $_prst: shp.prst,
      };
    }
    const prstInfo = getPrstInfo(prstGeom, 100, 100);
    shp.d = prstInfo?.d || "R0,0,40,40";
    if (shp.d.includes("R") || shp.d.includes("E")) {
      // direct reading, so we need to parse here
      const parsePaths = genSVGPaths(shp);
      shp.d = normalizePath(parsePaths[0])?.d;
    }
    if (prstInfo?.pathTransform?.startsWith("scale(")) {
      // Bake preset scaling into the shared preview path before insertion scales it.
      // Stars use a 200x200 base path even when requested at 100x100.
      const [scaleX, scaleY = scaleX] = prstInfo.pathTransform
        .slice(6, -1)
        .trim()
        .split(/[\s,]+/)
        .map(Number);
      shp.d = buildShapePath(resizePath(parseShapePath(shp.d), scaleX, scaleY));
    }
    if (shp.prst == "arc") {
      // don't close
      shp.d = stripStroke({ d: shp.d }, shp.prst)?.d;
    }
  }
  if (shp.d?.includes("F")) {
    paths = genSVGPaths({
      callout: shp.callout || null,
      d: shp.d,
      fill: !shp.noFill,
    });
    paths.forEach((p) => (p.fill = true));
  } else {
    paths = [
      {
        d: shp.d?.replaceAll("|", ""),
        fill: !shp.noFill,
      },
    ];
  }

  return paths;
}

function drawFunc(e, shp) {
  drawAutoShape(e, shp);
}

let pending = false;

async function clickFunc(e, shp) {
  if (props.mode == "change") {
    const dstShp = getShapeDeep(getSelectSelShpFormat()?.id);
    let prstGeom = shp.prst;
    if (typeof shp.prst == "string") {
      prstGeom = {
        $_prst: shp.prst,
      };
    }

    const prstInfo = getPrstInfo(prstGeom, dstShp.w, dstShp.h);

    dstShp.d = prstInfo.d;

    delete dstShp.custGeom;

    dstShp.prstGeom = prstGeom;
    updateShape(dstShp);
    saveDexie();
    toggleTaskPane("shapefill");
  } else {
    if (pending) return;

    pending = true;

    const shpPos = await addShapeFromPanel(e);

    drawSvgAutoshape(shp, shpPos[0], shpPos[1], 200, 200);

    saveDexie();

    pending = false;
  }
}
</script>

<style scoped>
.autoshapeBlock {
  background: transparent;
}

.autoshape {
  text-align: center;
  vertical-align: middle;
  display: inline-block;
  width: 25px;
  height: 25px;
  cursor: pointer;
  color: black;
  margin: 5px;
  filter: drop-shadow(1px 1px #ccc);
}

.autoshape.selected {
  background: rgb(203, 245, 212);
}

.autoshape img {
  margin-top: 8px;
}

.autoshape:active {
  background: rgb(203, 245, 212);
}

/* .guide {
  padding: 5px;
  min-width: 100px;
  background: rgb(230, 230, 193);
  border-radius: 4px;
  font-size: 12px;
  margin: 10px 0 10px 0;
}

.guide2 {
  font-size: 12px;
} */
</style>
