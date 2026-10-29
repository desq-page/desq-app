import { getFileInfo } from "shared-vuejs/editor";
import g from "shared-vuejs/api/global";
import { getDexie } from "shared-vuejs/api/db";
import { deleteFile } from "shared-vuejs/api/dbutils";

import { piniaInfo } from "@/lib/common/store";
import { documentSaveFormat, saveDocument } from "shared-vuejs/api/save-document";

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
  const format = await documentSaveFormat(fileId);

  const d = g.globalDialog.warning({
    title: dirty ? "Unsaved changes" : "Unload file?",
    content: dirty
      ? `This file has unsaved changes which will be lost if you unload without saving. Save as ${format} file to keep your work.`
      : `Unload this file to remove its in-memory cache. Save as ${format} file if you want to reopen it later.`,
    positiveText: "Save and unload",
    negativeText: dirty ? "⚠️ Unload without saving" : "Unload",
    positiveButtonProps: { type: "success" },
    negativeButtonProps: { type: "error" },
    onPositiveClick: async () => {
      if (dirty) {
        d.loading = true;
        const saved = await saveDocument(fileId, true);
        if (!saved) return;
      }
      await closeFile(fileId, onClosed);
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
  await deleteFile(fileId);
  await onClosed?.();
}
