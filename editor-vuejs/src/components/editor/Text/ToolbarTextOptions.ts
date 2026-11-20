import { getShapeDeep, updateShape } from "shared-vuejs/editor";
import { saveDexie } from "shared-vuejs/api/dbutils";
import { piniaSelect } from "@/lib/common/store";
import { execEditorSurroundSpan } from "shared-vuejs/api/execCommand";

import {
  FormatBoldFilled,
  FormatItalicFilled,
  FormatUnderlinedFilled,
  SubscriptFilled,
  SuperscriptFilled,
} from "@vicons/material";

import { LogoGoogle } from "@vicons/carbon";
import { DeviceLaptop, FileUpload } from "@vicons/tabler";

export function hideFontPanel() {
  return (
    !piniaSelect().selShpFormat?.txBody &&
    piniaSelect().selShpFormat?.type !== "group" &&
    piniaSelect().selShpFormat?.type !== "smartart" &&
    piniaSelect().selShpFormat?.type !== "table"
  );
}

export const fontTabbarItems = [
  {
    label: "Google",
    icon: LogoGoogle,
    taskpane: "googlefonts",
  },
  {
    label: "Uploaded",
    icon: FileUpload,
    taskpane: "localfonts",
  },
  {
    label: "System",
    icon: DeviceLaptop,
    taskpane: "systemfonts",
  },
];

export const textToolbarOptions: any = [
  {
    arg: "bold",
    icon: FormatBoldFilled,
    onClick: (e) => {
      updateFontStyle(
        e,
        {
          "font-weight": "bold",
        },
        {
          "font-weight": "normal",
        },
      );
    },
  },
  {
    arg: "italic",
    icon: FormatItalicFilled,
    onClick: (e) => {
      updateFontStyle(
        e,
        {
          "font-style": "italic",
        },
        {
          "font-style": "normal",
        },
      );
    },
  },
  {
    arg: "underline",
    icon: FormatUnderlinedFilled,
    onClick: (e) => {
      updateFontStyle(
        e,
        {
          "text-decoration": "underline",
        },
        {
          "text-decoration": "none",
        },
      );
    },
  },
  {
    title: "subscript",
    arg: "sub",
    icon: SubscriptFilled,
    onClick: (e) => {
      execEditorSurroundSpan(
        {
          "--baseline": -37,
        },
        {
          "--baseline": 0,
        },
      );
      e.preventDefault();
    },
  },
  {
    title: "superscript",
    icon: SuperscriptFilled,
    arg: "super",
    onClick: (e) => {
      execEditorSurroundSpan(
        {
          "--baseline": 45,
        },
        {
          "--baseline": 0,
        },
      );
      e.preventDefault();
    },
  },
];

function updateFontStyle(e, setObject, unsetObject) {
  const selection = piniaSelect();
  const shape = selection.selShpFormat;
  if (selection.editingInfo || (shape?.txBody && shape.type !== "input")) {
    execEditorSurroundSpan(setObject, unsetObject);
    e.preventDefault();
  } else if (shape?.type === "input") {
    const [styleKey] = Object.keys(setObject);
    const [key, on, off] = {
      "font-weight": ["b", 1, 0],
      "font-style": ["i", 1, 0],
      "text-decoration": ["u", "sng", "none"],
    }[styleKey];
    const input = getShapeDeep(shape.id);
    if (!input) return;
    const active = input[key] == on;
    execEditorSurroundSpan(active ? unsetObject : setObject);
    updateShape({ ...getShapeDeep(shape.id), id: shape.id, [key]: active ? off : on });
    saveDexie();
    e.preventDefault();
  }
}
