<template>
  <ToolbarItemDropdown
    quaternary
    :options="viewOptions"
    :icon="MenuSharp"
    :onClick="() => exportFile()"
    :disabled="!!piniaInfo().useGrid"
    :style="{marginTop: '-5px'}"
  />
  <SaveHtml v-model:show="showHtmlSave" />
  <input
    ref="openFileInput"
    type="file"
    accept=".pptx,.pub,.docx,.html,.htm,.pdf"
    hidden
    @change="openSelectedFile"
  />
</template>
<script setup lang="ts">
import { translate } from "@/lib/i18n";
import { getFileInfo, getSlideInfo } from "shared-vuejs/editor";

import { FilePdfRegular, FilePowerpointRegular, FileWordRegular } from "@vicons/fa";
import { piniaInfo, piniaSlides } from "@/lib/common/store";
import { computed, onMounted, onBeforeUnmount, ref, shallowRef } from "vue";
import { getAllDexie } from "shared-vuejs/api/db";
import { Application } from "@vicons/carbon";
import ToolbarItemDropdown from "./ToolbarItemDropdown.vue";
import SaveHtml from "../Dialogs/SaveHtml.vue";
import { BrandHtml5 } from "@vicons/tabler";
import {
  FolderOpen24Regular,
  Open24Regular,
  Print24Regular,
  Save24Filled,
} from "@vicons/fluent";
import {
  CloseOutlined,
  InsertDriveFileOutlined,
  MenuSharp,
} from "@vicons/material";
import { Home } from "@vicons/carbon";
import g from "shared-vuejs/api/global";
import { showError, toggleTaskPane } from "@/lib/main/utils";
import { exportFile } from "shared-vuejs/api/html";

import { genId } from "shared-vuejs/api/utility";
import { confirmCloseFile } from "@/lib/main/closeFile";
import { isWordDocument, saveDocument } from "shared-vuejs/api/save-document";

// const disabled = ref(false);
const viewOptions = computed(() => {
  piniaSlides().slideId;
  piniaSlides().sldState;
  return genViewOptions();
});
const showHtmlSave = ref(false);
const openFileInput = ref<HTMLInputElement | null>(null);
const localFiles = shallowRef<any[]>([]);
const windowOptions = computed(() => localFiles.value.map(file => ({
  label: `${!file.name || file.name === "No name" ? "Blank" : file.name} (${String(file.id).slice(-4)})${file.id === getFileInfo()?.id ? " — current" : ""}`,
  key: `file:${file.id}`,
  icon: Open24Regular,
  onClick: () => window.open("/edit/" + file.id),
})));
async function loadLocalFiles() {
  const files = [...(await getAllDexie("files"))];
  localFiles.value = files.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}
const refreshOnFocus = () => void loadLocalFiles();
onMounted(() => { void loadLocalFiles(); window.addEventListener("focus", refreshOnFocus); });
onBeforeUnmount(() => window.removeEventListener("focus", refreshOnFocus));
function genViewOptions() {
  return [
    {
      label: "Workspace",
      key: "home",
      icon: Home,
      size: 24,
      color: 'green',
      onClick: () => location.replace("/"),
    },
    {
      label: "Window",
      key: "window",
      icon: Application,
      children: windowOptions.value,
    },
    {
      type: "divider",
    },
    {
      icon: InsertDriveFileOutlined,
      size: 24,
      onClick: () => (piniaInfo().openNewFileModal = true),
      key: "blank",
      label: "New...",
    },
    {
      label: "Open File...",
      icon: FolderOpen24Regular,
      size: 24,
      key: "open-file",
      onClick: () => openFileInput.value?.click(),
    },
        {
      label: "Save As",
      icon: Save24Filled,
      key: "export",
      children: [
        {
          label: "HTML",
          icon: BrandHtml5,
          color: g.themeOverrides.common.primaryColor,
          size: 24,
          key: "save-html",
          onClick: () => { showHtmlSave.value = true; },
        },
        {
          label: isWordDocument(getFileInfo(), [getSlideInfo()]) ? "DOCX" : "PPTX",
          icon: isWordDocument(getFileInfo(), [getSlideInfo()]) ? FileWordRegular : FilePowerpointRegular,
          size: 24,
          key: "save-file",
          onClick: async () => {
            try { await saveDocument(getFileInfo().id, true); }
            catch (error) { showError(error instanceof Error ? error.message : "Unable to save file"); }
          },
        },
        ...(isWordDocument(getFileInfo(), [getSlideInfo()]) ? [{
          icon: FilePowerpointRegular,
          size: 20,
          key: "export-pptx",
          label: "PPTX",
          onClick: async () => {
            try {
              const { exportPPTX } = await import("shared-vuejs/api/export-pptx");
              await exportPPTX(getFileInfo().id, false, true, true);
            } catch (error) {
              showError(error instanceof Error ? error.message : "Unable to export PPTX");
            }
          },
        }] : []),
        {
          type: "divider",
          key: "save-export-divider",
        },
        {
          icon: FilePdfRegular,
          size: 20,
          onClick: () => doExportPdf(),
          key: "pdf",
          label: "Export PDF",
        },
      ],
    },
    {
      label: "Unload",
      icon: CloseOutlined,
      size: 24,
      key: "close-file",
      color: 'red',
      onClick: () => {
        const fileId = getFileInfo().id;
        void confirmCloseFile(fileId, () => location.replace("/"));
      },
    },
    {
      type: "divider",
    },


    {
      label: "Print",
      icon: Print24Regular,
      bordered: true,
      size: 26,
      key: "print",
      onClick: () => doPrintPdf(),
    },
    // {
    //   label: "Formula Reference...",
    //   icon: MathFormula24Regular,
    //   bordered: true,
    //   size: 24,
    //   key: "formula",
    //   onClick: () => {
    //     piniaInfo().openFormulaRef = true;
    //   },
    // },
    // {
    //   label: "Support...",
    //   icon: PersonFeedback20Regular,
    //   bordered: true,
    //   size: 26,
    //   key: "feedback",
    //   onClick: () => {
    //     window.open("https://www.reddit.com/r/" + g.domainName);
    //   },
    // },
    // {
    //   label: "Home",
    //   icon: Home,
    //   bordered: true,
    //   size: 24,
    //   key: "home",
    //   onClick: () => {
    //     location.replace("/"); // to ensure cleaned up?
    //   },
    // },
  ];
}

async function doExportPdf() {
  const { exportPDF } = await import("shared-vuejs/api/pdf");
  exportPDF();
}

async function doPrintPdf() {
  const { printPDF } = await import("shared-vuejs/api/print");
  printPDF();
}

// async function openImportPpt(newId) {
//   const d = g.globalDialog.success({
//     title: "Open/Import Completed",
//     content: `Open New File In`,
//     positiveText: "New Window",
//     negativeText: "This Window",
//     onPositiveClick: async () => {
//       piniaInfo().loadingBar = "";
//       window.open("/edit/" + newId, "Second");
//     },
//     onNegativeClick: async () => {
//       location.replace("/edit/" + newId);
//     },
//   });
// }

async function openSelectedFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  try {
    const extension = file.name.split(".").pop()?.toLowerCase();
    let newId: string | undefined;
    if (extension === "html" || extension === "htm") {
      piniaInfo().loadingBar = "Opening editable HTML…";
      const { importEditableHtml } = await import("shared-vuejs/api/document-import-importEditableHtml");
      newId = await importEditableHtml(file);
    } else if (extension === "pdf") {
      piniaInfo().loadingBar = "Opening PDF…";
      const { importPdf } = await import("shared-vuejs/api/document-import-importPdf");
      const { fileId } = await importPdf(file, (message: string) => { piniaInfo().loadingBar = message; });
      newId = fileId;
    } else if (extension === "docx") {
      piniaInfo().loadingBar = "Opening Word document…";
      const { submitDocx } = await import("shared-vuejs/api/submitDocx");
      newId = await submitDocx(file, { fileName: file.name, cbAfterProcess: true });
    } else if (extension === "pptx") {
      const { submitPPTX } = await import(
        "shared-vuejs/api/unzipPPTX"
      );
      newId = await submitPPTX(file, {
        fileId: genId(10),
        fileName: file.name,
        slideModeFormat: "sldDownload",
        cbAfterProcess: true,
      });
    } else if (extension === "pub") {
      piniaInfo().loadingBar = "Opening Publisher document…";
      const { submitPub } = await import(
        "shared-vuejs/api/submitPub"
      );
      newId = await submitPub(file, {
        fileName: file.name,
        cbAfterProcess: true,
      });
    } else {
      showError("Choose a PDF, editable HTML, PowerPoint (.pptx), Publisher (.pub), or Word (.docx) file");
    }

    if (newId) {
      // await openImportPpt(newId);
      location.replace("/edit/" + newId);
    }
  } catch (error) {
    console.error("File import failed:", error);
    piniaInfo().loadingBar = "";
    showError(error instanceof Error ? error.message : "Unable to open file");
  } finally {
    input.value = "";
  }
}
</script>
