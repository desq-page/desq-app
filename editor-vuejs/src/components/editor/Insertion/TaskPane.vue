<template>
  <div
    :class="$style.designerouter"
    :style="designerouterPos"
    @contextmenu.prevent
    @keydown.stop
    tabindex="-1"
  >
    <!-- <InsertionPanel /> -->
    <div id="taskPane" :class="$style.taskPane" :style="taskPanePos">
      <EditorAgent v-show="piniaInfo().currentTaskPane === 'agent'" />
      <div :class="$style.insertPanel" v-if="piniaInfo().currentTaskPane && piniaInfo().currentTaskPane !== 'agent'">
        <ShapeOptions v-if="piniaInfo().currentTaskPane == 'shapeoptions'" />
        <ShapeFill v-if="piniaInfo().currentTaskPane == 'shapefill'" />
        <InsertAutoShapes v-if="piniaInfo().currentTaskPane == 'insertAutoshapes'" />
        <ChangeAutoShapes v-if="piniaInfo().currentTaskPane == 'changeAutoshapes'" />
        <TextShapesPanel v-if="piniaInfo().currentTaskPane == 'texts'" />
        <ObjectShapes v-if="piniaInfo().currentTaskPane == 'objects'" />
        <ArrangePanel v-if="piniaInfo().currentTaskPane == 'arrange'" />

        <SettingsPanel v-if="piniaInfo().currentTaskPane == 'settings'" />
        <SizingPanel v-if="piniaInfo().currentTaskPane == 'sizingpanel'" />
        <SizingPanel v-if="piniaInfo().currentTaskPane == 'slidesize'" />
        <FormatSlide v-if="piniaInfo().currentTaskPane == 'formatslide'" />
        <TransitionPanel v-if="piniaInfo().currentTaskPane == 'transition'" />

        <PageSetupPanel v-if="piniaInfo().currentTaskPane == 'pagesetup'" />
        <LineFormatPanel v-if="piniaInfo().currentTaskPane == 'lineformat'" />
        <PictureOptions v-if="piniaInfo().currentTaskPane == 'pictureoptions'" />
        <PictureOptions
          v-if="piniaInfo().currentTaskPane == 'slidepictureoptions'"
          background
        />
        <!-- <TextOutlinePanel v-if="piniaInfo().currentTaskPane == 'textoutline'" /> -->

        <TextColorPanel v-if="piniaInfo().currentTaskPane == 'textcolor'" />

        <ParagraphFormat v-if="piniaInfo().currentTaskPane == 'paraformat'" />
        <TextboxOptions v-if="piniaInfo().currentTaskPane == 'textboxoptions'" />
        <ShapeEffects v-if="piniaInfo().currentTaskPane == 'shapefx'" />
        <TextEffects v-if="piniaInfo().currentTaskPane == 'textfx'" />
        <!-- <ShapeInfo v-if="piniaInfo().currentTaskPane == 'shapeinfo'" /> -->
        <HyperlinkDialog v-if="piniaInfo().currentTaskPane == 'hyperlink'" />
        <!-- 
        <YoutubePanel v-if="piniaInfo().currentTaskPane == 'youtube'" /> -->
        <ShapeAnimations v-if="piniaInfo().currentTaskPane == 'animations'" />
        <AnimationList v-if="piniaInfo().currentTaskPane == 'addanimation'" />
        <MediaPanel v-if="piniaInfo().currentTaskPane == 'mediaPanel'" />
        <RegenerateText
          v-if="piniaInfo().currentTaskPane == 'regenerateText'"
        />
        <RegenerateText v-if="piniaInfo().currentTaskPane == 'summarizeText'" />
        <TranslateTextLLM
          v-if="piniaInfo().currentTaskPane == 'translateLLM'"
        />
        <SystemFonts v-if="piniaInfo().currentTaskPane == 'systemfonts'" />
        <GoogleFonts v-if="piniaInfo().currentTaskPane == 'googlefonts'" />
        <LocalFonts v-if="piniaInfo().currentTaskPane == 'localfonts'" />
        <!-- <ShadowEffect v-if="piniaInfo().currentTaskPane == 'shadowfx'" /> -->
        <DuotoneFx v-if="piniaInfo().currentTaskPane == 'duotonefx'" />
        <DuotoneFx
          v-if="piniaInfo().currentTaskPane == 'slidebackgroundduotone'"
          background
        />
        <LocalMediaTab v-if="piniaInfo().currentTaskPane == 'localmediatab'" />
      </div>
    </div>
    <HideTaskPaneBtn v-if="piniaInfo().currentTaskPane !== 'agent'" />
  </div>
</template>

<script setup lang="ts">
import { piniaInfo, piniaResize, piniaSelect } from "@/lib/common/store";
import SettingsPanel from "@/components/editor/Dialogs/SettingsPanel.vue";
import SizingPanel from "@/components/editor/Dialogs/SizingPanel.vue";
// import SlideBackgroundPanel from "@/components/editor/Dialogs/SlideBackgroundPanel.vue";
// import YoutubePanel from "@/components/editor/Dialogs/YoutubePanel.vue";
import LineFormatPanel from "@/components/editor/LineFormat/LineFormatPanel.vue";
import TextColorPanel from "@/components/editor/Text/TextColorPanel.vue";
import ParagraphFormat from "@/components/editor/Text/ParagraphFormat.vue";
import PageSetupPanel from "@/components/editor/Dialogs/PageSetupPanel.vue";

import AnimationList from "@/components/editor/Animation/AnimationList.vue";

import ArrangePanel from "@/components/editor/Selection/ArrangePanel.vue";
import { computed, defineAsyncComponent, onMounted, onUnmounted, useCssModule, watch } from "vue";
import { on, off } from "shared-vuejs/events";
import { toggleTaskPane } from "@/lib/main/utils";
import MediaPanel from "@/components/editor/Media/MediaPanel.vue";
import SystemFonts from "@/components/editor/Text/SystemFonts.vue";
import GoogleFonts from "@/components/editor/Text/GoogleFonts.vue";
import LocalFonts from "@/components/editor/Text/LocalFonts.vue";
import ShapeOptions from "@/components/editor/Selection/ShapeOptions.vue";
import RegenerateText from "@/components/editor/Media/RegenerateText.vue";
import TranslateTextLLM from "@/components/editor/Media/TranslateTextLLM.vue";
import ShapeAnimations from "@/components/editor/Animation/ShapeAnimations.vue";
import ShapeFill from "@/components/editor/Selection/ShapeFill.vue";
import ShapeEffects from "@/components/editor/Effects/ShapeEffects.vue";
import FormatSlide from "@/components/editor/Dialogs/FormatSlide.vue";
import HyperlinkDialog from "@/components/editor/Dialogs/HyperlinkDialog.vue";
import HideTaskPaneBtn from "./HideTaskPaneBtn.vue";
// import TextOutlinePanel from "../Text/TextOutlinePanel.vue";
import ObjectShapes from "../AutoShapes/ObjectShapes.vue";
import TransitionPanel from "../Animation/TransitionPanel.vue";
// import ShadowEffect from "../Effects/ShadowEffect.vue";
import DuotoneFx from "../Effects/DuotoneFx.vue";
import LocalMediaTab from "../Media/LocalMediaTab.vue";
import InsertAutoShapes from "../AutoShapes/InsertAutoShapes.vue";
import ChangeAutoShapes from "../AutoShapes/ChangeAutoShapes.vue";
import TextEffects from "../Text/TextEffects.vue";
import PictureOptions from "../Media/PictureOptions.vue";
import TextboxOptions from "../Text/TextboxOptions.vue";
import { hideEditor } from "shared-vuejs/api/updateText.js";
import TextShapesPanel from "../AutoShapes/TextShapesPanel.vue";
// import FillPicture from "../Selection/FillPicture.vue";

const $style = useCssModule();
const EditorAgent = defineAsyncComponent(() => import("../Agent/EditorAgent.vue"));
const openTextboxOptions = () => toggleTaskPane("textboxoptions");
onMounted(() => on("openTextboxOptions", openTextboxOptions));
onUnmounted(() => off("openTextboxOptions", openTextboxOptions));

watch(
  () => piniaSelect().selShpFormat,
  (newVal, oldVal) => {
    const sel = piniaSelect().selShpFormat
    const isPic =
      sel?.$_otag == "pic" ||
      sel?.ph?.$_type == "pic";

    const textPanels = ["textcolor", "paraformat",
        "textfx", "textboxoptions"
      ]

    const isTextPanels = textPanels.includes(piniaInfo().currentTaskPane);

    if (
      !sel &&
      (isShapePanels() || isTextPanels)
    ) {
      piniaInfo().setLastTaskPane(piniaInfo().currentTaskPane);
      piniaInfo().setCurTaskPane("formatslide");
    } else if ((piniaInfo().currentTaskPane == "formatslide" ||
      piniaInfo().currentTaskPane == "slidepictureoptions")&& sel) {
      if (textPanels.includes(piniaInfo().lastTaskPane) && !sel.txBody) {
        piniaInfo().setCurTaskPane("shapefill")
      } else {
        piniaInfo().setCurTaskPane(piniaInfo().lastTaskPane || "shapefx");
      }
    } else if (isTextPanels && !sel.txBody) {
      piniaInfo().setCurTaskPane("shapefx");
    } else if (piniaInfo().currentTaskPane == "pictureoptions" && sel && !sel.blipFill) {
      piniaInfo().setCurTaskPane("shapefill");
    } else if (
      piniaInfo().currentTaskPane == "changeAutoshapes" && piniaInfo().lastTaskPane
    ) {
      // make sure changeAutoshapes is closed
      // other modal should be similar
      if (sel) {
        piniaInfo().setCurTaskPane("shapefill");
      } else {
        piniaInfo().setCurTaskPane("formatslide");
      }
    }


    // if (piniaResize().windowWidth < 1024 && piniaResize().windowWidth >= 769) {
    //   piniaInfo().toggleNavi(false);
    // }
  }
);


watch(
  () => piniaInfo().currentTaskPane,
  () => {
    if (piniaInfo().currentTaskPane && piniaResize().windowWidth <= 1024) {
      piniaInfo().toggleNavi(false);
    }
    if (isShapePanels() && piniaSelect().editingInfo) {
      hideEditor();
    }
  },
);


piniaInfo().setCurTaskPane("");

const designerouterPos = computed(() => {
  if (piniaResize().windowWidth < 769) {
    return {
      bottom: 0,
      height: `${piniaResize().TASKPANE_WIDTH + piniaResize().INSERTPANE_WIDTH}px`,
      width: `100vw`,
    };
  } else {
    return {
      top: 0,
      height: "100%",
      width: `${piniaResize().TASKPANE_WIDTH + piniaResize().INSERTPANE_WIDTH}px`,
    };
  }
});

const taskPanePos = computed(() => {
  if (piniaResize().windowWidth < 769) {
    return {
      bottom: piniaResize().INSERTPANE_WIDTH + "px",
      height: `${piniaResize().TASKPANE_WIDTH}px`,
      width: "100vw",
    };
  } else {
    return {
      right: piniaResize().INSERTPANE_WIDTH + "px",
      width: `${piniaResize().TASKPANE_WIDTH}px`,
    };
  }
});

function isShapePanels() {
  return  [
        "shapefill",
        "pictureoptions",
        "lineformat",
        "shapeoptions",
        "shapefx",
      ].includes(piniaInfo().currentTaskPane);
}
</script>

<style module>
.designerouter {
  position: absolute;
  background-color: rgba(124, 124, 124, 0.9);
  box-shadow: 0 1px 1px 1px rgba(124, 124, 124, 0.3);
  user-select: none;
  z-index: 2;
  right: 0;
  outline: none;
}

.taskPane {
  position: absolute;
  height: calc(100% - 0px);
  background: #f8f8f8;
  /* border: 1px solid #ccc; */
}

.insertPanel {
  position: absolute;
  z-index: 1;
  width: 100%;
  height: 100%;
  overflow-y: hidden;
  overflow-x: hidden;
}

.menu {
  position: absolute;
  right: 0;
  top: 4px;
  z-index: 10;
}
.slide-leave-active,
.slide-enter-active {
  transition: 1s;
}
.slide-enter {
  transform: translate(100%, 0);
}
.slide-leave-to {
  transform: translate(-100%, 0);
}

.slideback-leave-active,
.slideback-enter-active {
  transition: 1s;
}
.slideback-enter {
  transform: translate(-100%, 0);
}
.slideback-leave-to {
  transform: translate(100%, 0);
}
</style>
