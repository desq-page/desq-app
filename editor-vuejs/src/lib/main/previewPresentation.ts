import { getFileInfo, updateFile } from "shared-vuejs/editor";
import { saveDexie } from "shared-vuejs/api/dbutils";
import { exportFile } from "shared-vuejs/api/html";
import { piniaInfo } from "@/lib/common/store";

export async function openPreviewModal() {
  piniaInfo().setCurPopup("");
  updateFile({ publish: { ...getFileInfo().publish, published: false } });
  saveDexie();
  piniaInfo().openPreviewModal = true;
  await exportFile();
}
