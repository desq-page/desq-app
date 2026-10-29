import { computed, ref, shallowRef, readonly, watch } from "vue";
import { defineStore } from "pinia";
import { on } from "shared-vuejs/events";
import {
  showCanvasContextMenu,
  showShapeContextMenu,
} from "../main/contextmenu";
import { showError, showMessage } from "../main/utils";
import router from "@/router";
import { getFileInfo, getSlideInfo, getRulerWidth, setInfoCurrentTaskPane } from "shared-vuejs/editor";
import { isWordDocument } from "shared-vuejs/api/save-document";

on("store", (e) => {
  const { selection, info, slides, slideMetrics, resize, document } = e.detail;

  piniaShapes().shapeKeys = [...slides.shapeKeys];

  piniaSlides().slideId = slides.slideId;
  piniaSlides().slideIndex = slideMetrics.slideIndex;
  piniaSlides().multiSelected = slides.multiSelected;
  piniaSlides().masterView = slides.masterView;
  piniaSlides().sldState = slides.sldState;
  piniaSlides().changeLayout =slides.changeLayout;

  piniaInfo().undoIndex = info.undoIndex;
  piniaInfo().textCanUndo = info.textCanUndo;
  piniaInfo().textCanRedo = info.textCanRedo;
  piniaInfo().useGrid = info.useGrid;
  piniaInfo().fileDirty = info.fileDirty;

  piniaSelect().editingTextObject = selection.editingTextObject;
  piniaSelect().editingInfo = selection.editingInfo;
  piniaSelect().editingPoint = selection.editingPoint;
  piniaSelect().totalEditingPoints = selection.totalEditingPoints;
  piniaSelect().editingPendingFormats = selection.editingPendingFormats;

  piniaSelect().selCells = selection.selCells;
  piniaSelect().swipeSelectShapes = selection.swipeSelectShapes;

  piniaSelect().selShps = [...selection.selShps]; // reassign to ensure it refresh
  piniaSelect().selGrpShps = [...selection.selGrpShps];
  piniaSelect().cropShp = selection.cropShp
  // piniaSelect().selShpFormat = selection.selShpFormat;

  piniaResize().showRuler = !!resize.RULER_WIDTH;
  piniaInfo().showGuide = info.showGuide;
  piniaResize().slideScale = slideMetrics.slideScale;

  piniaResize().slideLeft = resize.slideLeft
  piniaResize().slideTop = resize.slideTop;
  piniaResize().slideWidth = document.fileInfo?.width
  piniaResize().slideHeight = document.fileInfo?.height
});

on("selShp", (e) => {
  piniaSelect().selShpFormat = e.detail;
  piniaInfo().setCurPopup("");
});

on("showPopup", (e) => {
  switch (e.detail?.popid) {
    case "shape-context":
      showShapeContextMenu(e.detail.x, e.detail.y);
      break;
    case "canvas-context":
      showCanvasContextMenu(e.detail.x, e.detail.y);
      break;
  }
});

on("showProgress", (e) => {
  piniaInfo().loadingBar = e.detail;
});

on("showMessage", (e) => {
  showMessage(e.detail.text, e.detail.time, e.detail.type);
});

on("showError", (e) => {
  showError(e.detail.text, e.detail.title);
});

on("routerPush", (e) => {
  router.push(e.detail);
})

on("hideAllModals", (e) => {
  piniaInfo().setCurPopup("");
})

export const piniaSession = defineStore("session", () => {
  const uid = ref(localStorage.getItem("uid"));
  const uname = ref(localStorage.getItem("uname"));
  const isDev = ref(
    location.href.includes("localhost") || location.href.includes("192"),
  );
  // const dashboardLoaded = ref(false);
  // watch(uid, () => {
  //   console.trace();
  // });
  return {
    uid,
    uname,
    isDev,
    // dashboardLoaded,
  };
});

export const piniaInfo = defineStore("info", () => {
  const curMode = ref("select");
  const curCmd = ref(""); // for draw shape
  const currentTaskPane = ref("");
  watch(currentTaskPane, (value) => { setInfoCurrentTaskPane(value); }, { flush: "sync" });
  const toolbarTab = ref("home");
  const lastTaskPane = ref("");
  const showNavi = ref(false);
  // const allowDragToReplace = ref(true);
  const dragImage = ref(null as any); // drag lexica image info
  // const layouts = ref([]);
  // const menuContext = ref({
  //   left: 0,
  //   top: 0,
  //   type: "",
  //   el: null,
  // } as {} | null);
  // const animationSelector = ref(false);
  const statusMessage = ref(null as any);
  const undos = ref([]);
  const undoIndex = ref(-1);
  const textCanUndo = ref(false);
  const textCanRedo = ref(false);
  const ctrlKey = ref(false); // key pressed
  const shiftKey = ref(false);
  const touchLength = ref(0);
  const thumbs = ref({} as any);
  // const thumbChanged = ref(false);
  // const menuActive = ref("");
  // const toolbarVal = ref({} as any);
  // const addonIframeUrl = ref("");
  const loadingBar = ref("" as any);
  const curPopupId = ref(""); // use for NaiveUI popup
  const curPopupXY = ref(null as any);
  const curPPTXUpload = ref(null as any);
  const openLLMModal = ref(false);
  const openNewFileModal = ref(false);
  const openPublishModal = ref(false);
  const openPreviewModal = ref(false);
  const openMediaOnline = ref(false);
  const openShowVarsModal = ref(null as any);
  // const openDashboardModal = ref(false);
  const openDataGrid = ref(null as any);
  const openFormulaRef = ref(false);
  const openImagePhotopea = ref("" as any);
  const slideTemplatePickers = ref(null as any);
  const useGrid = ref("");
  const fileDirty = ref(false);
  const showGuide = ref(false);

  // watch(() => curMode.value, (newVal, oldVal) => {
  //     console.trace(curMode.value)
  // })

  const setCurPopup = (id, x?, y?) => {
    piniaInfo().curPopupId = id;
    if (x || y) {
      piniaInfo().curPopupXY = { x, y };
    }
  };

  const setCurTaskPane = (taskpane) => {
    setCurPopup("");
    piniaInfo().currentTaskPane = taskpane;
    if (taskpane) {
      piniaResize().TASKPANE_WIDTH =
        piniaResize().windowWidth > 1024 || piniaResize().windowWidth < 769
          ? 350
          : 350;
    } else {
      piniaResize().TASKPANE_WIDTH = 0;
    }
  };

  const setLastTaskPane = (taskpane) => {
    piniaInfo().lastTaskPane = taskpane;
  };

  const toggleNavi = (state) => {
    if (isWordDocument(getFileInfo(), [getSlideInfo()])) state = false;
    piniaInfo().showNavi = state;
    if (state) {
      piniaResize().NAVI_WIDTH = piniaResize().windowWidth < 769 ? 350 : 260;
    } else {
      piniaResize().NAVI_WIDTH = 0;
    }
  };

  return {
    curMode,
    curCmd,
    currentTaskPane,
    toolbarTab,
    lastTaskPane,
    showNavi,
    // allowDragToReplace,
    dragImage,
    statusMessage,
    undos,
    undoIndex,
    textCanUndo,
    textCanRedo,
    ctrlKey,
    shiftKey,
    touchLength,
    thumbs,
    // thumbChanged,
    // addonIframeUrl,
    loadingBar,
    curPopupId,
    curPopupXY,
    curPPTXUpload,
    openLLMModal,
    openNewFileModal,
    openPreviewModal,
    openPublishModal,
    openShowVarsModal,
    openMediaOnline,
    openFormulaRef,
    // openDashboardModal,
    openImagePhotopea,
    slideTemplatePickers,
    useGrid,
    fileDirty,
    openDataGrid,
    setCurPopup,
    setCurTaskPane,
    setLastTaskPane,
    toggleNavi,
    showGuide,
  };
});

export const piniaSelect = defineStore("select", () => {
  const editingPoint: any = ref(-1);
  const totalEditingPoints: any = ref(0);
  const originShpBeforeEditingPoint = ref(null as any);
  const editingTextObject = ref("");
  const editingInfo = ref({} as any);
  const editingPendingFormats = ref(null as any);
  const cropShp = ref("");
  const swipeSelectShapes = ref(null as any | null);

  const selShps = ref([] as any);
  const selGrpShps = ref([] as any);
  const hiliteOver = ref("");
  const hiliteSuggest = ref("");

  const selShpInfos = ref([] as any);
  const selShpFormat = shallowRef(null as any);

  const selCells = ref([] as any);

  function updateSelShpInfos() {}

  return {
    selShps,
    selGrpShps,
    selCells,
    selShpInfos,
    selShpFormat,
    updateSelShpInfos,
    // selSubLevelSubGrp,
    editingPoint,
    totalEditingPoints,
    originShpBeforeEditingPoint,
    editingTextObject,
    editingInfo,
    editingPendingFormats,
    cropShp,
    swipeSelectShapes,
    hiliteOver,
    hiliteSuggest,
    // motionEff,
    // spinOnShpId,
  };
});

export const piniaHandling = defineStore("handling", () => {
  const handlingInfo: any = ref(null); // HandleBox is sizing
  const handlingTable: any = ref(null);
  const currentMouse: any = ref(null);
  function setHandlingInfo(info) {
    handlingInfo.value = info;
  }
  return {
    handlingInfo: readonly(handlingInfo),
    handlingTable,
    currentMouse,
    setHandlingInfo,
  };
});

export const piniaResize = defineStore("resize", () => {
  const slideScale = ref(1);
  const slideLeft = ref(0);
  const slideTop = ref(0);
  const slideWidth = ref(1280);
  const slideHeight = ref(720);
  // const maxSlideHeight = ref(1000); // slide height plus max shapes
  // const maxSlideWidth = ref(1000);
  const scrollX = ref(0);
  const scrollY = ref(0);
  const windowWidth = ref(window.innerWidth);
  const windowHeight = ref(window.innerHeight);
  const showRuler = ref(!!getRulerWidth());
  const TASKPANE_WIDTH = ref(0);
  const NAVI_WIDTH = ref(0);

  const workcanvasW = ref(window.innerWidth);
  const workcanvasH = ref(window.innerHeight);
  const workcanvasX = ref(0);
  const workcanvasY = ref(0);

  const THUMBWIDTH = computed(() => {
    if (windowWidth.value < 769) {
      return 100;
    } else {
      return NAVI_WIDTH.value - 65;
    }
  });

  const INSERTPANE_WIDTH = computed(() => {
    return 0; //windowWidth.value > 1024 ? 70 : 50;
  });

  return {
    windowWidth,
    windowHeight,
    // RIGHTPANE_WIDTH,
    // LEFTPANE_WIDTH,
    TASKPANE_WIDTH,
    INSERTPANE_WIDTH,
    NAVI_WIDTH,
    THUMBWIDTH,
    slideScale,
    slideLeft,
    slideTop,
    slideWidth,
    slideHeight,
    // maxSlideWidth,
    // maxSlideHeight,
    scrollX,
    scrollY,
    showRuler,
    workcanvasX,
    workcanvasY,
    workcanvasW,
    workcanvasH,
  };
});

// const DEFAULT_SLIDE_CONFIG = {
//   width: g.DEFAULT_SLIDE_WIDTH,
//   height: g.DEFAULT_SLIDE_HEIGHT,
// };

export const piniaSlides = defineStore("slides", () => {
  const slideId = ref("");
  const slideIndex = ref(1);
  const sldState = ref(0);

  const masterView = ref(false);
  const changeLayout = ref(false);
  const multiSelected = shallowRef([] as any);

  return {
    masterView,
    changeLayout,
    multiSelected,
    slideId,
    sldState,
    slideIndex,
  };
});

export const piniaShapes = defineStore("shapes", () => {
  const shapeKeys = ref([] as any);
  return {
    shapeKeys,
  };
});

// export function resetAllStores() {
//   // const activepinia = getActivePinia();
//   // if (activepinia) {
//   //   Object.entries(activepinia.state.value).forEach(([storeName, state]) => {
//   //     const storeDefinition = defineStore(storeName, state);
//   //     const store = storeDefinition(activepinia);
//   //     store.$reset();
//   //   });
//   // }
//   piniaInfo().undos = [];

//   // piniaSlides().slideInfo = DEFAULT_SLIDE_CONFIG;
//   piniaShapes().updateShapes([]);
//   piniaSlides().slideId = "";
//   piniaResize().slideScaleText = "Fit";
//   piniaSelect().selShps.clear();
//   piniaSelect().selGrpShps.clear();
//   piniaSlides().masterView = false;
//   piniaSlides().changeLayout = false;
//   piniaInfo().useGrid = "";
//   piniaInfo().currentTaskPane = "";
// }
