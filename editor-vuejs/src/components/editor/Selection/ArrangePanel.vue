<template>
  <DialogBase
    title="Layers"
    :no-padding="true"
    :icon="Layers"
  >
    <div class="arrange-toolbar">
      <ToolbarItem
        quaternary
        v-for="item in selItems"
        :key="item.icon"
        :tooltip="item.tooltip"
        :icon="item.icon"
        :alt="item.alt"
        :onClick="item.onClick"
        :disabled="piniaSelect().selShps.length == 0 || item.disabled"
        :type="item.type"
        :color="item.color"
      />
    </div>

    <!-- <NTree :data="items" /> -->
    <div
      class="shape-item"
      :class="{
        'shape-selected': piniaSelect().selShps.includes(item.id),
        'shape-hidden': item.hidden,
      }"
      v-for="item in items"
      :key="item.id"
      @click="(e) => clickShape(e, item.id)"
    >
      <div class="">
        <span class="shape-name">
          <ToolbarItem quaternary :shp="item.shp" :size="20" />
          <NIcon v-if="item.locked">
            <LockFilled />
          </NIcon>
          <input
            class="nameinput"
            :value="item.name"
            v-if="piniaSelect().selShps.includes(item.id)"
            @change="(e) => updateName(e, item)"
            @click.stop="(e) => { if (e.shiftKey || e.ctrlKey || e.metaKey) clickShape(e, item.id); }"
          />
          <span v-if="!piniaSelect().selShps.includes(item.id)">{{ item.name }}</span>
        </span>
        <TransitionGroup>
          <div
            v-for="child in item.children?.slice()?.reverse()"
            :key="child.id"
            class="shape-child"
            :class="{
              selected: piniaSelect().selGrpShps.includes(child.id),
            }"
            @click="(e) => clickChildShape(e, child.id, item.id)"
          >
            <ToolbarItem :shp="child.shp" :size="20" />
            <span class="parentName" v-if="child.parentid"> ⇒ </span>
            <input
              class="nameinput"
              :value="child.name"
              v-if="piniaSelect().selGrpShps.includes(child.id)"
              @change="(e) => updateName(e, child)"
              @click.stop
            />
            <span class="namedisplay" v-else>{{ child.name }}</span>
          </div>
        </TransitionGroup>
      </div>
    </div>
  </DialogBase>
</template>
<script setup lang="ts">
import { getShapeDeep, getShapeInfo, updateShape, getHandlingHandlingInfo, getSlideInfo } from "shared-vuejs/editor";

import {
  piniaShapes,
  piniaHandling,
  piniaSelect,
  piniaInfo,
} from "@/lib/common/store";
import { watch, ref, onMounted, nextTick } from "vue";
import {
  bringForward,
  bringToFront,
  sendBackward,
  sendToBack,
} from "shared-vuejs/api/arrange";
import { lockSelectedShapes, deleteShape } from "shared-vuejs/api/shape";
import { addHandle, deselectAll, removeHandle } from "shared-vuejs/api/handle";
import ToolbarItem from "../Toolbars/ToolbarItem.vue";
import { InfoOutlined, LockFilled, LockOutlined } from "@vicons/material";
import {
  ArrowDown24Filled,
  ArrowDownload24Filled,
  ArrowUp24Filled,
  ArrowUpload24Filled,
  Delete20Regular,
} from "@vicons/fluent";
import { NIcon } from "naive-ui";
import { saveDexie } from "shared-vuejs/api/dbutils";
import DialogBase from "@/components/common/Layouts/DialogBase.vue";
import { toggleTaskPane } from "@/lib/main/utils";
import { Layers } from "@vicons/carbon";
import { selectLayer } from "./layerSelection.mjs";


const items: any = ref([]);
let selectionAnchor: string | undefined;

const selItems: any = [
  {
    icon: LockOutlined,
    tooltip: "Lock/Unlock",
    onClick: (e) => {
      lockSelectedShapes();
    },
  },
  // {
  //   icon: EyeOff,
  //   tooltip: "Hide",
  //   onClick: (e) => {
  //     hideSelectedShapes();
  //   },
  // },
  {
    type: "divider",
  },
  {
    icon: ArrowUpload24Filled,
    tooltip: "Bring To Front",
    onClick: (e) => {
      bringToFront();
    },
  },
  {
    icon: ArrowUp24Filled,
    tooltip: "Bring Forward",
    onClick: (e) => {
      bringForward();
    },
  },
  {
    icon: ArrowDown24Filled,
    tooltip: "Send Backward",
    onClick: (e) => {
      sendBackward();
    },
  },
  {
    icon: ArrowDownload24Filled,
    tooltip: "Send To Back",
    onClick: (e) => {
      sendToBack();
    },
  },
  {
    type: "divider",
  },
  {
    icon: InfoOutlined,
    tooltip: "Shape Info",
    onClick: (e) => {
      toggleTaskPane("shapeoptions");
    },
  },
  {
    icon: Delete20Regular,
    tooltip: "Delete Shape",
    color: "red",
    onClick: (e) => {
      deleteShape();
    },
    disabled: !!piniaInfo().useGrid,
  },
];

function genShpPath(shp) {
  if (shp.blipFill) return "R0,0,24,24";
  switch (shp.type) {
    case "group":
    case "smartart":
      return "M0,0L12,0LL12,12L24,12L24,24L12,24L12,12L0,12Z";
    case "table":
      return "M0,0L24,0L24,24L0,24L0,0M0,12L24,12M12,0L12,24";
    case "text":
      return "M0,0L24,0L24,4L14,4L14,24L10,24L10,4L0,4Z";
    case "ellipse":
      return "E0,0,24,24";
    case "line":
      return "M0,12L24,12";
    case "path":
      return "M0,0L24,0L24,24L0,24Z";
    default: {
      if (shp.txBody) {
        return "M0,0L24,0L24,4L14,4L14,24L10,24L10,4L0,4Z";
      } else {
        return "M0,0L24,0L24,24L0,24Z";
      }
    }
  }
}

// const deleteOptions = [
//   {
//     label: "Delete Shape?",
//     color: "red",
//     key: "delete",
//     onClick: deleteShape,
//   },
// ];

function updateName(e, item) {
  console.log(e);
  const name = e.target.value;
  if (name.length > 0) {
    const shp = getShapeDeep(item.id);
    shp.name = e.target.value;
    e.target.blur();
    updateShape(shp);
    saveDexie();
  }
}

function updateList() {
  // const sld = gid("sld");
  // if (sld && !observer) {
  var list = getSlideInfo().shapes.reduce((list, c) => {
    const name = c.name;
    if (name) {
      const shpInfo = getShapeInfo(c.id);
      list.push({
        id: c.id,
        name: c.name,
        label: c.name,
        key: c.id,
        // selected: piniaSelect().selShps.includes(c.id),
        locked: c.locked,
        hidden: c.hidden,
        shp: {
          ...shpInfo,
          type: "path",
          d: genShpPath(c),
          w: 24,
          h: 24,
          f: c.children?.[0] ? c.children[0].solidFill?.uniClr?.color : c.solidFill?.uniClr?.color,
          l: { color: "#000000" },
          v: null,
          id: "fillshp-" + c.id,
          objectFit: true, // only used for arrnage panbel
          children: null,
        },
        children: c.children ? mapGroupList({ ...c, name: "" }) : null,
      });
    }
    return list;
  }, []);

  items.value = list.reverse();
  // }
}

function mapGroupList(list) {
  const output = list.children?.reduce((output, item) => {
    if (item.children) {
      output = [...output, ...mapGroupList(item)];
    } else {
      const shpInfo = getShapeInfo(item.id);
      output = [
        ...output,
        {
          id: item.id,
          name: item.name,
          parent: list.name,
          label: item.name,
          key: item.id,
          shp: {
            ...shpInfo,
            d: genShpPath(item),
            type: "path",
            l: { color: "#000000" },
            w: 24,
            h: 24,
            v: null,
            id: "fillshp-c-" + item.id,
            objectFit: true, // only used for arrnage panbel
          },
        },
      ];
    }
    return output;
  }, []);

  return output;
}

onMounted(() => {
  updateList();
});

watch(() => piniaShapes().shapeKeys, () => {
  // check if new shape added
  if (!getHandlingHandlingInfo()) {
    updateList();
  }
});

watch(() => getSlideInfo()?.id, () => { selectionAnchor = undefined; });

function clickShape(e, id) {
  if (e.shiftKey || e.ctrlKey || e.metaKey) e.preventDefault();
  const current = [...piniaSelect().selShps];
  const next = selectLayer(items.value.map(item => item.id), current, selectionAnchor, id, e);
  selectionAnchor = next.anchor;
  if (!e.shiftKey && !e.ctrlKey && !e.metaKey) deselectAll();
  else for (const selectedId of current) if (!next.selected.includes(selectedId)) removeHandle(selectedId);
  for (const selectedId of next.selected) {
    if (!piniaSelect().selShps.includes(selectedId)) addHandle(selectedId, { focusCanvas: false });
  }
  shiftFocusToAvoidKeydown();
}

function clickChildShape(e, cid, shpid) {
  console.log(e);
  if (piniaSelect().selShps.includes(shpid)) {
    piniaSelect().selGrpShps = [];
    piniaSelect().selGrpShps.push(cid);
    console.log(piniaSelect().selGrpShps);
    e.stopPropagation();
    shiftFocusToAvoidKeydown();
  }
}

function shiftFocusToAvoidKeydown() {
  nextTick(() => {
    (document.querySelector("#taskPane") as any).parentNode.focus();
  });
}

// function handleKey(e) {
//   console.log(e);
//   e.preventDefault();
//   e.stopPropagation();
// }
</script>
<style scoped>
.arrange-toolbar {
  display: flex;
  padding: 5px 10px;
  background: white;
  border-bottom: 1px solid #ccc;
  position: sticky;
  top: 0;
  z-index: 10;
}
.shape-item {
  padding: 5px 20px 5px 5px;
  cursor: pointer;
  user-select: none;
}

/* .shape-item:hover {
  background: #efefef;
} */

.shape-selected {
  /* outline: 1px solid rgba(255, 0, 0, 0.6); */
  background: rgba(239, 164, 164, 0.5);
}

/* .shape-selected:hover {
  background: rgba(239, 164, 164, 0.8);
} */

.shape-hidden {
  opacity: 0.3;
}

.shape-name {
  color: black;
  pointer-events: none;
  display: flex;
  align-items: center;
  gap: 2px;
}

.namedisplay {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.shape-name input {
  pointer-events: all;
}

.shape-name button {
  pointer-events: none;
}

.shape-child {
  margin-left: 20px;
  padding: 5px 0;
  overflow: hidden;
  text-overflow: ellipsis;
  height: 20px;
  max-width: 80%;
  display: flex;
  align-items: center;
  pointer-events: all;
}

.shape-child.selected {
  font-weight: bold;
}

.parentName {
  font-size: 16px;
  color: #888;
  white-space: nowrap;
  max-width: 100px;
  margin-right: 10px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nameinput {
  background: white;
  border: none;
  width: 90%;
  margin-left: -2px;
  user-select: text;
}
</style>

<style>
.shape-name button {
  pointer-events: none !important;
}
</style>
