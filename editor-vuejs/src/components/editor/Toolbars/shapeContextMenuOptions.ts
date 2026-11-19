import { translate } from "@/lib/i18n";
import { piniaInfo } from "@/lib/common/store";
import { editPictureText, extractPictureText, selectPictureTextRegion, selectPictureRegion } from "shared-vuejs/api/edit-picture-text";
import { rmbgUsingXenova } from "./ToolbarUtils";
import { GroupObjects, PointerText, TextCreation } from "@vicons/carbon";
import { AutoAwesomeOutlined, PhotoSizeSelectLargeSharp } from "@vicons/material";
import { ImageAltText24Regular, ScanText24Filled, VideoBackgroundEffect20Filled } from "@vicons/fluent";
import { showMessage } from "shared-vuejs/api/utils";

export const aiEditOptions = [
  {
    label: "AI Edit",
    key: "editable-picture",
    icon: AutoAwesomeOutlined,
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
  { type: "divider" },
];

export const aiEditActions = aiEditOptions[0].children;

function selectObjectRegion() {
  const info = piniaInfo();
  selectPictureRegion(info, "Draw a box around the object and its shadow", async (pictureId, region) => {
    const progress = (message: string) => { info.loadingBar = message; };
    progress("Checking background…");
    try {
      const { extractPictureObject } = await import("shared-vuejs/api/extract-picture-object");
      await extractPictureObject(pictureId, region, progress, translate);
    } catch (error) {
      showMessage(error instanceof Error ? error.message : String(error), undefined, "error");
    } finally {
      progress("");
    }
  });
}
