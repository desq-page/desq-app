<template>
  <div style="width: 100%" v-for="grp in objShapes" :key="grp">
    <div class="taskpane-guide" v-html="grp.guide" v-if="grp.guide"></div>
    <div class="autoshapeBlock clearfix">
      <template v-for="shp in grp.shapes" :key="shp">
        <div
          class="text-item-box"
          :style="{
            counterSet: shp.numbered ? 'chapter-count 0' : 'none',
          }"
        >
          <div
            class="text-item"
            :style="{
              fontSize: (shp.sz > 30 ? shp.sz * 0.5 : shp.sz * 0.8) + 'rem',
              fontWeight: shp.bold ? 'bold' : 'normal',
              display: shp.bullet || shp.numbered ? 'list-item' : '',
              marginLeft: shp.bullet || shp.numbered ? '1.4em' : '',
              listStyleType: shp.numbered ? 'decimal' : '',
            }"
            @click="(e) => insertText(e, shp)"
            draggable="true"
            @dragstart.self="(e) => dragShapeOnStart(e, shp, 'text')"
            @drag.self="(e) => dragShapeOnDrag(e)"
            @dragend="(e) => dragShapeOnEnd(e, shp)"
            @pointerdown.stop
            :data-name="shp.n"
          >
            {{ shp.n }}
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  dragShapeOnDrag,
  dragShapeOnEnd,
  dragShapeOnStart,
  drawTextObjects,
} from "shared-vuejs/api/dragAutoshapes";
import { saveDexie } from "shared-vuejs/api/dbutils";
import { addShapeFromPanel } from "shared-vuejs/api/drawAutoshapes";

defineProps({
  mode: String,
});


var objShapes: any = [
  {
    type: "Text Box",
    shapes: [
      {
        n: "Title",
        p: "draw_text",
        sz: 60,
        bold: true,
        x: 100,
        y: 50,
        w: 600,
        autosize: true,
        h: 100,
        ph: "title",
      },
      {
        n: "Subtitle",
        p: "draw_text",
        sz: 40,
        bold: true,
        autosize: true,
        x: 100,
        y: 150,
        w: 600,
        h: 60,
        ph: "subTitle",
      },
      {
        n: "Normal text",
        p: "draw_text",
        sz: 18,
        x: 100,
        y: 250,
        w: 600,
        h: 200,
        ph: "body",
        autosize: true,
      },
      {
        n: "Bullet list",
        p: "draw_text",
        sz: 18,
        bullet: true,
        x: 100,
        y: 250,
        w: 600,
        h: 200,
        ph: "body",
        autosize: true,
      },
      {
        n: "Number list",
        p: "draw_text",
        sz: 18,
        numbered: true,
        x: 100,
        y: 250,
        w: 600,
        h: 200,
        ph: "body",
        autosize: true,
      },
    ],
  },
  {
    type: "Shape-aware Textbox",
    shapes: [
      {
        n: "Shape-aware Text",
        p: "draw_text",
        sz: 12,
        bold: false,
        x: 100,
        y: 250,
        w: 600,
        h: 200,
        tightWrap: true,
      },
    ]
  }
];

async function insertText(e, shp) {
  if (e.detail === 0 || e.defaultPrevented) return;
  await addShapeFromPanel(e, shp.x, shp.y);
  drawTextObjects(shp, shp.x, shp.y, shp.w || 100, shp.h || 100, 1);
  saveDexie();
}

// function onPointerUp() {
//   console.log("up");
// }

// function genSvgPath(p) {
//   const svgCmd = parseShapePath(p);

//   console.log(buildShapePath(svgCmd))
// }
</script>

<style scoped>
.text-item {
  margin: 5px 0;
  cursor: pointer;
  padding: 5px;
}

.text-item-box {
  border: 1px solid #ccc;
  border-radius: 3px;
  margin-top: 10px;
}

.text-item:hover {
  background-color: #ececec;
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
