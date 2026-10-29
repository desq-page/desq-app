<template>
  <DialogBase title="Insert Widgets" :icon="Hierarchy">
    <div style="width: 100%" v-for="(grp, grpIdx) in objShapes" :key="grp">
      <LayoutHeader :label="grp.type" />
      <div class="taskpane-guide" v-html="grp.guide" v-if="grp.guide"></div>
      <div class="block">
        <template v-for="shp in grp.shapes" :key="shp">
          <NTooltip trigger="hover" :keep-alive-on-hover="false">
            <template #trigger>
              <div
                class="autoshape"
                :class="{ noswap: shp.swap == 'no' }"
                @click="
                  (evt) => {
                    shp.onClick ? shp.onClick() : addObject(evt, shp);
                  }
                "
                draggable="true"
                @dragstart.self="(e) => dragShapeOnStart(e, shp, 'svg')"
                @drag.self="(e) => dragShapeOnDrag(e)"
                @dragend="(e) => dragShapeOnEnd(e, shp)"
                :data-name="shp.n"
                :style="{
                  width: (shp.iconW || shp.w / 2.5 || 40) + 'px',
                  height: (shp.iconH || shp.h / 2.5 || 40) + 'px',
                }"
              >
                <svg
                  :data-name="shp.n"
                  :viewBox="`0 0 ${shp.w || 100} ${shp.h || 100}`"
                  :style="{
                    width: (shp?.w / 2.5 || 40) + 'px',
                    height: (shp?.h / 2.5 || 40) + 'px',
                    pointerEvents: 'none',
                    position: 'static',
                    display: 'block',
                    transition: 'transform 0.2s ease',
                  }"
                  v-if="shp.d"
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
                      :stroke="g.themeOverrides?.common?.primaryColor"
                      stroke-opacity="1"
                      :fill="g.themeOverrides?.common?.primaryColor"
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
                    :fill="
                      path.fill
                        ? g.themeOverrides?.common?.primaryColor
                        : 'none'
                    "
                    :stroke="
                      path.fill
                        ? 'black'
                        : g.themeOverrides?.common?.primaryColor
                    "
                    :stroke-width="path.fill ? 1 : 3"
                    :style="{
                      pointerEvents: 'none',
                      position: 'static',
                      display: 'block',
                    }"
                    :marker-end="shp.arrow && 'url(#autoshape_marker)'"
                  />
                </svg>
                <ToolbarItem
                  :label="shp.n"
                  :icon="shp.icon"
                  secondary
                  buttonType="secondary"
                  bordered
                  v-else
                />
              </div>
            </template>
            <span style="pointer-events: none">{{ shp.n }}</span>
          </NTooltip>
        </template>
      </div>
    </div>

    <!-- <LayoutHeader label="Drag Settings" /> -->
    <!-- <div>
      Drag over to replace a shape

      <NSwitch
        :value="piniaInfo().allowDragToReplace"
        :on-update:value="
          () => (piniaInfo().allowDragToReplace = !piniaInfo().allowDragToReplace)
        "
        style="margin-left: 20px"
      />
    </div> -->
  </DialogBase>
</template>

<script setup lang="ts">
import { NTooltip } from "naive-ui";
import {
  dragShapeOnStart,
  dragShapeOnDrag,
  dragShapeOnEnd,
  drawTextObjects,
} from "shared-vuejs/api/dragAutoshapes";
import { genSVGPaths } from "shared-vuejs/api/genSVGPaths";
import g from "shared-vuejs/api/global";
import { saveDexie } from "shared-vuejs/api/dbutils";
import LayoutHeader from "@/components/common/Layouts/LayoutHeader.vue";
import DialogBase from "@/components/common/Layouts/DialogBase.vue";
import { addShapeFromPanel } from "shared-vuejs/api/drawAutoshapes";
import { Hierarchy } from "@vicons/tabler";
import { addShapeRaw } from "shared-vuejs/api/draw";
import { genId } from "shared-vuejs/api/utility";
import { LogoYoutube } from "@vicons/carbon";
import ToolbarItem from "../Toolbars/ToolbarItem.vue";
import { MapFilled } from "@vicons/material";

defineProps({
  mode: String,
});

var objShapes: any = [
  {
    type: "Data Objects",
    shapes: [
      {
        n: "Table",
        p: "draw_table",
        swap: "no",
        d: "M0,0L100,0L100,100,L0,100ZM50,0L50,100M0,50L100,50",
        f: {
          color: "",
        },
      },
      {
        n: "Chart",
        p: "draw_chart",
        swap: "no",
        d: "M0,0L20,0L20,100L40,100L40,20L60,20L60,100L80,100L80,40L100,40L100,100L0,100Z",
        f: {
          color: "",
        },
      },
      {
        n: "Container",
        p: "draw_container",
        swap: "no",
        d: "M0,0L140,0L140,100L0,100L0,0M20,20L80,20L80,70L20,70ZM50,80L120,80L100,40Z",
        f: {
          color: "",
        },
        w: 140,
        h: 100,
      },
    ],
  },
  {
    type: "Navigation",
    shapes: [
      {
        n: "Previous",
        p: "draw_btn_left",
        swap: "no",
        d: "M51.2 3.2C24.6912 3.2 3.2 24.6912 3.2 51.2 3.2 77.7088 24.6912 99.2 51.2 99.2 77.7088 99.2 99.2 77.7088 99.2 51.2 99.2 24.6912 77.7088 3.2 51.2 3.2ZM78.4 59.8848 48.4912 59.8848 48.4912 76.8 24 51.2 48.4912 25.6 48.4912 43.4288 78.4 43.4288 78.4 59.8848",
        link: "#prev",
      },
      {
        n: "Next",
        p: "draw_btn_right",
        swap: "no",
        d: "M48.8 96.8C75.3088 96.8 96.8 75.3088 96.8 48.8 96.8 22.2912 75.3088.8 48.8.8 22.2912.8.8 22.2912.8 48.8.8 75.3088 22.2912 96.8 48.8 96.8ZM21.6 40.1152 51.5088 40.1152 51.5088 23.2 76 48.8 51.5088 74.4 51.5088 56.5712 21.6 56.5712 21.6 40.1152",
        link: "#next",
      },
    ],
  },
  // {
  //   type: "Buttons",
  //   shapes: [
  //     {
  //       n: "Button",
  //       p: "draw_btn_left",
  //       swap: "no",
  //       shape: {
  //         x: 0,
  //         y: 0,
  //         name: "Button",
  //         type: "round rect.",
  //         f: { color: "green" },
  //         l: { color: "" },
  //         d: "|X1,17.785,0,sw*0.001,0,min(sw/2;sh/2),0|X5,96.995,35.65|Mx1x+x1y,0|Lx5x-(x1x+x1y),0|Cx5x-x1x-x1y+K*(x1x+x1y),0,x5x,x1x+x1y-K*(x1x+x1y),x5x,x1x+x1y|Lx5x,x5y-x1x-x1y|Cx5x,x5y-(x1x+x1y)+K*(x1x+x1y),x5x-(x1x+x1y)+K*(x1x+x1y),x5y,x5x-(x1x+x1y),x5y|Lx1x+x1y,x5y|Cx1x+x1y-K*(x1x+x1y),x5y,0,x5y-(x1x+x1y)+K*(x1x+x1y),0,x5y-(x1x+x1y)|L0,x1x+x1y|C0,x1x+x1y-K*(x1x+x1y),x1x+x1y-K*(x1x+x1y),0,x1x+x1y,0",
  //         t: {
  //           paras: {
  //             zz0QsP01: {
  //               idx: 0,
  //               runs: {
  //                 zF7i3Ghw: {
  //                   idx: 0,
  //                   text: "BUTTON",
  //                   style: {
  //                     fontFamily: "Roboto",
  //                     color: "rgb(255, 255, 255)",
  //                     fontWeight: "bold",
  //                     fontScale: 1,
  //                     fontSize: 12,
  //                   },
  //                 },
  //               },
  //             },
  //           },
  //           margin: { t: 4.8, r: 9.6, b: 4.8, l: 9.6 },
  //           style: { fontScale: 1, fontSize: 12, color: "rgb(255, 255, 255)" },
  //         },
  //         fx: {
  //           outerShdw: { c: "#000000", a: 1, r: 1, x: 1, y: 1 },
  //           innerShdw: { c: "#000000", a: 1, r: 1, x: 1, y: 1 },
  //         },
  //         id: "zMmb4pVo",
  //       },
  //       d: "M35.303,0L164.697,0C184.184,0,200,15.816,200,35.303L200,34.925C200,54.412,184.184,70.228,164.697,70.228L35.303,70.228C15.816,70.228,0,54.412,0,34.925L0,35.303C0,15.816,15.816,0,35.303,0",
  //       t: "Submit",
  //       w: 200,
  //       h: 70,
  //     },
  //   ],
  // },
  {
    type: "Input Boxes",
    shapes: [
      {
        n: "Input",
        p: "draw_btn_left",
        // swap: "no",
        d: "M0,0L200,0L200,69.949L0,69.949Z",
        f: {
          color: "",
        },
        w: 200,
        h: 70,
      },
    ],
  },
  {
    type: "Iframe (Embed Websites)",
    shapes: [
      {
        n: "Iframe",
        p: "draw_btn_left",
        url: "https://desq.page/",
        d: "M0,0L200,0L200,80L0,80ZM10,10L190,10L190,70L10,70Z",
        f: {
          color: "",
        },
        w: 600,
        h: 400,
        iconW: 80,
        iconH: 28,
      },
      {
        n: "Youtube",
        p: "draw_btn_left",
        f: {
          color: "",
        },
        w: 600,
        h: 400,
        iconW: 100,
        iconH: 35,
        icon: LogoYoutube,
        onClick: insertYoutubeVideo,
      },
      {
        n: "Google Map",
        p: "draw_btn_left",
        onClick: insertGoogleMap,
        f: {
          color: "",
        },
        w: 600,
        h: 400,
        iconW: 125,
        iconH: 30,
        icon: MapFilled,
      },
    ],
  },
];

function getPaths(shp) {
  let paths;
  if (shp.d?.includes("X")) {
    paths = genSVGPaths({
      callout: shp.callout || null,
      d: shp.d,
    });
    paths.forEach((p) => (p.fill = true));
  } else {
    paths = [
      {
        d: shp.d?.replaceAll("|", ""),
        fill: shp.f?.color !== "",
      },
    ];
  }

  return paths;
}

let pending = false;

async function addObject(e, shp) {
  if (pending) return;
  pending = true;
  const shpPos = await addShapeFromPanel(e);
  drawTextObjects(shp, shpPos[0], shpPos[1], shp.w || 100, shp.h || 100, 1);
  saveDexie();
  pending = false;
}

function insertYoutubeVideo() {
  addShapeRaw({
    id: genId(),
    type: "video",
    x: 200,
    y: 100,
    w: 400,
    h: 300,
    i: {
      video: "https://www.youtube.com/embed/uHKfrz65KSU",
      iX: 0,
      iY: 0,
      iH: 100,
      iW: 100,
    },
  });
}

function insertGoogleMap() {
  addShapeRaw({
    id: genId(),
    type: "iframe",
    x: 200,
    y: 100,
    w: 400,
    h: 300,
    url: "https://www.google.com/maps/embed?api=1&origin=Singapore&destination=Singapore&travelmode=bicycling",
  });
}
</script>

<style scoped>
.block {
  /*float:left; 
	width: 285px; */
  /*border-top: 1px solid #0b8899;*/
  margin: 1px;
  background: transparent;
  display: flex;
  flex-wrap: wrap;
  /*-webkit-user-select: none;
	-moz-user-select: none;
	user-select: none*/
}

.autoshape {
  text-align: center;
  vertical-align: middle;
  display: inline-block;
  width: 40px;
  height: 40px;
  cursor: pointer;
  color: var(--n-primary-color);
  padding: 5px;
}

.autoshape:hover {
  /* background: #ececec; */
}

.autoshape img {
  margin-top: 8px;
}

.autoshape:active {
  background: rgb(126, 221, 145);
}

.autoshapeRight {
  position: relative;
  float: right;
  width: 140px;
  border: 1px solid white;
}

.autoshapeRight:hover {
  border: 1px solid #ccc;
}

.autoshapeRight:active {
  border: 1px solid black;
}

/* .guide {
  padding: 5px;
  min-width: 100px;
  background: rgb(230, 230, 193);
  border-radius: 4px;
  font-size: 12px;
  margin: 10px 0 10px 0;
} */
</style>
