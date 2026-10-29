<template>
  <div class="table-picker" @pointerdown.prevent.stop>
    <div class="table-size" aria-live="polite">
      {{ columns && rows ? `${columns} × ${rows} Table` : 'Insert Table' }}
    </div>
    <div class="table-grid" @pointerleave="clearPreview">
      <template v-for="row in 8" :key="row">
        <button
          v-for="column in 10"
          :key="column"
          type="button"
          class="table-square"
          :class="{ highlighted: column <= columns && row <= rows }"
          :aria-label="`${column} columns, ${row} rows`"
          @pointerenter="preview(column, row)"
          @focus="preview(column, row)"
          @click.stop="emit('select', column, row)"
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
const emit = defineEmits<{ select: [columns: number, rows: number] }>();
const columns = ref(0);
const rows = ref(0);
function preview(column: number, row: number) {
  columns.value = column;
  rows.value = row;
}
function clearPreview() {
  columns.value = rows.value = 0;
}
</script>

<style scoped>
.table-picker { padding: 8px 12px 12px; }
.table-size { margin-bottom: 8px; font-size: 13px; min-height: 20px; }
.table-grid { display: grid; grid-template-columns: repeat(10, 20px); gap: 3px; }
.table-square {
  width: 20px;
  height: 20px;
  padding: 0;
  border: 1px solid #aaa;
  background: #fff;
  border-radius: 2px;
  cursor: pointer;
}
.table-square.highlighted { background: #d3fad4; border-color: #29923a; }
.table-square:focus-visible { outline: 2px solid #29923a; outline-offset: 1px; }
</style>
