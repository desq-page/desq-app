<template>
  <button @click="uploadClick">
    <span :style="labelStyle">
      {{
        label ||
        (type == "pptx"
          ? "Open .pptx"
          : type == "ttf"
            ? " Upload Font"
            : "Insert Media")
      }}</span
    >
  </button>
  <input
    type="file"
    :accept="
      type == 'pptx'
        ? '.pptx'
        : type == 'zip'
          ? '.slx'
          : type == 'ttf'
            ? '.ttf, .otf'
            : acceptedFileTypes
    "
    size="1"
    style="position: absolute; left: -9999em"
    @change="fileSelected"
    ref="fileInput"
  />
  <input type="hidden" name="fileId" />
</template>
<script setup lang="ts">
import { updateFile, getFileInfo } from "shared-vuejs/editor";

import { genId } from "shared-vuejs/api/utility";
import { startUpload } from "shared-vuejs/api/upload";
import { ref } from "vue";
import { piniaInfo, piniaSlides } from "@/lib/common/store";
// import { FilePowerpointRegular } from "@vicons/fa";
// import { FileZip } from "@vicons/tabler";
// import { showError } from "shared-vuejs/api/utils";
// import { extractGzipToJson } from "shared-vuejs/src/lib/gzipUtils";
import { saveDexie } from "shared-vuejs/api/dbutils";
import { acceptedFileTypes } from "shared-vuejs/api/insertBlob";

//@ts-ignore //?raw to import assets as string
import { showError } from "shared-vuejs/api/utils";


const props = defineProps({
  mode: String,
  type: String,
  label: String,
  labelStyle: Object,
  icon: Object,
  iconColor: String,
  uploadComplete: Function,
  buttonType: null,
  buttonSize: String,
  ghost: Boolean,
  width: String,
  align: String,
  cbAfterProcess: Function,
});

const fileInput: any = ref(null);

function uploadClick() {
  fileInput.value?.click();
}

async function fileSelected(e) {
  const file = e.target.files[0];
  if (file) {
    if (/\.pptx$/i.test(file.name)) {
      openPPTX(file);
    } else if (file.name.endsWith(".zip") || file.name.endsWith(".slx")) {
      openZIP(file);
    } else if (file.name.endsWith(".ttf") || file.name.endsWith(".otf")) {
      const { name, family }: any = await updateFont(file);
      if (props.uploadComplete) {
        props.uploadComplete(name, family);
      }
    } else {
      await startUpload(e, {
        fileId: getFileInfo().id,
        file,
      });
      if (props.uploadComplete) {
        props.uploadComplete();
      }
    }
  }
}

async function openPPTX(file) {
  if (file) {
    // const { pptxToJson } = await import("shared-vuejs/api/unzipPPTX");
    // console.log(await pptxToJson(file));
    // piniaInfo().loadingBar = { pct: 10 };
    // const file = fileInput.value.files[0];
    // if (file.size > 400000000) {
    //   showError("File too large!");
    //   return;
    // }
    const pptxSettings: any = {};
    pptxSettings.fileName = file.name;
    pptxSettings.fileId = genId(10); //"p" + crc32(file.name).toString(16);
    pptxSettings.slideModeFormat = "sldDownload";
    pptxSettings.cbAfterProcess = props.cbAfterProcess;
    // piniaInfo().curPPTXUpload = {
    //   file,
    //   pptxSettings,
    // };
    piniaInfo().loadingBar = { desc: "Loading...", pct: 1 };
    const { submitPPTX } = await import("shared-vuejs/api/unzipPPTX");
    submitPPTX(file, pptxSettings);
    // fileInput.value.value = "";
  }
}

async function openZIP(file) {
  if (file) {
    // const file = fileInput.value.files[0];
    // fileInput.value.value = "";
    const { openZipFile } = await import("shared-vuejs/api/unzipPPTX");
    await openZipFile(file, undefined, undefined, props.cbAfterProcess);
  }
}

async function updateFont(file) {
  if (file) {
    piniaInfo().loadingBar = "Uploading font file...";
    // const file = fileInput.value.files[0];
    // fileInput.value.value = "";
    const { ttfbuf2woff } = await import("shared-vuejs/api/unzipPPTX");
    const font = await ttfbuf2woff(
      await file.arrayBuffer(),
      file.name,
      getFileInfo().id,
    );
    const { name, family } = font;
    if (name && family) {
      updateFile({
        fonts: [
          ...(getFileInfo().fonts || []),
          {
            ...font,
            type: "local",
          },
        ],
      });
      await saveDexie();
    } else {
      showError("Font format has error when import");
    }
    piniaInfo().loadingBar = "";
    return { name, family };
  }
}
</script>
