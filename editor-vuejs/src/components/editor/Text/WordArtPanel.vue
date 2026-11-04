<template>
  <LayoutHeader label="WordArt Transform" />
  <div class="wordart-grid">
    <button class="wordart-choice" :class="{ active: !current }" @click="apply('')" title="Remove transform">None</button>
    <button v-for="preset in wordArtPresets" :key="preset.value" class="wordart-choice"
      :class="{ active: current === preset.value }" :title="preset.label" :aria-label="preset.label"
      :aria-pressed="current === preset.value" @click="apply(preset.value)">
      <svg viewBox="0 0 120 56" aria-hidden="true" v-html="preview(preset.value)" />
      <span>{{ preset.label }}</span>
    </button>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { piniaSelect } from '@/lib/common/store';
import LayoutHeader from '@/components/common/Layouts/LayoutHeader.vue';
import { wordArtPresets, wordArtPreset, wordArtSvg, setWordArt } from 'shared-vuejs/api/wordart';
const current = computed(() => wordArtPreset(piniaSelect().selShpFormat?.txBody?.bodyPr));
const preview = (preset: string) => wordArtSvg(preset, [{ runs: [{ text: 'WordArt', fill: '#263f70', fontWeight: 'bold' }] }], 120, 56, 'wordart-preview-' + preset);
const apply = (preset: string) => setWordArt(preset);
</script>
<style scoped>
.wordart-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; width: 100%; }
.wordart-choice { cursor: pointer; border: 1px solid #ddd; border-radius: 5px; background: #fff; color: #333; min-height: 76px; padding: 5px; font: inherit; font-size: 11px; }
.wordart-choice:hover { background: #f0f5ff; }
.wordart-choice.active { border-color: #4874bf; background: #e9f0ff; }
.wordart-choice svg { display: block; width: 100%; height: 48px; overflow: visible; }
</style>
