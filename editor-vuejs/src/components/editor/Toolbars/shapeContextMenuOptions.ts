import { translate } from "@/lib/i18n";
import { piniaInfo } from "@/lib/common/store";
import { editablePicture, editPictureText, extractPictureText, selectPictureTextRegion, selectPictureRegion } from "shared-vuejs/api/edit-picture-text";
import { rmbgUsingXenova } from "./ToolbarUtils";
import { GroupAccount, GroupObjects, PointerText, TextCreation } from "@vicons/carbon";
import { AutoAwesomeOutlined, PhotoSizeSelectLargeSharp } from "@vicons/material";
import { ImageAltText24Regular, ScanText24Filled, VideoBackgroundEffect20Filled } from "@vicons/fluent";
import { showMessage } from "shared-vuejs/api/utils";

export const aiEditOptions = [
  {
    label: "AI Edit",
    key: "editable-picture",
    icon: AutoAwesomeOutlined,
    children: [
      { label: "Cut Out Standalone Image Region", key: "cut-out-region", icon: GroupObjects, onClick: () => selectObjectRegion("cutOutPictureRegion") },
      { label: "Cut Out Mixed-up Image Region", key: "extract-object", icon: GroupAccount, onClick: () => selectObjectRegion() },
      { type: "divider" },
      { label: "Re-extract Foreground Object", key: "extract-object-auto", icon: PhotoSizeSelectLargeSharp, onClick: () => extractObjectAutomatically() },
      { label: "Erase Background", key: "remove-background", icon: VideoBackgroundEffect20Filled, onClick: rmbgUsingXenova },
      { type: "divider" },
      { label: "Extract Text By Region", key: "extract-text-region", icon: TextCreation, onClick: () => selectPictureTextRegion(piniaInfo()) },
      { label: "Extract Text Under Pointer", key: "edit-picture-text", icon: PointerText, onClick: () => editPictureText(piniaInfo()) },
      // { label: "Extract All Text", key: "extract-text-all", icon: ScanText24Filled, onClick: () => extractPictureText(piniaInfo()) },
      
      
 
    ],
  },
  { type: "divider" },
];

export const aiEditActions = aiEditOptions[0].children;

function selectObjectRegion(
  action: "extractPictureObject" | "smartExtractPictureObject" | "cutOutPictureRegion" = "extractPictureObject",
) {
  const info = piniaInfo();
  const rectangle = action === "cutOutPictureRegion";
  const instruction = rectangle ? "Draw a rectangle to cut out" : "Draw a box around the object and its shadow";
  selectPictureRegion(info, translate(instruction), async (pictureId, region) => {
    const progress = (message: string) => { info.loadingBar = message; };
    progress(rectangle ? "Cutting out region…" : "Checking background…");
    try {
      const extractors = await import("shared-vuejs/api/extract-picture-object");
      const extract = extractors[action];
      await extract(pictureId, region, progress, translate);
    } catch (error) {
      showMessage(error instanceof Error ? error.message : String(error), undefined, "error");
    } finally {
      progress("");
    }
  }, { extract: translate("Cut Out"), deletePoint: translate("Delete Point") });
}

function extractObjectAutomatically() {
  const info = piniaInfo();
  const picture = editablePicture();
  if (!picture || info.loadingBar) return;
  const progress = (message: string) => { info.loadingBar = message; };
  progress("Finding object…");
  void (async () => {
    try {
      const { extractPictureObjectAutomatically } = await import("shared-vuejs/api/extract-picture-object");
      await extractPictureObjectAutomatically(picture.id, progress, translate);
    } catch (error) {
      showMessage(error instanceof Error ? error.message : String(error), undefined, "error");
    } finally {
      progress("");
    }
  })();
}
