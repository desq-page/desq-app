import { getFileInfo } from "shared-vuejs/editor";
import g from "shared-vuejs/api/global";
import { getDexie } from "shared-vuejs/api/db";
import { deleteFile, flushPendingDexieSaves } from "shared-vuejs/api/dbutils";
import { createSinglePresentationHtml } from "shared-vuejs/api/presentation-export";
import { downloadFile, selectDownloadFile } from "shared-vuejs/api/downloadShape";

import { piniaInfo } from "@/lib/common/store";
import { showError } from "@/lib/main/utils";
import { isHtmlSaveCurrent, prepareHtml, savePreparedHtml } from "@/lib/main/saveHtml";
import { clearEditTextMedia } from "shared-vuejs/api/edit-text-media";

/** Show the standard close confirmation and close a cached file if requested. */
export async function confirmCloseFile(
  fileId: string,
  onClosed?: () => void | Promise<void>,
) {
  const fileInfo = await getDexie("files", fileId);
  const isActiveFile = getFileInfo()?.id === fileId;
  const dirty = isActiveFile
    ? piniaInfo().fileDirty
    : Boolean(fileInfo?.dirty);

  const d = g.globalDialog.warning({
    title: dirty ? "Unsaved changes" : "Unload file?",
    content: dirty
      ? "This file has unsaved changes which will be lost if you unload without saving. Save a single HTML file to keep your work."
      : "Unload this file to remove its in-memory cache. Save a single HTML file if you want to reopen it later.",
    positiveText: "Save and unload",
    negativeText: dirty ? "⚠️ Unload without saving" : "Unload",
    positiveButtonProps: { type: "success" },
    negativeButtonProps: { type: "error" },
    onPositiveClick: async () => {
      d.loading = true;
      try {
        const file = isActiveFile ? getFileInfo() : fileInfo;
        const baseName = (file?.name || file?.title || "Presentation").replace(/\.(pptx|pub|docx|html?|zip)$/i, "");
        const name = `${baseName}.html`;
        // Invoke the picker before preparing the file, while the click has user activation.
        const destination = await selectDownloadFile(name);
        if (destination === null) return false;
        if (isActiveFile) {
          if (getFileInfo()?.id !== fileId) throw Error("The open file changed. Please try again.");
          const prepared = await prepareHtml("single", false);
          const saved = await savePreparedHtml(prepared, { name, destination: Promise.resolve(destination) });
          if (!saved) return false;
          if (!isHtmlSaveCurrent(prepared.snapshot)) throw Error("The file changed while saving. Please save it again before unloading.");
        } else {
          await flushPendingDexieSaves();
          const blob = await createSinglePresentationHtml(fileId, { baseUrl: import.meta.env.BASE_URL });
          if (!await downloadFile(blob, name, false, undefined, destination)) return false;
        }
        await closeFile(fileId, onClosed);
      } catch (error) {
        showError(error instanceof Error ? error.message : "Unable to save HTML");
        return false;
      } finally {
        d.loading = false;
      }
    },
    onNegativeClick: async () => {
      await closeFile(fileId, onClosed);
    },
  });
}

async function closeFile(
  fileId: string,
  onClosed?: () => void | Promise<void>,
) {
  await clearEditTextMedia(fileId);
  await deleteFile(fileId);
  await onClosed?.();
}
