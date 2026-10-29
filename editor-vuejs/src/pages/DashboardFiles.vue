<template>
  <div v-if="localFiles?.length" class="document-list">
    <table class="documents-table">
      <caption class="sr-only">
        Documents in memory — save a copy to keep your work as a file
      </caption>
      <thead>
        <tr>
          <th scope="col">Document</th>
          <th scope="col" class="slides-column">Pages</th>
          <th scope="col" class="modified-column">Last modified</th>
          <th scope="col" class="actions-column">
            <span class="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="file in localFiles" :key="file.id">
          <td>
            <button class="document-open" @click="openFile(file.id)">
              <span class="thumbnail-frame"
                ><img
                  class="document-thumbnail"
                  :src="`/res/${file.id}/media/thumb-${file.slides?.[0]?.id}.jpg`"
                  alt=""
                  loading="lazy"
              /></span>
              <span class="document-details"
                ><span class="document-title">{{
                  file.name || file.title || "Untitled"
                }}</span
                ><span class="document-type"
                  ><span class="type-dot"></span
                  >{{
                    file.sourceFormat === "docx" || /\.docx$/i.test(file.name || "")
                      ? "Word document · (Saves as DOCX)"
                      : file.sourceFormat === "pub" || /\.pub$/i.test(file.name || "")
                      ? "Publisher document"
                      : /\.pptx$/i.test(file.name || "")
                        ? "PowerPoint presentation"
                        : "Presentation"
                  }}<span class="mobile-slides">
                    · {{ file.slides?.length || 0 }} slides</span
                  ></span
                ></span
              >
            </button>
          </td>
          <td class="slides-column">
            <span class="slides-count">{{ file.slides?.length || 0 }}</span>
          </td>
          <td class="modified-column">
            <span class="modified-date">{{
              file.timestamp ? dayjs(file.timestamp).format("MMM D, YYYY") : "—"
            }}</span
            ><span v-if="file.timestamp" class="modified-time">{{
              dayjs(file.timestamp).format("h:mm A")
            }}</span>
          </td>
          <td class="actions-column">
            <button
              class="close-document"
              :aria-label="`Close ${file.name || file.title || 'Untitled'}`"
              @click="closeDashboardFile(file.id)"
            >
              <span class="close-label">Unload</span
              ><span class="close-icon" aria-hidden="true">×</span>
            </button>
          </td>
        </tr>
      </tbody>
    </table>
    <div class="list-note">
      Save a copy of your work before unloading a document.
    </div>
  </div>
</template>
<script setup lang="ts">
import { piniaInfo } from "@/lib/common/store";
import dayjs from "dayjs";

//@ts-ignore //?raw to import assets as string
import { confirmCloseFile } from "@/lib/main/closeFile";
//@ts-ignore
const props = defineProps({
  localFiles: {
    type: Array as any,
    required: true,
  },
  loadFiles: Function,
});
async function closeDashboardFile(fileId) {
  await confirmCloseFile(fileId, async () => {
    await props.loadFiles?.();
  });
}

function openFile(id) {
  piniaInfo().loadingBar = "Please wait...";
  // Use browser navigation so opening a cached document reaches the server.
  window.location.assign("/edit/" + encodeURIComponent(id));
}
</script>
<style scoped>
.document-list {
  color: #172923;
  background: #fff;
  font-family: Inter, Helvetica, Arial, sans-serif;
}
.document-list * {
  box-sizing: border-box;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
.documents-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  text-align: left;
}
.documents-table th {
  padding: 13px 30px;
  background: #f8faf4;
  border-bottom: 1px solid #e9ede3;
  color: #7d8c71;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.7px;
  text-transform: uppercase;
}
.documents-table td {
  padding: 20px 30px;
  border-bottom: 1px solid #edf0e7;
  vertical-align: middle;
}
.documents-table tbody tr {
  transition: background 0.15s;
}
.documents-table tbody tr:hover {
  background: #fbfcf7;
}
.documents-table tbody tr:last-child td {
  border-bottom: none;
}
.slides-column {
  width: 100px;
  text-align: center;
}
.modified-column {
  width: 190px;
}
.actions-column {
  width: 120px;
  text-align: right;
}
.document-open {
  display: flex;
  align-items: center;
  gap: 20px;
  width: 100%;
  padding: 0;
  background: transparent;
  border: 0;
  text-align: left;
  color: inherit;
  font: inherit;
  cursor: pointer;
  border-radius: 5px;
}
.document-open:focus-visible,
.close-document:focus-visible {
  outline: 3px solid #598d24;
  outline-offset: 5px;
}
.thumbnail-frame {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 104px;
  height: 63px;
  flex-shrink: 0;
  padding: 4px;
  border: 1px solid #dfe6d7;
  border-radius: 5px;
  background: #f5f7ef;
}
.document-thumbnail {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 2px;
  -webkit-user-drag: none;
}
.document-details {
  display: block;
  min-width: 0;
}
.document-title {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
  color: #283c2a;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.2px;
}
.document-open:hover .document-title {
  color: #689533;
}
.document-type {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 7px;
  color: #8a977f;
  font-size: 10px;
}
.type-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #afc884;
}
.mobile-slides {
  display: none;
}
.slides-count {
  font-size: 13px;
  color: #6b7d5d;
}
.modified-date {
  display: block;
  font-size: 12px;
  color: #627454;
}
.modified-time {
  display: block;
  margin-top: 3px;
  font-size: 10px;
  color: #97a18d;
}
.close-document {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 7px 10px;
  border: 1px solid #e2e8da;
  border-radius: 5px;
  background: #fff;
  color: #839175;
  font: inherit;
  font-size: 10px;
  cursor: pointer;
}
.close-document:hover {
  border-color: #dbbdb7;
  color: #a45d51;
  background: #fff9f6;
}
.close-icon {
  font-size: 17px;
  line-height: 1;
}
.list-note {
  padding: 15px 30px;
  border-top: 1px solid #edf0e7;
  color: #8c9881;
  font-size: 11px;
}
@media (max-width: 1000px) {
  .documents-table th,
  .documents-table td {
    padding-inline: 22px;
  }
  .modified-column {
    width: 155px;
  }
  .slides-column {
    width: 75px;
  }
  .actions-column {
    width: 105px;
  }
  .document-open {
    gap: 14px;
  }
  .thumbnail-frame {
    width: 86px;
    height: 53px;
  }
}
@media (max-width: 760px) {
  .slides-column,
  .modified-column {
    display: none;
  }
  .mobile-slides {
    display: inline;
  }
  .actions-column {
    width: 83px;
  }
  .documents-table th,
  .documents-table td {
    padding: 16px 19px;
  }
  .document-title {
    font-size: 12px;
  }
  .document-type {
    font-size: 9px;
    gap: 5px;
    flex-wrap: wrap;
  }
  .thumbnail-frame {
    width: 70px;
    height: 46px;
  }
  .document-open {
    gap: 12px;
  }
  .close-label {
    display: none;
  }
  .close-document {
    width: 30px;
    height: 30px;
    padding: 0;
  }
  .list-note {
    padding: 15px 19px;
    font-size: 10px;
  }
}
@media (max-width: 400px) {
  .thumbnail-frame {
    width: 55px;
    height: 40px;
  }
  .documents-table th,
  .documents-table td {
    padding-inline: 14px;
  }
  .actions-column {
    width: 65px;
  }
  .document-open {
    gap: 10px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .documents-table tbody tr {
    transition: none;
  }
}
</style>
