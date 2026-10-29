import { updateSlide, getTheme, getFileInfo, getLayoutInfo, getMasterInfo, getSlideInfo } from "shared-vuejs/editor";
import { saveDexie } from "shared-vuejs/api/dbutils";
import { activeSlideHeight, activeSlideWidth } from "shared-vuejs/api/slide";

import SlideBackground from "shared-vuejs/api/SlideBackground";
import { getBaseHref } from "shared-vuejs/api/get-file";
import { gid } from "shared-vuejs/api/utility";

export function refreshSlideBackground() {
  const currentSlide = getSlideInfo();
  const currentBackground = gid("sld")?.querySelector(":scope > .slide-bg");
  if (!currentSlide || !currentBackground) return;

  currentBackground.replaceWith(
    SlideBackground({
      width: activeSlideWidth(getFileInfo()),
      height: activeSlideHeight(getFileInfo()),
      slideInfo: currentSlide,
      layoutInfo: getLayoutInfo(),
      masterInfo: getMasterInfo(),
      theme: getTheme(),
      fileInfo: getFileInfo(),
      baseHref: getBaseHref(getFileInfo()?.id),
    }) as HTMLElement,
  );
}

export async function updateCurrentSlideBackground(bg, shouldSave = true) {
  const slideInfo = getSlideInfo();
  if (!slideInfo) return;
  slideInfo.bg = bg;
  updateSlide(slideInfo);
  refreshSlideBackground();
  if (shouldSave) await saveDexie();
}
