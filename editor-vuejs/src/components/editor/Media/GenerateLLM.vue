<template>
  <n-modal
    v-model:show="piniaInfo().openLLMModal"
    :mask-closable="false"
    preset="dialog"
    :title="`(AI) Generate ${mode == 'deck' ? 'File' : 'Slide'}`"
    :closable="closable"
    :style="{
      cursor: closable ? 'auto' : 'wait',
      width: '500px',
      maxWidth: '90%',
    }"
  >
    <template #icon>
      <AutoAwesomeTwotone />
    </template>
    <!-- <template v-if="!piniaSession().uid">
      <SessionCheck />
    </template> -->
    <!-- <template v-else> -->
    <div v-if="mode == 'deck'" style="margin: 20px 0 10px 0">
      <div class="subtitle">Choose an output format</div>
      <n-radio-group
        :value="genFormat"
        name="radiobuttongroup2"
        size="medium"
        :on-update:value="storeLastFormat"
      >
        <n-radio-button
          v-for="format in formats"
          :key="format.value"
          :value="format.value"
          :checked="genFormat == format.value"
        >
          {{ format.label }}
        </n-radio-button>
      </n-radio-group>
    </div>

    <textarea
      :disabled="!closable"
      class="prompt"
      v-model="prompt"
      :placeholder="placeholder"
      @keydown.stop
      :style="{
        cursor: closable ? 'auto' : 'wait',
        minWidth: '300px',
        minHeight: '150px',
        marginTop: '10px',
      }"
    ></textarea>

    <div v-if="pdfFiles.length > 0 && mode == 'slide'" style="margin: 10px 0">
      Use information from PDF file:
      <n-select v-model:value="embedFile" :options="pdfFiles" />
    </div>

    <div class="guide">
      This AI-generated content is experimental and may be inaccurate, overly
      simplistic, or require further refinement.
    </div>

    <!-- <template v-if="tplCandidates && tplCandidates.length > 0">
      <span>Pick a template:</span>
      <div class="candidateList">
        <span
          v-for="candidate in tplCandidates"
          :key="candidate.id"
          :class="{
            candidateItem: true,
            selected: selectedId == candidate.id,
          }"
        >
          <img
            :src="candidate.thumb"
            style="width: 96px"
            @click="selectedId = candidate.id"
          />
        </span>
      </div>
    </template> -->

    <NFlex vertical>
      <NButton
        type="primary"
        @click="generateClick"
        :disabled="!closable || !prompt"
        :style="{
          cursor: closable ? 'pointer' : 'wait',
          width: '200px',
        }"
      >
        Generate {{ mode == "deck" ? `New File` : "New Page" }}
      </NButton>
    </NFlex>

    <NProgress :percentage="progress" v-show="!closable" />
  </n-modal>
</template>
<script setup lang="ts">
import { getFileInfo } from "shared-vuejs/editor";

import { piniaInfo, piniaSession, piniaSlides } from "@/lib/common/store";
import { createOllama, processLLMResult } from "shared-vuejs/api/gen";
import { NModal, NProgress, NButton, NSelect, NFlex } from "naive-ui";
import { computed, ref, watch } from "vue";
import { showError } from "shared-vuejs/api/utils";
import { pickSlideAsTemplate } from "shared-vuejs/api/gen";
// import { getImgUrl } from "shared-vuejs/api/genSVGPaths";
// import { getBaseHref } from "shared-vuejs/api/get-file";
// import SessionCheck from "@/components/common/SessionCheck.vue";
import { AutoAwesomeTwotone } from "@vicons/material";
import { NRadioGroup, NRadioButton } from "naive-ui";


// const props = defineProps({
//   mode: {
//     type: String,
//     default: "deck",
//   },
// });

// const dialog = useDialog();
const formats = [
  {
    label: "Presentation",
    value: "presentation",
  },
  {
    label: "Story",
    value: "story",
  },
  {
    label: "Poster",
    value: "poster",
  },
];

function storeLastFormat(format) {
  genFormat.value = format;
  localStorage.setItem("last_llm_format", format);
}

const genFormat = ref(
  localStorage.getItem("last_llm_format") || "presentation",
);

const mode = computed(() => {
  if (location.href.includes("/edit")) {
    return "slide";
  } else {
    return "deck";
  }
});

const PLACEHOLDER_DEF = `Enter your desired content and let AI generate it for you.
Examples:
- All about on Chinese cuisine
- A detective story with Pokemon theme
- Wishing happy birthday to my best friend with Sanrio characters
...`;

const prompt = ref("");
const progress = ref(0);
const closable = ref(true);
const placeholder = ref(PLACEHOLDER_DEF);
// let hasText = false;

const embedFile = ref("");
const pdfFiles = ref([]);
const tplCandidates = ref(null as any);
const selectedId = ref("");
let selectedTpl: any = null;

watch(
  () => piniaInfo().openLLMModal,
  () => {
    updatePlaceholder();
    // loadExistingMedia();
    updateSlideTemplate();
    prompt.value = localStorage.getItem("last_llm_prompt") || "";
    embedFile.value = "";
  },
);

watch(embedFile, () => {
  if (embedFile.value) {
    updatePlaceholder();
  }
});

updatePlaceholder();
// loadExistingMedia();
updateSlideTemplate();

async function updateSlideTemplate() {
  // if (mode.value == "slide") {
  const candidates = await pickSlideAsTemplate();
  if (candidates) {
    tplCandidates.value = candidates;
  }
}

function updatePlaceholder() {
  if (mode.value == "slide") {
    // const title = getFileInfo().title;
    placeholder.value = `Enter a new page topic`;
  } else {
    placeholder.value = PLACEHOLDER_DEF;
  }
}

async function generateClick() {
  if (prompt.value) {
    // parseDesign();
    // return;
    // closable.value = false;
    localStorage.setItem("last_llm_prompt", prompt.value);
    if (selectedId.value) {
      selectedTpl = tplCandidates.value.find(
        (tpl) => tpl.id == selectedId.value,
      );
    } else {
      // selectedTpl = await genBlankSlideInfo();
      selectedTpl = tplCandidates.value[tplCandidates.value.length - 1];
    }

    const token = localStorage.getItem("accessToken");
    if (embedFile.value) {
      const headers: any = {
        Accept: "application/json",
        "Content-Type": "application/json",
      };
      const response = await fetch("/embed?authToken=" + token, {
        headers,
        method: "POST",
        body: JSON.stringify({
          format: genFormat.value,
          prompt: prompt.value,
          file: embedFile.value,
          fileId: getFileInfo().id,
          ollama: localStorage.getItem("llm") == "llama",
        }),
      }).then((res) => {
        if (res.status == 400) {
          piniaSession().uid = "";
          return "";
        }
        return res.json();
      });
      if (response) {
        updateProgress(100);
        await processLLMResult(
          response.text,
          getFileInfo().id,
          prompt.value,
          "slide",
          {
            fileInfo: {
              slides: [selectedTpl],
            },
          },
          null,
          updateProgress,
        );
      }
      updateProgress(0);
      piniaInfo().openLLMModal = false;
    } else {
      const template = {
        fileInfo: {
          slides: [selectedTpl],
        },
      };
      createOllama(
        prompt.value,
        mode.value,
        {
          w: getFileInfo()?.width || 1280,
          h: getFileInfo()?.height || 720,
          format: genFormat.value,
        },
        template,
        updateProgress,
      );
    }
  }
}

function updateProgress(pct) {
  if (pct < progress.value && pct > 0) return;
  if (pct > 100) pct = 100;
  if (pct == -1) {
    // error occured
    closable.value = true;
    progress.value = 0;
    showError(
      "Unable to get response from AI engine. Please reload page and try again, or revise the topic.",
    );
    return;
  }
  if (pct == 0) {
    // reset
    closable.value = true;
  }
  // piniaInfo().openLLMModal = true;
  progress.value = pct;
}

// async function genWithXenova() {
//   // const { generateXenova } = await import("shared-vuejs/src/edlib/common/inout/xenova");
//   // const result = await generateXenova(
//   //   `Write a presentation on this topic: ${prompt.value}.`
//   // );
//   // console.log(result);
//   const YOUR_API_KEY = "";

//   const output = await fetch(
//     `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${YOUR_API_KEY}`,
//     {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({
//         contents: [
//           {
//             parts: [
//               {
//                 text: `Write a presentation on this topic: ${prompt.value}. Each slide should have title, content, keywords, media.`,
//               },
//             ],
//           },
//         ],
//       }),
//     }
//   ).then((res) => res.json());

//   console.log(output.candidates[0].content.parts[0].text);
// }
</script>
<style scoped>
.subtitle {
  font-size: 14px;
  margin: 5px 0 10px 0;
  font-weight: bold;
}
.prompt {
  width: 100%;
  height: 100px;
  font-family: sans-serif;
}

.prompt::placeholder {
  font-size: 12px;
  line-height: 24px;
}

:global(.n-modal-mask) {
  cursor: not-allowed;
}

.candidateList {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
}
.candidateItem {
  cursor: pointer;
}
.candidateItem.selected img {
  outline: 2px solid red;
}
.guide {
  font-style: italic;
  margin: 10px 0 20px 0;
  font-size: 12px;
}
</style>
