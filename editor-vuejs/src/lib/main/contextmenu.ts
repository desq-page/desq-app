import { setSelectDragText } from "shared-vuejs/editor";
import { piniaInfo, piniaSelect } from "../common/store";


export function showSlideContextMenu(e) {
  if (piniaSelect().editingPoint >= 0 || piniaInfo().useGrid) {
    return false;
  }
  if (e.button == 2) {
    showPopup("popover-slide-options", e.pageX, e.pageY + 10);
  }
}

export function showShapeContextMenu(x, y) {
  showPopup("shape-toolbar-popup", x, y);
}

export function showCanvasContextMenu(x, y) {
  // click on shape
  showPopup("canvas-toolbar-popup", x, y);
}

export function hideUnusedPopupsOnCanvas(e) {
  if (piniaSelect().editingPoint >= 0 || piniaInfo().useGrid) {
    return false;
  }
  setSelectDragText(false);
}

function showPopup(popid, x, y) {
  piniaInfo().setCurPopup("");
  setTimeout(() => {
    piniaInfo().setCurPopup(popid, x, y);
  }, 100);
}
