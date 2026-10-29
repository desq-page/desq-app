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
  if (piniaSelect().editingInfo) {
    execEditorSurroundSpan(setObject, unsetObject);
    e.preventDefault();
  } else if (
    piniaSelect().selShpFormat?.txBody ||
    piniaSelect().selShpFormat?.type == "input"
  ) {
    // setting for whole textbox
    const styleKey = Object.keys(setObject)[0];
    // if (!key.startsWith("--")) {
    //   key = camelCase(key);
    // }

    const val = Object.values(setObject)[0];

    let updatedVal;
    let key;
    if (styleKey == "font-weight") {
      key = "b";
      updatedVal = val == "bold" ? 1 : 0;
    } else if (styleKey == "font-style") {
      key = "i";
      updatedVal = val == "italic" ? 1 : 0;
    } else if (styleKey == "text-decoration") {
      key = "u";
      updatedVal = val == "underline" ? "sng" : "none";
    }

    if (
      piniaSelect().selShpFormat?.txBody?.bodyPr?.defRPr?.[key] == updatedVal ||
      piniaSelect().selShpFormat[key] == updatedVal
    ) {
      // already has this value, likely trying to toggle
      updatedVal = Object.values(unsetObject)[0];
      // setting individuals to unsetObject
      execEditorSurroundSpan(unsetObject, undefined);
    } else {
      // setting individuals to setObject
      execEditorSurroundSpan(setObject, undefined);
    }
    if (piniaSelect().selShpFormat?.type == "input") {
      const shp = getShapeDeep(piniaSelect().selShpFormat?.id);
      shp[key] = updatedVal;
      updateShape(shp);
      saveDexie();
    } else {
      piniaSelect().selShpFormat.txBody.bodyPr.defRPr = {
        ...piniaSelect().selShpFormat.txBody?.bodyPr?.defRPr,
        [key]: updatedVal,
      };
    }
  }
}
