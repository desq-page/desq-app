import { updateFile, updateSlide, getInfoUseGrid, getSlidesMasterView, getSlidesMultiSelected, getSlidesSlideId, getFileInfo, getSlideInfo } from "shared-vuejs/editor";
import { saveDexie, saveSlideDB } from "shared-vuejs/api/dbutils";
import g from "shared-vuejs/api/global";
import { downloadShape } from "shared-vuejs/api/downloadShape";
import { addPlaceholders, addSlide } from "shared-vuejs/api/load";
import { piniaInfo, piniaResize, piniaSlides } from "@/lib/common/store";
import { deselectAll } from "shared-vuejs/api/handle";
import { changeLayout } from "shared-vuejs/api/master";
import {
  activeSlideHeight,
  activeSlideWidth,
  deleteSlide,
  duplicateSlide,
  selectSlide,
} from "shared-vuejs/api/slide";
import { showError } from "shared-vuejs/api/utils";

import {
  ClipboardPaste24Regular,
  ColorBackground24Regular,
  Delete20Regular,
  DocumentCopy24Regular,
  EyeOff24Regular,
  FolderAdd24Regular,
  SaveCopy24Regular,
  StarHalf24Filled,
  Prohibited24Filled,
  WindowEdit16Regular,
} from "@vicons/fluent";
import {
  AddBoxOutlined,
  AddCardFilled,
  DownloadFilled,
  PhotoSizeSelectActualOutlined,
  PhotoSizeSelectSmallFilled,
} from "@vicons/material";
import { computed } from "vue";
import { genId } from "shared-vuejs/api/utility";
import { copySlideClipboard, pasteSlideFromClipboard } from "shared-vuejs/api/clipboard";
import { FilePowerpointRegular } from "@vicons/fa";
import { TouchInteraction } from "@vicons/carbon";

import { toggleTaskPane } from "@/lib/main/utils";
import { isWordDocument } from "shared-vuejs/api/save-document";

export const newSlideOptions = [
  {
    label: "New Page",
    key: "newslide",
    icon: AddBoxOutlined,
    onClick: doInsertSlide,
  },
  {
    label: "Duplicate Page",
    key: "dupslide",
    icon: SaveCopy24Regular,
    onClick: duplicateSlide,
  },
  // {
  //   label: "(AI) Generate Slide...",
  //   icon: AutoAwesomeTwotone,
  //   key: "ai",
  //   disabled: !!getInfoUseGrid(),
  //   // type: "render",
  //   onClick: () => (getInfoOpenLLMModal() = true),
  //   color: g.themeOverrides.common.primaryColor,
  // },
];

// function renderCustomHeader() {
//   return h(
//     "div",
//     {
//       style: "display: flex; align-items: center;",
//     },
//     [
//       h(ToolbarItem, {
//         quaternary: true,
//         icon: DocumentCopy24Regular,
//         color: "#239df0",
//         // label: "Copy",
//         onClick: (e) => {
//           copySlideClipboard();
//         },
//         tooltip: "Copy Slide",
//       }),
//       h(ToolbarItem, {
//         quaternary: true,
//         // label: "Paste",
//         icon: ClipboardPaste24Regular,
//         color: "#957606",
//         onClick: (e) => {
//           pasteShape();
//         },
//         tooltip: "Paste Slide",
//       }),
//       h(ToolbarItem, {
//         tooltip: "Add Slide",
//         icon: AddSquare24Regular,
//         key: "blank",
//         onClick: doInsertSlide,
//         disabled: getSlidesMasterView(),
//         // color: g.themeOverrides.common.primaryColor,
//       }),
//       h(ToolbarItem, {
//         // quaternary: true,
//         // label: "Duplicate",
//         icon: DuplicateOutline,
//         size: 24,
//         tooltip: "Duplicate Slide",
//         key: "duplicate",
//         onClick: (e) => {
//           duplicateSlide();
//         },
//         disabled: getSlidesMasterView(),
//       }),
//       h(ToolbarItem, {
//         type: "divider",
//       }),
//       h(ToolbarItem, {
//         quaternary: true,
//         tooltip: "Skip Slide",
//         key: "hide",
//         icon: EyeOffOutline,
//         onClick: () => {
//           hideSlide();
//         },
//         disabled: getSlidesMasterView(),
//       }),
//       // h(ToolbarItem, {
//       //   quaternary: true,
//       //   icon: Delete20Regular,
//       //   size: 26,
//       //   tooltip: getSlidesMasterView()
//       //     ? "Delete Layout(s)"
//       //     : "Delete Slide(s)",
//       //   key: "delete",
//       //   disabled: !!getInfoUseGrid(),
//       //   onClick: () => {
//       //     getSlidesMasterView() ? doDeleteLayout() : doDeleteSlides();
//       //   },
//       //   color: "red",
//       // }),
//     ],
//   );
// }

async function doInsertSlide() {
  {
    const slideId = await addSlide(
      { ...getFileInfo() },
      getSlideInfo().layoutid,
    );
    // need to do transaction?
    // saveDexie();
    selectSlide(slideId);
  }
}

export const slideOptions = computed(() => [
  // {
  //   key: "header",
  //   type: "render",
  //   render: renderCustomHeader,
  // },
  {
    label: "Manage",
    key: "editslide",
    icon: TouchInteraction,
    children: [
      {
        quaternary: true,
        key: "copy",
        icon: DocumentCopy24Regular,
        color: "#239df0",
        label: "Copy Page",
        onClick: (e) => {
          copySlideClipboard();
        },
        tooltip: "Copy Page",
      },
      {
        quaternary: true,
        key: "paste",
        label: "Paste Page",
        icon: ClipboardPaste24Regular,
        color: "#957606",
        onClick: (e) => {
          pasteSlideFromClipboard();
        },
        tooltip: "Paste",
      },
      {
        type: "divider",
      },
      {
        label: "Hide/Unhide",
        key: "hide",
        icon: EyeOff24Regular,
        onClick: () => {
          hideSlide();
        },
      },
      {
        type: "divider",
      },
      {
        label: "Export Page",
        key: "slidesave",
        icon: DownloadFilled,
        show: !getSlidesMasterView(),
        children: [
          // {
          //   label: "PPTX",
          //   key: "ppt",
          //   icon: FilePowerpointRegular,
          //   onClick: async () => {
          //     const { exportPPTX } = await import(
          //       "shared-vuejs/api/export-pptx"
          //     );
          //     exportPPTX(getFileInfo().id, true, true);
          //   },
          // },
          {
            label: "JPEG",
            icon: PhotoSizeSelectActualOutlined,
            key: "jpg",
            onClick: () => {
              downloadShape("sld", 3, "jpg");
            },
          },
          {
            label: "WEBP",
            icon: PhotoSizeSelectSmallFilled,
            key: "webp",
            onClick: async () => {
              downloadShape("sld", 3, "webp");
            },
          },
        ],
      },
      {
        type: "divider",
      },
      {
        label: "Delete " + (!getSlidesMasterView() ? "Page" : "Layout"),
        color: "red",
        key: "delslide",
        show: !isWordDocument(getFileInfo(), [getSlideInfo()]),
        disabled: !!getInfoUseGrid(),
        // type: "render",
        icon: Delete20Regular,
        onClick: () => {
          getSlidesMasterView() ? doDeleteLayout() : doDeleteSlides();
        },
      },
    ],
  },

  {
    type: "divider",
  },
  ...getAddSlideOptions(),
  {
    type: "divider",
    show: !getSlidesMasterView(),
  },
  // {
  //   label: "Edit Slide Master",
  //   key: "master",
  //   icon: SlideLayout24Regular,
  //   onClick: () => {
  //     editMaster();
  //   },
  //   show: !getSlidesMasterView(),
  // },
  {
    label: "Change Layout...",
    key: "changelayout",
    icon: WindowEdit16Regular,
    disabled: !!getInfoUseGrid(),
    onClick: () => {
      changeLayout();
    },
    show: !piniaSlides().masterView,
  },
  {
    type: "divider",
  },
  {
    label: "Transition...",
    key: "transition",
    icon: StarHalf24Filled,
    disabled: !!getInfoUseGrid(),
    onClick: () => {
      piniaInfo().toolbarTab = "transition";
      if (piniaInfo().currentTaskPane === "transition") {
        piniaInfo().currentTaskPane = "";
      }
    },
  },
  {
    label: "Hide",
    key: "toggle-page-hidden",
    icon: Prohibited24Filled,
    show: !getSlidesMasterView(),
    onClick: togglePageHidden,
  },
  {
    label: "Format Background...",
    key: "formatslide",
    icon: ColorBackground24Regular,
    disabled: !!getInfoUseGrid(),
    onClick: () => {
      deselectAll();
      toggleTaskPane("formatslide");
    },
  },


  // {
  //   label: "Delete Layout",
  //   color: "red",
  //   key: "dellayout",
  //   disabled: !!getInfoUseGrid(),
  //   // type: "render",
  //   icon: Delete20Regular,
  //   onClick: doDeleteLayout,
  //   show: getSlidesMasterView(),
  // },
]);

function getAddSlideOptions() {
  if (getSlidesMasterView()) {
    return [
      {
        label: "Add Master",
        key: "addmaster",
        icon: FolderAdd24Regular,
        onClick: async () => {
          const masterid = "m" + genId();
          // await putShapesToDexie({
          //   id: masterid,
          //   fileId: getFileInfo().id,
          //   shapes: [],
          // });
          const layouts = getFileInfo().layouts;
          layouts.push({
            id: masterid,
            // fileId: getFileInfo().id,
            theme: "theme1",
          });
          updateFile({
            layouts,
          });
          // need transaction
          // saveDexie();
          saveSlideDB({
              id: masterid,
              shapes: [],
          }, getFileInfo().id)
          await saveDexie({ forceGenThumb: true });
          selectSlide(masterid);
        },
        show: getSlidesMasterView(),
      },
      {
        label: "Add Layout",
        key: "addlayout",
        icon: AddCardFilled,
        onClick: async () => {
          const layoutid = "m" + genId();
          const parentid =
            getSlideInfo().parentid || getSlidesSlideId();

          const parentInfo = getFileInfo().layouts.find(
            (lt) => lt.id == parentid,
          );

          const layouts = getFileInfo().layouts;
          layouts.push({
            id: layoutid,
            // fileId: getFileInfo().id,
            parentid,
          });
          updateFile({
            layouts,
          });
          // await putShapesToDexie({
          //   id: layoutid,
          //   fileId: getFileInfo().id,
          //   shapes: addPlaceholders(parentInfo),
          // });
          saveSlideDB({
              id: layoutid,
              shapes: addPlaceholders(parentInfo),
          }, getFileInfo().id);
          // need transaction
          await saveDexie({ forceGenThumb: true });
          selectSlide(layoutid);
        },
        show: getSlidesMasterView(),
      },
    ];
  } else {
    return newSlideOptions;
  }
}

export async function saveSlideAsPicture() {
  await downloadShape("sld", 3, "jpg");
}

async function togglePageHidden() {
  const selected = getSlidesMultiSelected();
  const ids = new Set(selected?.length ? selected : [getSlidesSlideId()]);
  const slides = getFileInfo().slides.map((slide) => ids.has(slide.id)
    ? { ...slide, show: slide.show == 0 ? 1 : 0 }
    : slide);
  // updateFile also notifies Vue's thumbnail list through sldState.
  updateFile({ slides });
  await saveDexie();
}

async function hideSlide() {
  let toHide: any = [];
  if (getSlidesMultiSelected().length > 0) {
    toHide = getSlidesMultiSelected();
  } else {
    const slideId = getSlidesSlideId();
    toHide = [slideId];
  }
  for (const id of toHide) {
    const slideInfo = getFileInfo().slides.find((sld) => sld.id == id);
    slideInfo.hidden = !slideInfo.hidden;
    updateSlide(slideInfo);
  }

  selectSlide(getSlidesSlideId(), true);
  saveDexie();
}

// function insertLayoutClick() {
//   // insertMaster();
// }

export async function doDeleteSlides() {
  if (isWordDocument(getFileInfo(), [getSlideInfo()])) return;
  piniaInfo().loadingBar = "Deleting...";
  // const oldSlides = [...getFileInfo().slides];
  // const deletedInfo = {
  //   // oldSlides,
  //   slides: [] as any,
  // };
  let toDelete;
  if (getSlidesMultiSelected().length > 0) {
    toDelete = getSlidesMultiSelected();
  } else {
    const slideId = getSlidesSlideId();
    toDelete = [slideId];
  }

  const oldIdx = getFileInfo().slides.findIndex(
    (sld) => sld.id == toDelete[0],
  );

  for (const id of toDelete) {
    await deleteSlide(id);
  }

  let newIdx = oldIdx - 1;
  if (newIdx < 0) {
    newIdx = 0;
  }
  await selectSlide(getFileInfo().slides[newIdx].id);
  setTimeout(() => {
    saveDexie({ forceGenThumb: false });
  }, 300);
  piniaInfo().loadingBar = "";
}

export async function doDeleteLayout() {
  piniaInfo().loadingBar = "Deleting...";
  const oldLayouts = [...getFileInfo().layouts];
  const deletedInfo = {
    // oldLayouts,
    layouts: [] as any,
  };
  let toDelete;
  if (getSlidesMultiSelected().length > 0) {
    toDelete = getSlidesMultiSelected();
  } else {
    const slideId = getSlidesSlideId();
    toDelete = [slideId];
  }

  const oldIdx = oldLayouts.findIndex((lt) => lt.id == toDelete[0]);
  // const fileId = getFileInfo().id;
  const fileInfo = getFileInfo();

  const allLayouts = fileInfo.layouts;
  const allSlides = fileInfo.slides;

  for (const id of toDelete) {
    const slideInfo = fileInfo.layouts.find((lt) => lt.id == id);

    const nonEmptyMaster =
      !slideInfo.parentid &&
      allLayouts.some((layout) => layout.parentid == slideInfo.id);
    const nonEmptyLayout =
      slideInfo.parentid &&
      allSlides.some((slide) => slide.layoutid == slideInfo.id);
    if (!nonEmptyMaster && !nonEmptyLayout) {
      deletedInfo.layouts.push(slideInfo); // for undo
      await deleteSlide(id, true);
      // layout in use
    } else {
      showError("Layout in use");
      piniaInfo().loadingBar = "";
      return;
    }
  }
  if (deletedInfo.layouts.length > 0) {
    let newIdx = oldIdx - 1;
    if (newIdx < 0) {
      newIdx = 0;
    }
    const curSlide = allSlides.find((slide) => slide.id == g.lastSlideId);
    const curLayoutId = curSlide.layoutid;
    selectSlide(curLayoutId);
    // await saveDexie({ forceGenThumb: false, deletedInfo });
  }
  piniaInfo().loadingBar = "";
}

export function getThumbDimension() {
  const THUMBWIDTH = piniaResize().THUMBWIDTH;

  const THUMBHEIGHT =
    (THUMBWIDTH * activeSlideHeight()) / activeSlideWidth() + 10;

  return [THUMBWIDTH, THUMBHEIGHT];
}
