<template>
  <LayoutHeader label="3D Format" :arrow="false" />
  <div class="fields-3d">
    <label for="effect-bevel">Bevel</label>
    <select id="effect-bevel" :value="value('bevel')" @change="set('bevel', ($event.target as HTMLSelectElement).value, true)">
      <option value="none">None</option>
      <option v-if="!bevelPresets.includes(value('bevel'))" :value="value('bevel')">{{ value('bevel') }}</option>
      <option value="circle">Circle</option>
      <option value="angle">Angle</option>
      <option value="relaxedInset">Relaxed inset</option>
      <option value="softRound">Soft round</option>
      <option value="hardEdge">Hard edge</option>
      <option value="slope">Slope</option>
      <option value="cutout">Cutout</option>
    </select>
    <label for="effect-bevel-width">Bevel width (px)</label>
    <NInputNumber :input-props="{ id: 'effect-bevel-width' }" :value="value('bevelWidth')" :min="0" :max="200" :step="1" size="small" :on-update:value="v => set('bevelWidth', v)" @blur="saveDexie" />
    <label for="effect-bevel-height">Bevel height (px)</label>
    <NInputNumber :input-props="{ id: 'effect-bevel-height' }" :value="value('bevelHeight')" :min="0" :max="200" :step="1" size="small" :on-update:value="v => set('bevelHeight', v)" @blur="saveDexie" />
    <label for="effect-extrusion">Extrusion depth (px)</label>
    <NInputNumber :input-props="{ id: 'effect-extrusion' }" :value="value('extrusion')" :min="0" :max="200" :step="1" size="small" :on-update:value="v => set('extrusion', v)" @blur="saveDexie" />
    <label for="effect-lighting">Lighting angle (°)</label>
    <NInputNumber :input-props="{ id: 'effect-lighting' }" :value="value('lighting')" :min="0" :max="360" :step="1" size="small" :on-update:value="v => set('lighting', v)" @blur="saveDexie" />
  </div>
  <LayoutHeader label="3D Rotation" :arrow="false" />
  <div class="fields-3d">
    <template v-for="axis in axes" :key="axis">
      <label :for="`effect-rotation-${axis}`">{{ axis.toUpperCase() }} rotation (°)</label>
      <NInputNumber :input-props="{ id: `effect-rotation-${axis}` }" :value="value(axis)" :min="-360" :max="360" :step="1" size="small" :on-update:value="v => set(axis, v)" @blur="saveDexie" />
    </template>
  </div>
</template>
<script setup lang="ts">
import { NInputNumber } from 'naive-ui';
import { getShapeDeep, getSelectSelShpFormat, updateShape } from 'shared-vuejs/editor';
import { saveDexie } from 'shared-vuejs/api/dbutils';
import { EMU } from 'shared-vuejs/api/globalUtility';
import { genScene3d } from 'shared-vuejs/api/sp3d';
import LayoutHeader from '@/components/common/Layouts/LayoutHeader.vue';
import { piniaSelect } from '@/lib/common/store';
import { read3dValue, set3dValue } from './three-d-format.mjs';
const axes = ['x', 'y', 'z'];
const bevelPresets = ['none', 'circle', 'angle', 'relaxedInset', 'softRound', 'hardEdge', 'slope', 'cutout'];
function value(field: string) { return read3dValue(piniaSelect().selShpFormat, field, EMU, genScene3d); }
function set(field: string, next: string | number | null, save = false) {
  if (next == null || (typeof next === 'number' && !Number.isFinite(next))) return;
  const id = getSelectSelShpFormat()?.id;
  const shape = id && getShapeDeep(id);
  if (!shape) return;
  updateShape(set3dValue(shape, field, next, EMU, genScene3d));
  if (save) saveDexie();
}
</script>
<style scoped>
.fields-3d { display: grid; grid-template-columns: minmax(0, 1fr) 110px; gap: 8px; align-items: center; padding: 0 0 8px; }
.fields-3d label { font-size: 12px; }
.fields-3d select { width: 100%; min-height: 28px; }
</style>
