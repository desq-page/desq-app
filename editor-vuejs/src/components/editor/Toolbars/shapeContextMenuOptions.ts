import { computed } from "vue";
import { piniaInfo } from "@/lib/common/store";
import { editablePicture, editPictureText, extractPictureText, selectPictureTextRegion, selectPictureRegion } from "shared-vuejs/api/edit-picture-text";
import { rmbgUsingXenova } from "./ToolbarUtils";
import { GroupObjects, PointerText, TextCreation } from "@vicons/carbon";
import { AutoAwesomeOutlined, PhotoSizeSelectLargeSharp } from "@vicons/material";
import { ImageAltText24Regular, ScanText24Filled, VideoBackgroundEffect20Filled } from "@vicons/fluent";
import { showMessage } from "shared-vuejs/api/utils";

export const aiEditOptions = computed(() => [
  {
    label: "AI Edit",
    key: "editable-picture",
    icon: AutoAwesomeOutlined,
    show: !!editablePicture(),
    children: [
      { label: "Extract Text By Region", key: "extract-text-region", icon: TextCreation, onClick: () => selectPictureTextRegion(piniaInfo()) },
      { label: "Extract Text Under Pointer", key: "edit-picture-text", icon: PointerText, onClick: () => editPictureText(piniaInfo()) },
      { label: "Extract All Text", key: "extract-text-all", icon: ScanText24Filled, onClick: () => extractPictureText(piniaInfo()) },
      { type: "divider" },
      { label: "Extract Object By Region", key: "extract-object", icon: GroupObjects, onClick: selectObjectRegion },
      { type: "divider" },
      { label: "Erase Background", key: "remove-background", icon: VideoBackgroundEffect20Filled, onClick: rmbgUsingXenova },
    ],
  },
  { type: "divider", show: !!editablePicture() },
]);

export const aiEditActions = computed(() => aiEditOptions.value[0].children);

function selectObjectRegion() {
  const info = piniaInfo();
  selectPictureRegion(info, "Draw a box around the object and its shadow", async (pictureId, region) => {
    const progress = (message: string) => { info.loadingBar = message; };
    progress("Checking background…");
    try {
      const { extractPictureObject } = await import("shared-vuejs/api/extract-picture-object");
      await extractPictureObject(pictureId, region, progress);
    } catch (error) {
      showMessage(error instanceof Error ? error.message : String(error), undefined, "error");
    } finally {
      progress("");
    }
  });
}
