<template>
  <NModal
    :show="!!piniaInfo().openDataGrid"
    transform-origin="center"
    transition-delay="0"
    :mask-closable="false"
    preset="dialog"
    title="Edit Data"
    :closable="true"
    :style="{
      width: piniaResize().windowWidth < 1024 ? '95vw' : '80vw',
      height: '95vh',
      overflow: 'hidden',
      touchAction: 'none',
    }"
    @update-show="
      (val) => {
        if (!val) saveData();
      }
    "
  >
    <template #header>
      <!-- <NButton type="primary" @click="saveData">Save</NButton> -->
    </template>

    <div style="width: 100%; height: 100%; margin-top: 20px">
      <div class="guide">
        <ul>
          <li>Single string: enter in cell A1</li>
          <li>One dimension array (list): enter in column A</li>
          <li>
            Two dimension array (table): reserve first row for column header
          </li>
        </ul>
      </div>
      <VGrid
        :row-headers="true"
        :columns="columns"
        :source="rows"
        style="height: calc(100vh - 200px)"
        :frame-size="200"
        :resize="true"
        hide-attribution
        ref="myGrid"
      />
    </div>
  </NModal>
</template>
<script setup lang="ts">
import { getShapeInfo, updateShape } from "shared-vuejs/editor";

import { NModal } from "naive-ui";
import {
  piniaInfo,
  piniaResize,
  piniaSelect,
} from "@/lib/common/store";
import { defineAsyncComponent, ref, watch } from "vue";
import { saveDexie } from "shared-vuejs/api/dbutils";


const columns = ref([]);
const rows = ref([]);
const myGrid = ref();
const VGrid = defineAsyncComponent(() => import("@revolist/vue3-datagrid"));
watch(
  () => piniaInfo().openDataGrid,
  () => {
    columns.value = piniaInfo().openDataGrid?.columns || genAlphabet();
    const totalRows = piniaInfo().openDataGrid?.rows || [];
    addMoreRows(totalRows, 50 - totalRows.length);
    rows.value = totalRows;
  },
);

// function trimArray(arr) {
//     let lastNonEmptyIndex = arr.lastIndexOf(arr.find(item => item !== ''));
//     return arr.slice(0, lastNonEmptyIndex + 1);
// }

function addMoreRows(rows, count) {
  for (let i = 0; i < count; i++) {
    rows.push({ a: "" });
  }
}

function genAlphabet() {
  const alphabet = Array.from({ length: 26 }, (_, i) =>
    String.fromCharCode(97 + i),
  );
  const columns: any = [
    ...alphabet.map((letter) => ({
      prop: letter,
      name: letter.toUpperCase(),
    })),
  ];
  return columns;
}

async function saveData() {
  const data = myGrid.value.source;
  const alphabet = Array.from({ length: 26 }, (_, i) =>
    String.fromCharCode(97 + i),
  );
  if (piniaInfo().openDataGrid?.type == "chart") {
    const shp = getShapeInfo(piniaSelect().selShpFormat?.id);

    const series: any = [];
    const categories: any = [];
    data.forEach((row, rowIdx) => {
      if (rowIdx == 0) {
        // series name
        for (let colIdx = 1; colIdx < 26; colIdx++) {
          const letter = alphabet[colIdx];
          if (!row[letter]) {
            // end of columns
            break;
          }
          series[colIdx - 1] = {
            ...shp.chartData.series?.[colIdx - 2], // if this is a new series, copy config from previous series
            ...shp.chartData.series?.[colIdx - 1], // copy series config
            name: row[letter], // only name changed
            data: [],
          };
        }
        // after rowIdx==0, we have all series with config and names
      } else {
        if (row["a"]) {
          categories[rowIdx - 1] = row["a"];
        } else {
          // no category name, end of data
          return;
        }
        for (let colIdx = 1; colIdx <= series.length; colIdx++) {
          const letter = alphabet[colIdx];
          series[colIdx - 1].data[rowIdx - 1] = row[letter];
        }
      }
    });
    shp.chartData.xAxis[0].data = categories;
    shp.chartData.series = series;
    updateShape(shp);
    saveDexie();
    const { processChart } = await import("shared-vuejs/api/chart");
    processChart(shp, false, false, false);
  } else if (piniaInfo().openDataGrid?.cb) {
    piniaInfo().openDataGrid?.cb(map2DArray(data));
  }
  piniaInfo().openDataGrid = null;
}

function map2DArray(data) {
  const result: any = [];
  const alphabet = Array.from({ length: 26 }, (_, i) =>
    String.fromCharCode(97 + i),
  );
  for (let r = 0; r < data.length; r++) {
    const row = data[r];
    if (!row["a"] && r > 0) {
      break;
    }
    const rowData: any = [];
    for (let c = 0; c < alphabet.length; c++) {
      const letter = alphabet[c];
      if (!row[letter] && c > 0) {
        break;
      } else {
        rowData.push(row[letter]);
      }
    }
    result.push(rowData);
  }
  return result;
}
</script>

<style scoped>
.guide {
  font-size: 12px;
}
</style>
