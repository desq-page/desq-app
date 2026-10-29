<template>
  <NModal
    v-model:show="piniaInfo().openPublishModal"
    :mask-closable="true"
    preset="dialog"
    :title="`Publish to Web: ${getFileInfo()?.title}`"
    :closable="true"
    :style="{
      cursor: !disabled ? 'auto' : 'wait',
      width: '50vw',
      minWidth: '360px',
      height: '60vh',
    }"
    class="publish-modal"
  >
    <template #icon>
      <NIcon><Globe24Regular /></NIcon>
    </template>
    <CloudflarePublish v-if="publishTarget === 'cloudflare'" :disabled="disabled" />
    <NFlex class="publishInfo" vertical v-else-if="!piniaSession().uid">
      <NFlex>Sign in to publish</NFlex>

      <LoginPage />
    </NFlex>
    <div class="publishInfo" vertical v-else>
      <div class="subtitle">Publishing Settings</div>
      <NFlex vertical>
        <div>
          <span>Enter file URL (public link):</span>
          <div>
            <span style="font-weight: bold">{{ publishUrl }}</span>
            <input
              :value="serverPath"
              v-maska:[maskaOptions]
              data-maska="A A"
              @input="updatePublishTitle"
              style="margin-left: 3px; width: 40%; max-width: 400px"
              :disabled="!!getFileInfo().publish?.path"
            />
          </div>
        </div>

        <NFlex>
          <NButton
            @click="publishFile()"
            :disabled="disabled || !serverPath"
            type="primary"
          >
            <template #icon>
              <NIcon size="20"><CloudUpload /></NIcon>
            </template>
            <span>{{
              getFileInfo().publish.path ? "Update" : "Publish"
            }}</span>
          </NButton>
          <!-- <NButton
            @click="
              () =>
                deleteServerFile(
                  getFileInfo().id,
                  getFileInfo().filename,
                )
            "
            :disabled="disabled"
            type="primary"
            color="#FF0000"
            v-if="serverPath"
          >
            <template #icon>
              <NIcon size="20"><CloudOffOutlined /></NIcon>
            </template>
            <span>Unpublish</span>
          </NButton> -->
        </NFlex>
      </NFlex>
      <NFlex>
        <!-- <NButton @click="copyLink" :disabled="disabled" type="tertiary">
          <template #icon>
            <NIcon size="20"><CopyLink /></NIcon>
          </template>
          <span>Copy Link</span>
        </NButton>
        <NButton @click="openLink" :disabled="disabled" type="tertiary">
          <template #icon>
            <NIcon size="20"><ExternalLink /></NIcon>
          </template>
          <span>Open Link</span>
        </NButton> -->
      </NFlex>
      <!-- <div class="guide">
        <span>Alternate publishing method: download as </span>
        <b>
          <button
            style="cursor: pointer"
            @click="
              exportZip(
                getFileInfo().id,
                getFileInfo().title,
                true,
                true,
              )
            "
          >
            HTML (zip)
          </button>
        </b>
        <span>, then upload it to your own web server.</span>
      </div> -->
      <hr style="border-top: 1px solid #ccc; margin: 20px 0" />
      <div v-if="serverFiles?.length > 0">
        <div class="subtitle">
          {{ `Published Files` }}
        </div>

        <NFlex
          vertical
          v-for="serverFile in serverFiles"
          :key="serverFile.id"
          style="width: 100%; margin-bottom: 20px"
        >
          <div style="font-weight: bold">
            <a href="#" @click="openFile(serverFile.path)">
              <span>
                ➤ https://go.{{ g.domainName }}.com/{{ serverFile.path }}
              </span>
            </a>
          </div>
          <NFlex style="font-style: italic">
            <div>{{ dayjs(serverFile.timestamp).format("DD/MM hh:mm A") }}</div>
            <div>
              {{ `${serverFile?.slides} slides` }}
            </div>
            <div>
              {{ `${round2(serverFile.size / 1000000)} MB` }}
            </div>
          </NFlex>
          <NFlex>
            <ToolbarItem
              :onClick="() => copyLink(serverFile.path)"
              :icon="CopyAllSharp"
              :size="25"
              label="Copy Link"
            />
            <ToolbarItem
              :onClick="
                () => deleteServerFile(serverFile.id, serverFile.filename)
              "
              color="#FF0000"
              :icon="CloudOffOutlined"
              :size="25"
              label="Unpublish..."
            />
          </NFlex>
        </NFlex>
        <div class="footer">
          (Total published size :
          {{
            serverFiles.reduce(
              (size, file) => round2(size + file.size / 1000000),
              0,
            )
          }}
          MB)
        </div>
      </div>
    </div>
  </NModal>
</template>
<script setup lang="ts">
import { updateFile, getFileInfo } from "shared-vuejs/editor";

import { piniaInfo, piniaSession, piniaSlides } from "@/lib/common/store";
import { vMaska } from "maska";

import LoginPage from "@/pages/LoginPage.vue";
import { uploadFile } from "shared-vuejs/api/upload-client.js";
import { getSocketData } from "shared-vuejs/api/socket-client";
import dayjs from "dayjs";
import { packageFile } from "shared-vuejs/api/export-zip";
import { CloudUpload } from "@vicons/carbon";
import { round2 } from "shared-vuejs/api/utility";
import { computed, nextTick, ref, watch } from "vue";
import { NModal, NButton, NFlex, NIcon } from "naive-ui";
import { publishBackend } from "shared-vuejs/api/backend-config";
import CloudflarePublish from "./CloudflarePublish.vue";
import { Globe24Regular } from "@vicons/fluent";
import { saveDexie } from "shared-vuejs/api/dbutils";
import g from "shared-vuejs/api/global";
import { CloudOffOutlined, CopyAllSharp } from "@vicons/material";
import ToolbarItem from "../Toolbars/ToolbarItem.vue";
import { showError } from "shared-vuejs/api/utils";


const downloadBlobUrl = ref("");
const publishTarget = publishBackend === "cloudflare" ? "cloudflare" : "server";

// const dialog = useDialog();

// const fileTitle = ref(
//   getFileInfo().publish?.title || getFileInfo().title,
// );

const serverPath = ref("");

const serverFiles: any = ref([]);

const publishUrl = computed(
  () => `https://go.${g.domainName}.com/${piniaSession().uname}/`,
);

defineProps({
  disabled: Boolean,
});

watch(
  () => piniaInfo().openPublishModal,
  () => {
    if (piniaInfo().openPublishModal && publishTarget === "server") {
      loadServerFiles();
      nextTick(async () => {
        const blob = await packageFile(
          getFileInfo().id,
          true, // hide loading
        );
        piniaInfo().loadingBar = "";
        downloadBlobUrl.value = URL.createObjectURL(blob);
      });
    } else {
      URL.revokeObjectURL(downloadBlobUrl.value);
    }
  },
);

watch(
  () => piniaSession().uid,
  () => {
    if (piniaSession().uid && publishTarget === "server") {
      loadServerFiles();
    }
  },
);

const maskaOptions: any = {
  tokens: {
    A: {
      pattern: /[A-Za-z0-9\s-]/,
      multiple: true,
      transform: (chr) => chr.replace(/\s/g, "-").toLowerCase(),
    },
  },
  postProcess: (val) => {
    return val.replace(/\s/g, "-").toLowerCase().trim();
  },
};

function updatePublishTitle(e) {
  serverPath.value = e.target.value.trim();
}

async function publishFile() {
  // check fileTitle
  const newPath = `${piniaSession().uname}/${serverPath.value}`;
  if (
    serverFiles.value.find(
      (sF) => sF.path == newPath && sF.id !== getFileInfo().id,
    )
  ) {
    showError("URL already exists!");
    return;
  }
  piniaInfo().loadingBar = "Preparing...";
  const output = await packageFile(getFileInfo().id, false);
  piniaInfo().loadingBar = "Publishing...";

  await uploadFile(
    getFileInfo().id + ".zip",
    output,
    getFileInfo().id,
    {
      filename: serverPath.value,
      title: getFileInfo().title,
      slides: getFileInfo().slides.length,
      publish: true, // mark for publish
    },
  );
  piniaInfo().loadingBar = "Please wait...";
  // await new Promise((resolve) => {
  //   setTimeout(() => resolve(true), 3000);
  // });
  // openPlayerWindow(getFileInfo().publish?.scroll);
  updateFile({
    publish: {
      ...getFileInfo().publish,
      path: newPath,
    },
  });

  // serverPath.value = fileTitle.value;
  await saveDexie();
  await loadServerFiles();
  piniaInfo().loadingBar = "";
}

// function openLink() {
//   window.open(publishUrl.value, "slide");
// }

function copyLink(path) {
  // Copy the text inside the text field
  navigator.clipboard.writeText(`https://go.${g.domainName}.com/${path}/`);
}

function openFile(path) {
  window.open(`https://go.${g.domainName}.com/${path}/`, "slide");
}

async function deleteServerFile(id, filename) {
  g.globalDialog.warning({
    title: "Confirm",
    content: "Unpublish this file?",
    positiveText: "Unpublish",
    negativeText: "Cancel",
    onPositiveClick: async () => {
      await getSocketData("deleteFile", { id, filename });
      updateFile({
        publish: {
          ...getFileInfo().publish,
          path: "",
        },
      });

      saveDexie();
      loadServerFiles();
    },
  });
}

async function loadServerFiles() {
  // fileTitle.value =
  //   getFileInfo().publish?.title || getFileInfo().title;

  const data = await getSocketData("serverFiles");
  // console.log(data.files);
  // data.files.sort((a, b) =>
  //   dayjs(a.timestamp).isBefore(dayjs(b.timestamp)) ? 1 : -1
  // );
  const currentFile = data?.files?.find(
    (f) => f.id == getFileInfo().id && f.path,
  );
  if (currentFile) {
    serverPath.value = currentFile?.path?.split("/")?.[1] || "";
  } else {
    updateFile({
      publish: {
        ...getFileInfo().publish,
        path: "",
      },
    });
    saveDexie();
  }
  serverFiles.value = data?.files.filter((f) => f.path) || [];
}
</script>
<style scoped>
/* .guide {
  width: calc(100% - 20px);
  min-width: 150px;
  padding: 10px;
  background: rgb(230, 230, 193);
  display: none;
} */

.subtitle {
  font-size: 16px;
  font-weight: bold;
  margin: 10px 0 5px 0;
}

.footer {
  font-style: italic;
  font-weight: bold;
}

.field {
  margin: 10px 0;
}
</style>

<style>
.publish-modal .n-dialog__content {
  height: calc(100% - 30px);
  overflow-y: auto;
  overflow-x: hidden;
}
</style>
