<template>
  <NModal
    v-model:show="piniaInfo().openNewFileModal"
    :mask-closable="false"
    preset="dialog"
    title="New File"
    :style="{ width: '620px', maxWidth: 'calc(100vw - 32px)' }"
  >
    <template #icon><InsertDriveFileOutlined /></template>
    <div class="template-list">
      <button
        v-for="option in templates"
        :key="option.tpl"
        type="button"
        class="template-card"
        :class="{ selected: tpl === option.tpl, word: option.app === 'D', publisher: option.app === '▤' }"
        :aria-pressed="tpl === option.tpl"
        @click="tpl = option.tpl"
        @dblclick="openTemplate(option.tpl)"
      >
        <span class="preview" aria-hidden="true">
          <span class="page-icon" :class="option.orientation">
            <span class="page-lines"><i></i><i></i><i></i></span>
            <span class="app-icon">{{ option.app }}</span>
          </span>
        </span>
        <span class="template-label">{{ option.label }}</span>
        <span class="app-label">{{ option.appName }}</span>
      </button>
    </div>
    <div class="action">
      <NButton type="primary" :disabled="!tpl" @click="openTemplate(tpl)">
        Create {{ templates.find(option => option.tpl === tpl)?.label || 'File' }}
      </NButton>
    </div>
  </NModal>
</template>
<script setup lang="ts">
import { piniaInfo } from "@/lib/common/store";
import { NModal, NButton } from "naive-ui";
import { ref } from "vue";
import { createNewFile } from "shared-vuejs/api/load";
import { InsertDriveFileOutlined } from "@vicons/material";
import { showError } from "@/lib/main/utils";

const templates = [
  { tpl: "blank", label: "Presentation", app: "P", appName: "PPTX", orientation: "landscape" },
  { tpl: "portrait", label: "Publication", app: "▤", appName: "PPTX", orientation: "portrait" },
  { tpl: "blank.docx", label: "Document", app: "D", appName: "DOCX", orientation: "portrait" },
];
const tpl = ref("");

async function openTemplate(tplValue: string) {
  piniaInfo().openNewFileModal = false;
  piniaInfo().loadingBar = "Please wait...";
  try {
    await createNewFile(tplValue || "blank");
  } catch (error) {
    piniaInfo().loadingBar = "";
    showError(error instanceof Error ? error.message : "Unable to create file");
  }
}
</script>
<style scoped>
.template-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-top: 20px;
}
.template-card {
  --app-color: #c43e1c;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 18px 8px 16px;
  border: 2px solid transparent;
  border-radius: 10px;
  background: rgba(128, 128, 128, 0.07);
  color: inherit;
  font: inherit;
  cursor: pointer;
}
.template-card.word { --app-color: #2b579a; }
.template-card.publisher { --app-color: #4b8c72; }
.template-card:hover { background: rgba(128, 128, 128, 0.13); }
.template-card.selected { border-color: var(--app-color); }
.template-card:focus-visible { outline: 2px solid var(--app-color); outline-offset: 3px; }
.preview {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 110px;
  margin-bottom: 16px;
}
.page-icon {
  position: relative;
  display: block;
  box-sizing: border-box;
  border: 2px solid var(--app-color);
  border-radius: 5px;
  background: white;
  box-shadow: 3px 4px 0 rgba(0, 0, 0, 0.08);
}
.page-icon.landscape { width: 112px; height: 72px; }
.page-icon.portrait { width: 72px; height: 100px; }
.page-lines { position: absolute; top: 20px; left: 20px; right: 12px; }
.page-lines i { display: block; height: 3px; margin-bottom: 8px; background: var(--app-color); opacity: 0.25; }
.app-icon {
  position: absolute;
  left: -15px;
  bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 4px;
  background: var(--app-color);
  color: white;
  font-size: 25px;
  font-weight: 700;
  box-shadow: 2px 2px 5px rgba(0, 0, 0, 0.15);
}
.template-label { font-size: 15px; font-weight: 600; }
.app-label { margin-top: 4px; font-size: 12px; opacity: 0.65; }
.save-label { margin-top: 3px; font-size: 11px; opacity: 0.65; }
.action { display: flex; justify-content: flex-end; margin-top: 24px; }
@media (max-width: 480px) {
  .template-list { gap: 6px; }
  .template-card { padding: 14px 3px; }
  .page-icon.landscape { width: 76px; height: 50px; }
  .page-icon.portrait { width: 56px; height: 78px; }
  .app-icon { width: 30px; height: 30px; left: -8px; font-size: 20px; }
  .template-label { font-size: 13px; }
}
</style>
