<template>
  <div class="savanna-dashboard">
    <div class="workspace-header-landscape">
    <header class="workspace-header page-width">
      <RouterLink
        :to="{ name: 'root', query: { home: '1' } }"
        class="wordmark"
        aria-label="DESQ home"
      >
        <img class="brand-symbol" src="/favicon.svg?v=desq-color" alt="" />
        DESQ
      </RouterLink>
      <nav aria-label="Workspace navigation">
        <RouterLink
          :to="{ name: 'root', query: { home: '1' } }"
          class="home-link"
          >Back to home <span aria-hidden="true">↗</span></RouterLink
        >
        <span class="workspace-badge">Workspace</span>
        <template v-if="isDockerBackend">
          <div v-if="user" class="avatar" :aria-label="user.name">
            <img v-if="avatarUrl" :src="avatarUrl" alt="" />
            <span v-else>{{ initial }}</span>
          </div>
          <RouterLink v-else to="/login" class="login-link">Log in</RouterLink>
        </template>
      </nav>
    </header>
    </div>

    <main class="page-width">
      <section class="workspace-intro" aria-labelledby="workspace-title">
        <div>
          <p class="eyebrow">
            <span class="status-dot"></span> YOUR IDEAS START HERE
          </p>
          <p class="intro-description">
            Create something new, open an office document, or pick up where you
            left off. Editing is free.
          </p>
        </div>
        <div class="workspace-actions">
          <button
            class="button button-primary"
            @click="piniaInfo().openNewFileModal = true"
          >
            <span aria-hidden="true">+</span> Create new
          </button>
          <div class="open-file-action">
            <button
              class="button button-dark"
              :disabled="openingFile"
              @click="openFileInput?.click()"
              aria-describedby="open-file-privacy"
            >
              {{ openingFile ? "Opening file…" : "Open a file" }}
              <span aria-hidden="true">↗</span>
            </button>
            <p id="open-file-privacy" class="privacy-caption">Free. Work offline in this browser. Your files stay private on your device.</p>
          </div>
          <input
            ref="openFileInput"
            type="file"
            accept=".pptx,.docx,.pub,.html,.htm"
            hidden
            @change="openSelectedFile"
          />
          <p class="supported-formats">
            PowerPoint <b>.pptx</b> <span>·</span> Word <b>.docx</b>
            <span>·</span> Publisher <b>.pub</b>
            <span>·</span> Editable HTML <b>.html</b>
          </p>
        </div>
      </section>

      <section
        class="documents-section"
        aria-labelledby="documents-title"
        :aria-busy="loadingFiles"
      >
        <div class="documents-heading">
          <div>
            <p class="eyebrow">PICK UP WHERE YOU LEFT OFF</p>
            <h2 id="documents-title">
              Loaded documents
              <span v-if="!loadingFiles" class="document-count">{{
                localFiles.length
              }}</span>
            </h2>
          </div>
          <span class="storage-label"
            ><i aria-hidden="true"></i> Stored in cache memory of this
            browser</span
          >
        </div>
        <div v-if="loadingFiles" class="loading-state" role="status">
          <span class="loading-ring" aria-hidden="true"></span> Loading your
          documents…
        </div>
        <DashboardFiles v-else-if="localFiles.length" :localFiles :loadFiles />
        <div v-else class="empty-state">
          <div class="empty-document" aria-hidden="true">
            <span></span><i></i><i></i><i></i><b>+</b>
          </div>
          <h3>A fresh start. A world of possibilities.</h3>
          <p>
            Your documents will appear here as you work.<br />Create a
            presentation or open a .pptx, .docx, or .pub file to get started.
          </p>
          <button
            class="button button-primary"
            @click="piniaInfo().openNewFileModal = true"
          >
            Create your first document <span aria-hidden="true">↗</span>
          </button>
        </div>
      </section>
      <aside class="workspace-note">
        <span class="note-icon" aria-hidden="true">◎</span>
        <div>
          <strong>Save a file to keep your work.</strong>
          <p>
            Your documents are held in this browser cache. Edits are not saved
            back to the original file. Use Save as to download a copy and keep
            your work outside the browser. Cache stays after browser shutdown, but not guaranteed to keep permanently.
          </p>
        </div>
      </aside>
    </main>
    <footer class="workspace-footer page-width">
      <span>DESQ — Office documents, with a life on the web.</span
      ><RouterLink to="/support">Support</RouterLink>
      <RouterLink to="/terms">Terms &amp; Privacy</RouterLink>
      <RouterLink to="/?home=1"
        >Explore DESQ <span aria-hidden="true">↗</span></RouterLink
      >
    </footer>
  </div>
</template>
<script setup lang="ts">
import { getAllDexie } from "shared-vuejs/api/db";
import { markFileCreated } from "shared-vuejs/api/homeNavigation";
import { piniaInfo } from "@/lib/common/store";
import { computed, defineAsyncComponent, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";

const loadDashboardFiles = () => import("./DashboardFiles.vue");
const DashboardFiles = defineAsyncComponent(loadDashboardFiles);

import dayjs from "dayjs";

import { isDockerBackend } from "shared-vuejs/api/backend-config";

// import { connectSocket } from "shared-vuejs/api/socket-client";
import { genId } from "shared-vuejs/api/utility";
import { showError } from "shared-vuejs/api/utils";

import { fetchUser, refreshAccessToken } from "@/lib/common/useAuth";

const localFiles: any = ref([]);
const openFileInput = ref<HTMLInputElement | null>(null);
const openingFile = ref(false);

async function openSelectedFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  openingFile.value = true;
  try {
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension === "html" || extension === "htm") {
      piniaInfo().loadingBar = "Opening editable HTML…";
      const { importEditableHtml } = await import("@/lib/main/importEditableHtml.mjs");
      const fileId = await importEditableHtml(file);
      location.replace("/edit/" + fileId);
    } else if (extension === "docx") {
      piniaInfo().loadingBar = "Opening Word document…";
      const { submitDocx } = await import("shared-vuejs/api/submitDocx");
      await submitDocx(file, { fileName: file.name });
    } else if (extension === "pub") {
      piniaInfo().loadingBar = "Opening Publisher document…";
      const { submitPub } = await import("shared-vuejs/api/submitPub");
      await submitPub(file, { fileName: file.name });
    } else if (extension === "pptx") {
      const pptxSettings = {
        fileName: file.name,
        fileId: genId(10),
        slideModeFormat: "sldDownload",
      };
      piniaInfo().loadingBar = { desc: "Loading...", pct: 1 };
      const { submitPPTX } = await import("shared-vuejs/api/unzipPPTX");
      await submitPPTX(file, pptxSettings);
    } else {
      showError(
        "Choose an editable HTML, PowerPoint (.pptx), Publisher (.pub), or Word (.docx) file",
      );
    }
  } catch (error) {
    piniaInfo().loadingBar = "";
    console.error("File import failed:", error);
    showError(error instanceof Error ? error.message : "Unable to open file");
  } finally {
    piniaInfo().loadingBar = "";
    openingFile.value = false;
    input.value = "";
    // Import may save the document before navigation fails. Refresh in either
    // case so a saved file can still be opened from DashboardFiles.
    try {
      await loadFiles();
    } catch (error) {
      console.error("Unable to refresh imported files:", error);
      showError(
        "Unable to refresh your documents. Reload the workspace to see saved files.",
      );
    }
  }
}

const user = ref(null as any);

const avatarUrl = ref("");

const initial = computed(() => (user.value?.name || "?")[0].toUpperCase());

const loadingFiles = ref(true);

onMounted(async () => {
  let loggedIn = isDockerBackend ? await fetchUser() : null;

  // Try refreshing if expired
  if (!loggedIn && isDockerBackend) {
    const refreshed = await refreshAccessToken();
    if (refreshed) loggedIn = await fetchUser();
  }

  if (loggedIn) {
    user.value = loggedIn;
  }

  setTimeout(() => {
    loadFiles();
  }, 500);
  document.title = "Your workspace — DESQ";
});

async function loadFiles() {
  loadingFiles.value = true;
  try {
    await loadLocalFiles();
    if (localFiles.value.length) await loadDashboardFiles();
  } finally {
    loadingFiles.value = false;
  }
}

async function loadLocalFiles() {
  const dbFiles: any = [...(await getAllDexie("files"))];
  dbFiles.sort((a, b) =>
    dayjs(a.timestamp).isBefore(dayjs(b.timestamp)) ? 1 : -1,
  );
  localFiles.value = dbFiles;
  if (dbFiles.length) markFileCreated();
}
</script>
<style scoped>
.savanna-dashboard {
  --ink: #172923;
  --muted: #63736b;
  --accent: #d7f46b;
  min-height: 100vh;
  width: 100vw;
  margin-left: calc(50% - 50vw);
  background: #fcfdf8;
  color: var(--ink);
  font-family: Inter, Helvetica, Arial, sans-serif;
  font-size: 16px;
  line-height: 1.6;
  overflow: hidden;
}
.savanna-dashboard *,
.savanna-dashboard *::before,
.savanna-dashboard *::after {
  box-sizing: border-box;
}
.savanna-dashboard a {
  color: inherit;
  text-decoration: none;
}
.savanna-dashboard a:focus-visible,
button:focus-visible {
  outline: 3px solid #598d24;
  outline-offset: 4px;
}
.page-width {
  width: min(1240px, calc(100% - 96px));
  margin: 0 auto;
}
.workspace-header-landscape {
  background: linear-gradient(90deg, rgba(218, 241, 225, .94), rgba(190, 230, 204, .80) 55%, rgba(209, 238, 219, .88)), url('/images/desq-hero.svg') center / cover no-repeat;
  border-bottom: 1px solid #bbd8c5;
}
.workspace-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 104px;
  gap: 24px;
}
.workspace-header nav {
  display: flex;
  align-items: center;
  gap: 25px;
  font-size: 13px;
  font-weight: 600;
}
.home-link span {
  margin-left: 9px;
}
.home-link:hover,
.workspace-footer a:hover {
  text-decoration: underline;
}
.workspace-badge {
  background: #edf3e1;
  border: 1px solid #dbe5cc;
  padding: 6px 13px;
  border-radius: 20px;
  color: #557432;
  font-size: 11px;
}
.login-link {
  padding: 8px 16px;
  border: 1px solid #dbe2d2;
  border-radius: 6px;
}
.wordmark {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -1.2px;
}
.brand-symbol {
  display: block;
  flex-shrink: 0;
  width: 36px;
  height: 36px;
}
@media (max-width: 760px) {
  .wordmark { font-size: 24px; gap: 6px; }
  .brand-symbol { width: 30px; height: 30px; }
}
.avatar {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  background: #e6efcf;
  color: #48662c;
  font-size: 13px;
  border-radius: 50%;
  overflow: hidden;
}
.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.workspace-intro {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 40px;
  padding: 62px 0 52px;
}
.eyebrow {
  margin: 0 0 18px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1.6px;
}
.status-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  margin-right: 7px;
  border-radius: 50%;
  background: #759c35;
}
h1 {
  margin: 0;
  font-size: clamp(35px, 3.6vw, 49px);
  font-weight: 750;
  line-height: 1.12;
  letter-spacing: -2px;
}
h1 span {
  color: #689533;
}
.intro-description {
  max-width: 470px;
  margin: 22px 0 0;
  font-size: 15px;
  color: var(--muted);
}
.workspace-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 13px;
  flex-shrink: 0;
}
.workspace-actions > .button { align-self: start; }
.open-file-action { display: flex; flex-direction: column; gap: 8px; }
.privacy-caption { margin: 0; max-width: 240px; text-align: center; color: #487b39; font-size: 11px; font-weight: 600; line-height: 1.5; }
.button {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  gap: 15px;
  border: 0;
  padding: 15px 22px;
  border-radius: 7px;
  font: inherit;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition:
    transform 0.18s,
    background 0.18s;
}
.button:hover:not(:disabled) {
  transform: translateY(-2px);
}
.button span {
  font-size: 21px;
  line-height: 1;
}
.button-primary {
  background: var(--accent);
  color: var(--ink);
}
.button-primary:hover {
  background: #c7e65a;
}
.button-dark {
  background: var(--ink);
  color: white;
}
.button-dark:hover {
  background: #2e473b;
}
.button:disabled {
  opacity: 0.6;
  cursor: wait;
}
.supported-formats {
  grid-column: 1 / -1;
  margin: 0;
  text-align: center;
  color: #79856f;
  font-size: 10px;
}
.supported-formats b {
  font-weight: 500;
  color: #526443;
}
.supported-formats > span {
  margin-inline: 9px;
}
.documents-section {
  border: 1px solid #dfe6d6;
  border-radius: 12px;
  background: #fff;
  overflow: hidden;
}
.documents-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  padding: 28px 30px;
  border-bottom: 1px solid #e9ede3;
}
.documents-heading .eyebrow {
  margin-bottom: 6px;
  font-size: 9px;
  color: #7a9061;
}
h2 {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 11px;
  font-size: 23px;
  font-weight: 700;
  letter-spacing: -0.8px;
}
.document-count {
  display: grid;
  place-items: center;
  min-width: 24px;
  height: 24px;
  padding: 0 6px;
  border-radius: 6px;
  background: #f0f4e7;
  color: #627c42;
  font-size: 11px;
  letter-spacing: 0;
}
.storage-label {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 9px 12px;
  border: 1px solid #e5c17b;
  border-radius: 8px;
  background: #fff3d6;
  font-size: 13px;
  font-weight: 700;
  color: #795016;
}
.storage-label i {
  width: 6px;
  height: 6px;
  flex-shrink: 0;
  border-radius: 50%;
  background: #a66b17;
}
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 300px;
  color: var(--muted);
  font-size: 14px;
}
.loading-ring {
  width: 20px;
  height: 20px;
  border: 2px solid #e1e9d5;
  border-top-color: #769846;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 52px 24px 60px;
  text-align: center;
  background: radial-gradient(ellipse at 50% 20%, #f6f9ef, #fff 65%);
}
.empty-document {
  position: relative;
  width: 62px;
  height: 78px;
  margin-bottom: 28px;
  padding: 25px 13px 0;
  border: 1px solid #c9d7b6;
  border-radius: 7px;
  background: #f2f6e8;
  transform: rotate(-7deg);
}
.empty-document > span {
  position: absolute;
  right: -1px;
  top: -1px;
  width: 20px;
  height: 20px;
  border-radius: 0 6px 0 5px;
  background: #e0eacb;
}
.empty-document i {
  display: block;
  height: 3px;
  margin: 7px 0;
  border-radius: 2px;
  background: #b9cc99;
}
.empty-document i:last-of-type {
  width: 60%;
}
.empty-document b {
  position: absolute;
  right: -14px;
  bottom: -9px;
  display: grid;
  place-items: center;
  width: 29px;
  height: 29px;
  border-radius: 50%;
  background: #d7f46b;
  color: #375023;
  font-size: 19px;
  font-weight: 400;
}
.empty-state h3 {
  margin: 0;
  font-size: 22px;
  letter-spacing: -0.6px;
}
.empty-state p {
  margin: 13px 0 25px;
  font-size: 13px;
  line-height: 1.8;
  color: var(--muted);
}
.workspace-note {
  display: flex;
  align-items: flex-start;
  gap: 15px;
  padding: 23px 25px;
  margin-top: 22px;
  border-radius: 9px;
  background: #f0f4e6;
}
.note-icon {
  color: #79984d;
  font-size: 23px;
  line-height: 1.1;
}
.workspace-note strong {
  font-size: 12px;
  font-weight: 600;
}
.workspace-note p {
  margin: 5px 0 0;
  max-width: 890px;
  font-size: 12px;
  color: #79866c;
  line-height: 1.7;
}
.workspace-footer {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  padding-block: 34px;
  color: #839075;
  font-size: 11px;
}
.workspace-footer a {
  color: #526740;
  font-weight: 600;
}
.workspace-footer a span {
  margin-left: 8px;
}
@media (max-width: 1000px) {
  .page-width {
    width: calc(100% - 56px);
  }
  .workspace-intro {
    gap: 25px;
  }
  .workspace-actions {
    grid-template-columns: 1fr;
  }
  .supported-formats {
    grid-column: auto;
  }
}
@media (max-width: 680px) {
  .page-width {
    width: calc(100% - 32px);
  }
  .workspace-header {
    min-height: 82px;
  }
  .workspace-header nav {
    gap: 12px;
  }
  .home-link {
    display: none;
  }
  .workspace-intro {
    flex-direction: column;
    align-items: flex-start;
    gap: 26px;
    padding: 40px 0 32px;
  }
  h1 {
    font-size: clamp(32px, 7vw, 44px);
    letter-spacing: -1.4px;
  }
  .intro-description {
    font-size: 14px;
    margin-top: 17px;
  }
  .workspace-actions {
    width: 100%;
    grid-template-columns: 1fr 1fr;
  }
  .button {
    padding: 13px 15px;
    font-size: 12px;
    gap: 10px;
  }
  .supported-formats {
    grid-column: 1 / -1;
  }
  .documents-heading {
    padding: 21px 19px;
    flex-wrap: wrap;
    gap: 10px;
  }
  h2 {
    font-size: 21px;
  }
  .storage-label {
    font-size: 12px;
  }
  .empty-state {
    padding: 40px 20px;
  }
  .empty-state h3 {
    font-size: 19px;
  }
  .empty-state p br {
    display: none;
  }
  .workspace-note {
    padding: 20px;
  }
  .workspace-footer {
    flex-direction: column;
    gap: 8px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .button {
    transition: none;
  }
  .button:hover:not(:disabled) {
    transform: none;
  }
  .loading-ring {
    animation: none;
  }
}
</style>
