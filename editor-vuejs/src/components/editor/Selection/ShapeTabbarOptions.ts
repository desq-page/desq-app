import { piniaSelect } from "@/lib/common/store";
import { Paragraph } from "@vicons/carbon";
import {
  Image24Regular,
  LineStyle24Filled,
  PaintBucket24Filled,
  TextColor24Filled,
  TextEffects24Filled,
} from "@vicons/fluent";
import { Brightness4Outlined, BrightnessAutoOutlined } from "@vicons/material";
import { Dimensions, TextResize } from "@vicons/tabler";
import { computed } from "vue";

export const shapeTabbarItems = computed(() => [
  {
    label:
      "Format " +
      (piniaSelect().selShpFormat?.$_otag == "pic" ? "Picture" : "Shape"),
    taskpane: "shapefill",
    taskpanes: [
      "shapefill",
      "shapefx",
      "lineformat",
      "shapeoptions",
      "pictureoptions",
    ],
  },
  {
    label: "Format Text",
    taskpane: "textcolor",
    taskpanes: [
      "textcolor",
      "paraformat",
      "textfx",
      // "textoutline",
      "textboxoptions",
    ],
    textOnly: true,
  },
]);

export const subTabbarItems = computed(() => [
  {
    tooltip: "Fill",
    taskpane: "shapefill",
    icon: PaintBucket24Filled,
  },
  {
    tooltip: "Line",
    icon: LineStyle24Filled,
    taskpane: "lineformat",
  },

  {
    tooltip: "Effect",
    icon: Brightness4Outlined,
    taskpane: "shapefx",
  },
  {
    tooltip: "Size",
    icon: Dimensions,
    taskpane: "shapeoptions",
  },
  {
    tooltip: "Picture",
    icon: Image24Regular,
    taskpane: "pictureoptions",
    show:
      !!piniaSelect().selShpFormat?.blipFill ||
      piniaSelect().selShpFormat?.ph?.$_type == "pic",
  },
]);

export const subTextTabbarItems = [
  {
    tooltip: "Text Fill",
    taskpane: "textcolor",
    icon: TextColor24Filled,
  },
  // {
  //   tooltip: "Text Outline",
  //   icon: TextEffects24Regular,
  //   taskpane: "textoutline",
  // },
  {
    tooltip: "Text Effect",
    icon: TextEffects24Filled,
    taskpane: "textfx",
  },
  {
    tooltip: "Paragraph",
    icon: Paragraph,
    taskpane: "paraformat",
  },
  {
    tooltip: "Textbox",
    icon: TextResize,
    taskpane: "textboxoptions",
  },
];

export const subBgTabbarItems = [
  {
    label: "Background",
    taskpane: "formatslide",
    icon: PaintBucket24Filled,
    taskpanes: ["formatslide", "slidepictureoptions"],
  },
  // {
  //   label: "Options",
  //   icon: TextParagraph24Regular,
  //   taskpane: "slideoptions",
  //   taskpanes: ["slideoptions"],
  // },
];
