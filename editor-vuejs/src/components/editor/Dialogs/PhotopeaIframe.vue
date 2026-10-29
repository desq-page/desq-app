<template>
  <NModal
    :show="!!piniaInfo().openImagePhotopea"
    transform-origin="center"
    transition-delay="0"
    :mask-closable="false"
    preset="dialog"
    title="Preview"
    :closable="false"
    :style="{
      cursor: 'auto',
      left: '30px',
      width: 'calc(100vw - 60px)',
      maxWidth: '100vw',
      height: 'calc(100vh - 60px)',
      overflow: 'hidden',
      padding: 0,
      margin: 0,
    }"
  >
    <template #header>
      <NFlex
        justify="space-between"
        align="center"
        style="width: 100%; margin-top: 5px"
      >
        <div>Edit image in Photopea</div>
        <NFlex align="center">
          {{ userGuide }}
        </NFlex>
        <NButton quaternary @click="closeSave"
          ><template #icon
            ><NIcon :size="30"><CloseOutlined /></NIcon></template
        ></NButton>
      </NFlex>
      <div>&nbsp;</div>
    </template>
    <template #icon>
      <ImageEdit20Regular />
    </template>
    <iframe
      ref="ifr"
      :src="ifrSrc"
      width="100%"
      height="100%"
      @load="sendIfrImage"
      :style="{
        width: 'calc(100vw - 60px)',
        height: 'calc(100vh - 47px - 60px)',
        overflow: 'hidden',
      }"
    />
  </NModal>
</template>
<script setup lang="ts">
import { NButton, NFlex, NIcon, NModal } from "naive-ui";
import { computed, onMounted, ref } from "vue";
import { piniaInfo } from "@/lib/common/store";
import { insertBlobImage } from "shared-vuejs/api/insertBlob";

import { ImageEdit20Regular } from "@vicons/fluent";
import { CloseOutlined } from "@vicons/material";
import g from "shared-vuejs/api/global";
import { toProperCase } from "shared-vuejs/api/utility";

// const dialog = useDialog();

const ifrSrc = computed(() => {
  if (piniaInfo().openImagePhotopea) {
    let url = piniaInfo().openImagePhotopea;
    if (typeof url == "string" && url.startsWith("http")) {
      // force reload!
      url += "?" + Math.random();
    }
    // return "https://www.photopea.com#%7B%22files%22%3A%5B%22https%3A%2F%2Fwww.photopea.com%2Fapi%2Fimg2%2Fpug.png%22%5D%2C%22environment%22%3A%7B%7D%7D"
    return (
      "https://www.photopea.com#" +
      JSON.stringify({
        // files: [url],
        environment: {
          customIO: {
            save: "app.activeDocument.saveToOE('png')",
          },
        },
      })
    );
  } else {
    return "";
  }
});
const ifr = ref(null as any);
const userGuide = ref("Please wait...");

async function sendIfrImage() {
  if (piniaInfo().openImagePhotopea) {
    const buf = await piniaInfo().openImagePhotopea.arrayBuffer();
    ifr.value.contentWindow.postMessage(buf, "*");
  }
}

onMounted(() => {
  window.addEventListener("message", (e: MessageEvent) => {
    if (e.origin == "https://www.photopea.com") {
      if (e.data == "done") {
        userGuide.value = `To save changes, select menu 'File -> Save'`;
      } else if (e.data?.constructor == ArrayBuffer) {
        piniaInfo().openImagePhotopea = "";
        userGuide.value = "Please wait...";
        const blob = new Blob([e.data], {
          type: "image/png",
        });
        insertBlobImage(blob);
        // }
      }
    }
  });
});

function closeSave() {
  g.globalDialog.warning({
    title: "Confirm",
    content: `Save changes to ${toProperCase(g.domainName)}?`,
    positiveText: "Yes",
    negativeText: "No",
    onPositiveClick: async () => {
      ifr.value.contentWindow.postMessage(
        "app.activeDocument.saveToOE('png')",
        "*",
      );
    },
    onNegativeClick: () => {
      ifr.value.contentWindow.postMessage("app.activeDocument.close(0)", "*");
      setTimeout(() => (piniaInfo().openImagePhotopea = ""), 100);
    },
  });
}
</script>

<style scoped>
.guide {
  width: 10vw;
  min-width: 150px;
  padding: 10px;
  background: rgb(230, 230, 193);
  border-radius: 12px;
}

.publishInfo {
  padding: 10px;
  max-width: 50vw;
  background-color: antiquewhite;
}

.setting-title {
  font-weight: bold;
  margin-top: 20px;
}
</style>
