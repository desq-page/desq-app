import { piniaInfo, piniaSelect, piniaShapes } from "@/lib/common/store";
import {
  bringForward,
  bringToFront,
  sendBackward,
  sendToBack,
} from "shared-vuejs/api/arrange";
import { flipShape } from "shared-vuejs/api/shape";
import { toggleTaskPane } from "@/lib/main/utils";
import {
  ColumnDelete,
  ColumnInsert,
  Layers,
  RowDelete,
  RowInsert,
} from "@vicons/carbon";

import {
  AlignSpaceEvenlyHorizontal20Regular,
  ArrowDown24Filled,
  ArrowDownload24Filled,
  ArrowUp24Filled,
  ArrowUpload24Filled,
  FlipHorizontal24Filled,
  FlipVertical24Regular,
  ShapeExclude24Regular,
  ShapeIntersect24Regular,
  Shapes24Regular,
  ShapeSubtract20Regular,
  ShapeUnion24Regular,
  TableCellsMerge24Regular,
  TableCellsSplit24Regular,
} from "@vicons/fluent";

import { fragmentShapes, mergeShapes } from "shared-vuejs/api/mergeShapes";
import { saveDexie } from "shared-vuejs/api/dbutils";
import {
  downloadFile,
  exportSelectedShapes,
} from "shared-vuejs/api/downloadShape";

import {
  PhotoSizeSelectActualOutlined,
  PhotoSizeSelectSmallFilled,
} from "@vicons/material";
import { isTextShape } from "shared-vuejs/api/gridUtils";
import { deleteCol, deleteRow, insertCol, insertRow, mergeCells, splitCell } from "shared-vuejs/api/tableOps";

export const flipOptions = [
  {
    label: "Flip Horizontal",
    icon: FlipHorizontal24Filled,
    key: "FlipHor",

    onClick: () => {
      flipShape("flipH");
    },
  },
  {
    label: "Flip Vertical",
    icon: FlipVertical24Regular,
    key: "FlipVer",

    onClick: () => {
      flipShape("flipV");
    },
  },
];

export const unionOptions = [
  {
    label: "Union",
    icon: ShapeUnion24Regular,
    key: "Union",

    onClick: () => {
      doMergeShape("union");
    },
  },
  {
    label: "Combine",
    icon: ShapeExclude24Regular,
    key: "Combine",

    onClick: () => {
      doMergeShape("combine");
    },
  },
  {
    label: "Substract",
    icon: ShapeSubtract20Regular,
    key: "substract",

    onClick: async () => {
      doMergeShape("substract");
    },
  },
  {
    label: "Intersect",
    icon: ShapeIntersect24Regular,
    key: "Intersect",

    onClick: () => {
      doMergeShape("intersect");
    },
  },
  {
    label: "Fragment",
    icon: AlignSpaceEvenlyHorizontal20Regular,
    key: "Fragment",

    onClick: () => {
      fragmentShapes();
    },
  },
];

export const tableOptions = () => [
  {
    label: "Merge Cells",
    icon: TableCellsMerge24Regular,
    key: "mergecells",
    disabled: !piniaSelect().selCells?.length,
    onClick: (e) => {
      mergeCells();
    },
  },
  {
    label: "Split Cells",
    icon: TableCellsSplit24Regular,
    key: "splitcells",
    disabled: !piniaSelect().editingInfo?.selTdPr?.rowSpan && !piniaSelect().editingInfo?.selTdPr?.colSpan ,
    onClick: (e) => {
      splitCell();
    },
  },
  { type: "divider" },
  {
    label: "Insert row",
    icon: RowInsert,
    key: "insertRow",

    onClick: (e) => {
      insertRow('below');
    },
  },
  {
    label: "Delete row",
    icon: RowDelete,
    key: "deleteRow",
    color: "red",
    onClick: (e) => {
      deleteRow()
    },
  },
  { type: "divider" },
  {
    label: "Insert column",
    icon: ColumnInsert,
    key: "insertColumn",

    onClick: () => {
      insertCol()
    },
  },
  {
    label: "Delete column",
    icon: ColumnDelete,
    key: "deleteColumn",
    color: "red",
    onClick: (e) => {
      deleteCol()
    },
  },
];

export function getTableColRow() {
  const tdId = piniaSelect().editingTextObject;

  const tdInfo = tdId.split(":");
  let rIdx = tdInfo[2] || 0
  let cIdx = tdInfo[3] || 0
  // let rIdx = 0, cIdx = 0;

  // // find current index
  // const tableInfo = gid(piniaSelect().selShpFormat?.id)?.querySelector("table");
  // if (tableInfo) {
  //   // rIdx = Array.from(tableInfo.rows).findIndex(
  //   //   (r : any) => !!r.cells.find((td) => td.id == tdId),
  //   // );
  //   Array.from(tableInfo.rows).forEach((row: any, rowIdx) => {
  //     rIdx = rowIdx;
  //     const col = Array.from(row.cells).findIndex((td: any) => td.id == tdId);
  //     if (col > 0) {
  //       cIdx = col;
  //       return;
  //     }
  //   });
    
  // }
  return { rIdx, cIdx };
}

export const layerItems: any = [
  {
    icon: ArrowUpload24Filled,
    label: "Bring To Front",
    tooltip: "Bring To Front",
    key: "bringtofront",
    onClick: (e) => {
      bringToFront();
    },
  },
  {
    icon: ArrowUp24Filled,
    label: "BringForward",
    tooltip: "Bring Forward",
    key: "bringforward",
    onClick: (e) => {
      bringForward();
    },
  },
  {
    icon: ArrowDown24Filled,
    label: "Send Backward",
    tooltip: "Send Backward",
    key: "sendbackward",
    onClick: (e) => {
      sendBackward();
    },
  },
  {
    icon: ArrowDownload24Filled,
    label: "Send To Back",
    key: "sendtoback",
    tooltip: "Send To Back",
    onClick: (e) => {
      sendToBack();
    },
  },
  // {
  //   type: "divider",
  // },
  // {
  //   icon: LockOutlined,
  //   label: "Lock Shape",
  //   tooltip: "Lock",
  //   key: "lockshape",
  //   onClick: (e) => {
  //     lockSelectedShapes();
  //   },
  // },
  // {
  //   icon: EyeOff,
  //   label: "Hide Shape",
  //   key: "hideshape",
  //   tooltip: "Hide",
  //   onClick: (e) => {
  //     hideSelectedShapes();
  //   },
  // },
  {
    type: "divider",
  },
  {
    icon: Layers,
    label: "Layers Pane",
    key: "layerpane",
    tooltip: "Layers",
    onClick: (e) => {
      toggleTaskPane("arrange");
    },
  },
];

export const downloadOptions = [
  {
    label: "PNG",
    key: "png",
    icon: Shapes24Regular,
    onClick: () => {
      downloadShape("png");
    },
  },
  {
    label: "JPG",
    key: "jpg",
    icon: PhotoSizeSelectActualOutlined,
    onClick: () => {
      downloadShape("jpg");
    },
  },
  {
    label: "WEBP",
    key: "webp",
    icon: PhotoSizeSelectSmallFilled,
    onClick: async () => {
      downloadShape("webp");
    },
  },
];

async function doMergeShape(type) {
  console.log("do merge");
  await mergeShapes(type);
  saveDexie();
}

export async function rmbgUsingXenova() {
  piniaInfo().loadingBar = "Loading model, may take a while the first time...";
  const { xenovaRmbg } = await import("shared-vuejs/api/xenova");
  xenovaRmbg();
}

async function downloadShape(format) {
  const img: any = await exportSelectedShapes(format);
  let name = "image";
  if (piniaSelect().selShps.length == 1) {
    name = piniaSelect().selShpFormat?.name;
  }
  downloadFile(img, name + "." + format);
}

export const showFlipShape = () =>
  piniaSelect().selShpFormat &&
  !piniaSelect().selShpFormat?.blipFill?.video?.startsWith("http") &&
  !(
    piniaSelect().selShpFormat?.children ||
    piniaSelect().selShpFormat?.d?.includes("E") ||
    piniaSelect().selShpFormat?.type == "table" ||
    piniaSelect().selShpFormat?.type == "chart" ||
    piniaSelect().selShpFormat?.type == "input"
  );

export const showEditingPoint = () =>
  piniaSelect().selShps.length == 1 &&
  piniaSelect().selGrpShps.length == 0 &&
  piniaSelect().selShpFormat &&
  !piniaSelect().cropShp &&
  !isTextShape(piniaSelect().selShpFormat) &&
  !piniaSelect().selShpFormat?.svg &&
  piniaSelect().selShpFormat?.type !== "line" &&
  !piniaSelect().selShpFormat?.d?.includes("E") &&
  !piniaSelect().selShpFormat?.children &&
  piniaSelect().selShpFormat?.type != "chart" &&
  piniaSelect().selShpFormat?.type !== "input" &&
  piniaSelect().selShpFormat?.type !== "table" &&
  !piniaSelect().selShpFormat?.blipFill?.video?.startsWith("http") &&
  piniaSelect().selShpFormat?.d;


export function showCrop() {
  return (
    (piniaSelect().selShpFormat?.blipFill ||
      piniaSelect().selShpFormat?.spPr?.blipFill) &&
    piniaSelect().selShps.length == 1 &&
    !piniaSelect().editingTextObject &&
    piniaSelect().editingPoint == -1
  );
}

export function showGroup() {
  return (
    piniaSelect().selShps.length > 1 ||
    (piniaSelect().selShpFormat?.type == "group" &&
      !piniaSelect().selShpFormat?.container &&
      piniaSelect().selGrpShps.length < 1 &&
      piniaSelect().selShpFormat?.id !== "moverTemp")
  );
}
