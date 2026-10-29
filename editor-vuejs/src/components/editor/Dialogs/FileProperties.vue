<template>
  <n-input
    v-model:value="title"
    type="text"
    @keydown.enter.prevent="(e) => updateProp(e, 'title')"
    @blur="(e) => updateProp(e, 'title')"
  />
  <LayoutHeader label="Editor Settings"></LayoutHeader>
  <div>
    <ToolbarItemSwitch
      label="Show Ruler"
      :defaultVal="!!piniaResize().showRuler"
      :onClick="updateShowRuler"
    />
  </div>
  <!-- <LayoutHeader label="File Variables"></LayoutHeader>
  <div style="margin-top: -10px">
    <ToolbarItem
      quaternary
      @click="addVar"
      :icon="Add24Regular"
      label="Add Variable"
      buttonType="primary"
    />
    <div class="var-row" v-for="varName in Object.keys(vars)" :key="varName">
      <input
        :value="varName"
        type="text"
        placeholder="Enter Variables"
        @change="updateVarName"
      />
      <input
        :value="stringify(vars[varName])"
        type="text"
        placeholder="Default value"
        @change="(e) => updateVarValue(e, varName)"
      />
      <ToolbarItem
        bordered
        :icon="Edit"
        tooltip="Edit value"
        :onClick="() => openVar(varName)"
      />
      <ToolbarItem
        bordered
        quaternary
        :icon="Trash"
        color="#FF0000"
        tooltip="Delete variable"
        :onClick="() => deleteVar(varName)"
      />
    </div>
  </div>
  <LayoutHeader label="Data Connection"></LayoutHeader>
  <NFlex class="publishInfo" vertical v-if="!piniaSession().uid">
    <NFlex>Sign in to connect data</NFlex>
    <LoginPage />
  </NFlex>
  <div v-else>
    Connect to Google Sheets:
    <div class="guide">
      <ol>
        <li>Create a sheet or copy from demo templates</li>
        <li>
          Share with
          <a href="" @contextmenu.stop
            >demoapp@offslide.iam.gserviceaccount.com</a
          >
        </li>
        <li>Copy link of the share and paste here</li>
      </ol>
    </div>

    <n-input
      v-model:value="gsheet"
      type="textarea"
      placeholder="https://docs.google.com/spreadsheets/d/..."
      @blur="() => cleanupGSheetID()"
    />
    <NButton type="primary" @click="checkConnection" :disabled="!gsheet"
      >Check Connection</NButton
    >
  </div> -->
</template>
<script setup lang="ts">
import { updateFile, getRulerWidth, getFileInfo, setRulerWidth } from "shared-vuejs/editor";

import LayoutHeader from "@/components/common/Layouts/LayoutHeader.vue";
import { getSocketData } from "shared-vuejs/api/socket-client";
import { saveDexie } from "shared-vuejs/api/dbutils";
import { exportFile } from "shared-vuejs/api/html";
import {
  piniaInfo,
  piniaResize,
  piniaSession,
  piniaSlides,
} from "@/lib/common/store";
import { displayFileTitle, showError, showMessage } from "shared-vuejs/api/utils";
import LoginPage from "@/pages/LoginPage.vue";
import { NButton, NFlex, NInput } from "naive-ui";
import { onMounted, ref } from "vue";
import ToolbarItem from "../Toolbars/ToolbarItem.vue";
import { Edit, Trash } from "@vicons/tabler";
import { Add24Regular } from "@vicons/fluent";
import ToolbarItemSwitch from "../Toolbars/ToolbarItemSwitch.vue";

import g from "shared-vuejs/api/global.js";

onMounted(async () => {
  const data = await getSocketData("serverFiles");
  console.log(data);
  const exist = data?.files?.find((f) => f.id == getFileInfo().id);
  if (exist) {
    gsheet.value = exist.gsheet;
  }
});

// watch(
//   () => getFileInfo().title,
//   (val) => (title.value = val),
// );

// const formRef = ref(null);
// const fileprops = ref({
//   title: getFileInfo().title,
//   // vars: getFileInfo().vars,
// });

const title = ref(getFileInfo().title);
const vars = ref(getFileInfo().vars || {});

const gsheet = ref("");

async function updateProp(e, prop) {
  const val = e.target.value;

  if (getFileInfo()[prop] != val) {
    updateFile({
      [prop]: val,
    });
    // piniaSlides().fileTitle = val;
    if (prop == "title") {
      displayFileTitle(val);
    }
    saveDexie();
    await exportFile();
  }
}

function updateShowRuler(val) {
  if (val) {
    setRulerWidth(g.RULER_WIDTH);
  } else {
    setRulerWidth(0);
  }
  localStorage.setItem("RULER_WIDTH", String(getRulerWidth()));
}

function stringify(varValue) {
  if (typeof varValue == "string") {
    return varValue;
  } else {
    return JSON.stringify(varValue);
  }
}

function addVar(e) {
  vars.value = {
    ...vars.value,
    ["var" + (Object.keys(vars.value).length + 1)]: "",
  };
  updateFile({
    vars: { ...vars.value },
  });
  saveDexie();
}

function updateVarName(e) {
  const oldVar = e.target.defaultValue;
  vars.value[e.target.value] = vars.value[oldVar];
  delete vars.value[oldVar];
  updateFile({
    vars: { ...vars.value },
  });
  saveDexie();
}

function updateVarValue(e, varName) {
  if (e.target.value.includes("[")) {
    vars.value[varName] = JSON.parse(e.target.value);
  } else {
    vars.value[varName] = e.target.value;
  }
  updateFile({
    vars: { ...vars.value },
  });
  saveDexie();
}

function deleteVar(name) {
  delete vars.value[name];
  updateFile({
    vars: { ...vars.value },
  });
  saveDexie();
}

function isTwoDimensionalArray(arr) {
  return Array.isArray(arr) && arr.length > 0 && Array.isArray(arr[0]);
}

function openVar(varName) {
  let rows;
  const alphabet = Array.from({ length: 26 }, (_, i) =>
    String.fromCharCode(97 + i),
  );
  if (typeof vars.value[varName] == "string") {
    rows = [{ a: vars.value[varName] }];
  } else {
    if (isTwoDimensionalArray(vars.value[varName])) {
      rows = vars.value[varName].map((row, rowIdx) => {
        const obj = {};
        row.forEach((item, colIdx) => {
          obj[alphabet[colIdx]] = item;
        });
        return obj;
      });
    } else {
      rows =
        vars.value?.[varName]?.map((val) => ({
          a: val,
        })) || [];
    }
  }
  piniaInfo().openDataGrid = {
    rows,
    cb: (data) => {
      if (data.length == 1 && data[0].length == 1) {
        // string
        vars.value[varName] = data[0][0];
      } else if (data?.[0]?.length == 1) {
        // single dimension
        vars.value[varName] = data.map((item) => item[0]);
      } else {
        // single dimension
        vars.value[varName] = data;
      }
      updateFile({
        vars: { ...vars.value },
      });
      saveDexie();
    },
  };
}

function cleanupGSheetID() {
  let val = gsheet.value.replace("https://docs.google.com/spreadsheets/d/", "");
  val = val.split("/")?.[0];
  gsheet.value = val;
}

async function checkConnection() {
  cleanupGSheetID();
  const data = await getSocketData("checkGsheet", {
    fileId: getFileInfo().id,
    gsheet: gsheet.value,
  });
  console.log(data);
  if (data == "error") {
    showError("Unable to connect. Check SheetID and make sure it is shared!");
  } else {
    showMessage("Connect to sheet succeeded!", 2000);
  }
}
</script>
<style scoped>
.guide {
  font-size: 12px;
  font-style: italic;
}

.guide a {
  user-select: all;
}

.var-row {
  display: flex;
  gap: 5px;
  margin-top: 5px;
}

.var-row input {
  width: 100px;
  font-size: 14px;
}
</style>
