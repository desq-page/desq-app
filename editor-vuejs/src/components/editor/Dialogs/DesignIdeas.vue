<template>
  <DialogBase title="Design Ideas">
    <div class="design-ideas">
      <p class="instruction">{{ unavailable ? "Open a presentation in slide view to apply a family." :
        "Click Apply beside a family to apply it to all slides." }}</p>
      <p v-if="status" class="status" role="status">{{ status }}</p>
      <div class="families" :aria-busy="!!applyingFamily">
        <div v-for="family in families" :key="family.slug" class="family">
          <div class="family-header">
            <span class="family-name">{{ family.name }}</span>
            <button class="apply-family" type="button" :aria-label="`Apply ${family.name} to all slides`"
              :disabled="unavailable || !!info.loadingBar || !!applyingFamily"
              @click="applyFamily(family)">
              {{ applyingFamily === family.slug ? "Applying…" : "Apply" }}
            </button>
          </div>
          <div class="previews">
            <img v-for="index in 2" :key="index" :src="previewUrl(family.slug, index)"
              alt="" loading="lazy" decoding="async" width="320" height="180" />
          </div>
        </div>
      </div>
    </div>
  </DialogBase>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { piniaInfo, piniaSlides } from "@/lib/common/store";
import { showMessage } from "@/lib/main/utils";
import { getFileInfo } from "shared-vuejs/editor";
import sourceFamilies from "@/lib/design/template-catalog.json";
import generatedFamilies from "@/lib/design/generated-template-catalog.json";
import DialogBase from "@/components/common/Layouts/DialogBase.vue";

const info = piniaInfo();
const slides = piniaSlides();
const status = ref("");
const applyingFamily = ref("");
const families = [...sourceFamilies, ...generatedFamilies].sort((a, b) => a.name.localeCompare(b.name));
const unavailable = computed(() => {
  const file = getFileInfo();
  return !slides.slideId || slides.masterView || !!info.useGrid || !file?.slides?.length ||
    file.sourceFormat === "docx" || !!file.docPageGeometry;
});

function previewUrl(slug: string, index: number) {
  return `${import.meta.env.BASE_URL}templates/design-families/${slug}-${index}.webp`;
}

async function applyFamily(family: { slug: string; name: string }) {
  if (unavailable.value || info.loadingBar || applyingFamily.value) return;
  const fileId = getFileInfo().id;
  applyingFamily.value = family.slug;
  const progress = (message: string) => { status.value = info.loadingBar = message; };
  progress(`Preparing ${family.name} layouts…`);
  try {
    const { reformatSlides } = await import("@/lib/design/reformat-slides");
    if (getFileInfo()?.id !== fileId) throw new Error("The presentation changed. Choose a family again.");
    const { reformatted, skipped, added } = await reformatSlides(progress, family.slug);
    showMessage(`Applied ${family.name} layouts to ${reformatted} of ${reformatted + skipped} slides.` +
      (skipped ? ` ${skipped} kept their current layout.` : "") +
      (added ? " Added a closing slide." : ""));
  } catch (cause) {
    showMessage(cause instanceof Error ? cause.message : String(cause), undefined, "error");
  } finally {
    status.value = "";
    info.loadingBar = "";
    applyingFamily.value = "";
  }
}
</script>

<style scoped>
.design-ideas { display: flex; flex-direction: column; height: 100%; box-sizing: border-box; }
.instruction, .status { margin: 8px 0; font-size: 13px; }
.families {
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  display: grid;
  grid-auto-rows: max-content;
  gap: 8px;
  padding: 3px;
}
.family {
  display: grid;
  gap: 6px;
  width: 100%;
  min-width: 0;
  padding: 8px;
  box-sizing: border-box;
  text-align: left;
  font: inherit;
  color: #222836;
  background: white;
  border: 1px solid #cbd1da;
  border-radius: 6px;
}
.family-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.family-name { font-size: 13px; font-weight: 600; }
.apply-family {
  flex-shrink: 0;
  padding: 4px 10px;
  font: inherit;
  font-size: 12px;
  color: #315fd2;
  background: white;
  border: 1px solid #315fd2;
  border-radius: 4px;
  cursor: pointer;
}
.apply-family:not(:disabled):hover { background: #eef2ff; }
.apply-family:focus-visible { outline: 2px solid #315fd2; outline-offset: 2px; }
.apply-family:disabled { cursor: default; opacity: .65; }
.previews { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
.previews img { display: block; width: 100%; height: auto; aspect-ratio: 16 / 9; object-fit: contain; background: #eef1f5; }
</style>
