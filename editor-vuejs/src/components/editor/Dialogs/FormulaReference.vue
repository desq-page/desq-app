<template>
  <NModal
    v-model:show="piniaInfo().openFormulaRef"
    transform-origin="center"
    transition-delay="0"
    :mask-closable="false"
    preset="dialog"
    title="Formula Reference"
    :closable="true"
    :style="{
      width: piniaResize().windowWidth < 1024 ? '95vw' : '80vw',
      height: '95vh',
      overflow: 'hidden',
      touchAction: 'none',
    }"
    @update-show="(val) => {}"
  >
    <template #icon>
      <NIcon><MathFormula24Filled /></NIcon>
    </template>
    <div class="content">
      Generic Functions
      <ul>
        <li><b>GET(name):</b> Return variable value</li>
        <li><b>LET(name, value):</b> Set variable</li>
        <li><b>UPPER(s):</b> Uppercasea a string</li>
        <li><b>LOWER(s):</b> Lowercase a string</li>
        <li><b>PROPER(s):</b> Proper case a string</li>
        <li><b>REPLACE(s, search, replace):</b> Replace string</li>
        <li><b>SPLIT(s, separator):</b> Split string into array</li>
        <li><b>JOIN(arr, separator):</b> Turn array to string</li>
        <li><b>NUMBER(s):</b> Convert string to number (strip characters)</li>
        <li><b>FIXED(n):</b> Convert to 2 decimal (currency)</li>
        <li><b>TIME():</b> Current time in ISO format</li>
        <li>
          <b>CLICK(name):</b> Simulate click on a shape, to start trigger
          animation
        </li>
        <li>
          <b>GOTO(idx):</b> Go to slide number, or "first", "last", "next",
          "prev", "viewed"
        </li>
        <li><b>VOID():</b> {}</li>
      </ul>
      Array Functions
      <ul>
        <li>
          <b>SUM(array, colIdx):</b> Sum of one column of array. column index
          starts from 0
        </li>
        <li>
          <b>SUMIF(array, colIdx, ifColumnIdx, expression):</b>
          Sum of one column of array, only for rows (in another column) matching
          expression
        </li>
        <li>
          <b>SUMPRODUCT(arr, col1, col2):</b> Sum of column 1 x column 2 (eg:
          amount = qty x price)
        </li>
        <li>
          <b>COUNTIF(arr, ifCol, equal):</b> Count total rows, filter for
          matching rows
        </li>
        <li>
          <b>FILTER(arr, colIdx, equal):</b> Filter array for matching rows
        </li>

        <li>
          <b>LETITEM(arrName, row, col, value):</b> Set an array item (cell)
        </li>
        <li><b>INSERT(arrName, value, idx?):</b> Insert a row into array</li>
        <li><b>REMOVE(arrName, rowIdx):</b> Remove a row</li>
        <li><b>UPDATE(arrName, idx, value):</b> Update a row</li>
        <li>
          <b>GROUP(arrName, groupByCol, subtotalCol):</b> Group items in an
          array
        </li>
        <li><b>COUNT(arr):</b> Count total rows of array</li>
        <li><b>POP(arr):</b> Return last item in array</li>
      </ul>
      Async Functions (Google sheet / network calls)
      <ul>
        <li>
          <b>SUBMIT(array, sheetTitle):</b> (async) Submit an array as a row to
          Google sheet. The array is 2 dimension (table); Single data will be
          distributed to every row, eg. <br />[OrderNo, [Item1, Price1], [Item2,
          Price2]] will become [[OrderNo, Item1, Price1], [OrderNo, Item2,
          Price2]]
        </li>
        <li>
          <b>RETRIEVE(variableName, sheetTitle, cell):</b> (async) Get a cell or
          range value from Google sheet
        </li>
        <li>
          <b>UPDATECELL(sheetTitle, cell, string):</b> (async) Update a cell in
          Google sheet
        </li>
        <li>
          <b>LETAWAIT(name, asyncValue):</b> Wait for an async (network call
          like SUBMIT/RETRIEVE) then assign the return value to variable
        </li>
        <li><b>CALLAPI(url, method, params):</b> call external API</li>
      </ul>
    </div>
  </NModal>
</template>
<script setup lang="ts">
import { piniaInfo, piniaResize } from "@/lib/common/store";
import { MathFormula24Filled } from "@vicons/fluent";
import { NIcon, NModal } from "naive-ui";
</script>
<style scoped>
.content {
  height: 80vh;
  overflow: auto;
  margin-top: 20px;
}
</style>
