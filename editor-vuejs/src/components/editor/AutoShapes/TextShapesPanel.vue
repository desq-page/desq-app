<template>
  <DialogBase title="Insert Texts" :icon="TextT24Filled">
    <TextShapes />
  </DialogBase>
</template>

<script setup lang="ts">
import {
  dragShapeOnDrag,
  dragShapeOnEnd,
  dragShapeOnStart,
  drawTextObjects,
} from "shared-vuejs/api/dragAutoshapes";
import { saveDexie } from "shared-vuejs/api/dbutils";
import DialogBase from "@/components/common/Layouts/DialogBase.vue";
import { addShapeFromPanel } from "shared-vuejs/api/drawAutoshapes";
import { TextT24Filled } from "@vicons/fluent";

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
        sz: 18,
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
