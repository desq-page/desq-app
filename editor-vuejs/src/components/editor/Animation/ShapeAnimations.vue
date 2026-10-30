<template>
  <!-- <SelectionToolbar /> -->
  <DialogBase title="Animations" bottom-border>
    <div class="toolbar">
      <ToolbarItem
        quaternary
        :icon="StarAdd16Regular"
        label="Add Animation..."
        :onClick="addAnimations"
        :disabled="piniaSelect().selShps.length == 0"
        :color="g.themeOverrides?.common?.primaryColor"
      />
      <div
        class="sub-toolbar"
        v-if="getSlideInfo().timing && selectedIdx >= 0"
      >
        <ToolbarItem quaternary :icon="ArrowSortUp24Filled" @click="moveUp" tooltip="Move Up"/>
        <ToolbarItem
          quaternary
          :icon="ArrowSortDown24Filled"
          @click="moveDown"
          tooltip="Move Down"
        />
        <ToolbarItem
          quaternary
          :icon="ClearOutlined"
          color="#FF0000"
          @click="deleteEff"
          tooltip="Delete Animation"
        />
      </div>
    </div>
    <div class="eff-cont">
      <table class="eff-table" v-if="animGrps">
        <template v-for="(animGrp, grpIdx) in animGrps" :key="grpIdx">
          <tr
            v-if="animGrp?.[0]"
            class="tr-header"
            @click="selectTrs(animGrp?.[0]?.eff?.trs)"
          >
            <td
              colspan="5"
              :style="{
                paddingLeft: '7px',
                background: '#eaeaea',
                textAlign:'center',
              }"
              @click="() => changeGrp(grpIdx)"
            >
              <span v-if="animGrp?.[0]?.trigger">
                CLICK:&nbsp;
                <span
                  :class="{
                    'hilite-trigger':
                      animGrp?.[0]?.eff?.trs == piniaSelect().selShpFormat?.id,
                  }"
                  >{{ animGrp?.[0]?.trigger }}</span
                >
              </span>
              <span v-if="animGrp?.[0]?.varName">
                WAIT FOR:&nbsp;
                <input
                  :value="animGrp?.[0]?.varName.replace('var:', '')"
                  @change="updateCondition"
                  required
                />
              </span>
              <span v-if="!animGrp?.[0]?.trigger && !animGrp?.[0]?.varName"
                >MAIN ANIMATIONS</span
              >
            </td>
          </tr>
          <tr
            class="eff-row"
            :class="{
              selected: selectedEffects.has(`${grpIdx}:${idx}`) || (selectedEffects.size === 0 && selectedIdx == idx && grpIdx == selectedGrp),
              'motion-selected': piniaSelect().selShpFormat?.motionSh &&
                piniaSelect().selShpFormat?.motionGrp === grpIdx &&
                piniaSelect().selShpFormat?.motionEff === idx,
              hilite:
                piniaSelect().selShps.includes(row.shpId) ||
                piniaSelect().selGrpShps.includes(row.shpId),
            }"
            v-for="(row, idx) in animGrp"
            :key="idx"
            @click="selectEff(row.shpId, idx, grpIdx, $event)"
            draggable="true"
            @dragstart="(e) => dragAnimStart(e, idx, grpIdx)"
            @dragover="dragAnimOver"
            @dragleave="dragAnimLeave"
            @dragend="dragAnimEnd"
            @drop="(e) => dragAnimDrop(e, idx, grpIdx)"
          >
            <td
              class="start"
              :style="{
                width: '28px',
                fontWeight: 'normal',
              }"
            >
              <NTooltip>
                <template #trigger>
                  {{ row.seq }}
                </template>
                Sequence
              </NTooltip>
            </td>
            <td
              :style="{
                width: '28px',
              }"
            >
              <ToolbarItem
                quaternary
                :icon="
                  row.eff.tr == 1
                    ? MousePointer
                    : row.eff.tr == 3
                      ? Clock
                      : Equals
                "
                :size="16"
                buttonSize="tiny"
                :tooltip="
                  row.eff.tr == 1
                    ? 'On click'
                    : row.eff.tr == 3
                      ? 'After previous'
                      : 'With previous'
                "
                :style="{
                  cursor: 'default',
                }"
              />
            </td>
            <td
              :style="{
                width: '28px',
              }"
            >
              <ToolbarItem
                quaternary
                :icon="
                  row.type == 1
                    ? StarArrowRightStart24Regular
                    : row.type == 2
                      ? StarEmphasis24Regular
                      : row.type == 3
                        ? StarArrowRightEnd24Regular
                        : row.type == 4
                          ? StarEdit24Regular
                          : row.type == 5
                            ? PlayCircle24Regular
                            : undefined
                "
                :size="20"
                buttonSize="tiny"
                :color="
                  row.type == 1
                    ? 'green'
                    : row.type == 2
                      ? '#FFA500'
                      : row.type == 3
                        ? 'red'
                        : row.type == 4
                          ? 'purple'
                          : row.type == 5
                            ? 'blue'
                            : ''
                "
                :tooltip="getEffName(row)"
                :style="{
                  cursor: 'default',
                }"
              />
            </td>
            <td style="max-width: 240px">
              <div class="anim-name">
                {{ row.shape }}
              </div>
            </td>
            <td>
              <ToolbarItem
                quaternary
                :icon="Link"
                v-if="row.type == 5"
                :onClick="() => toggleTaskPane('hyperlink')"
              />
            </td>
          </tr>
        </template>
      </table>
    </div>

    <AnimationInfo
      :disabled="selectedIdx < 0"
      :effData="animGrps?.[selectedGrp]?.[selectedIdx]"
      :selectedGrp="selectedGrp"
      :updateEff="updateEff"
      :updateParagraphs="updateParagraphs"
      :updateSmartArt="updateSmartArt"
      :varList="
        getSlideInfo().timing?.i?.reduce((varList, iAnim) => {
          if (iAnim.ef?.[0]?.trs?.startsWith('var:'))
            varList.push(iAnim.ef[0].trs.replace('var:', ''));
          return varList;
        }, [])
      "
    />
  </DialogBase>
</template>
<script setup lang="ts">
import { updateSlideAnimations, getSelectOriginShpBeforeEditingPoint, getSelectSelShpFormat, getSelectSelShps, getSlideInfo, on, off } from "shared-vuejs/editor";

import DialogBase from "@/components/common/Layouts/DialogBase.vue";
import {
  ArrowSortDown24Filled,
  ArrowSortUp24Filled,
  PlayCircle24Regular,
  StarAdd16Regular,
  StarArrowRightEnd24Regular,
  StarArrowRightStart24Regular,
  StarEdit24Regular,
  StarEmphasis24Regular,
} from "@vicons/fluent";
import { piniaSelect, piniaSlides } from "@/lib/common/store";
import { nextTick, onMounted, onUnmounted, ref, shallowRef, toRaw } from "vue";
// import { h } from "vue";
import { Clock, Equals, MousePointer } from "@vicons/fa";
import ToolbarItem from "../Toolbars/ToolbarItem.vue";
import { ClearOutlined } from "@vicons/material";
import { watch } from "vue";
import { toggleTaskPane } from "@/lib/main/utils";
import { addHandle, deselectAll } from "shared-vuejs/api/handle";
import { saveDexie } from "shared-vuejs/api/dbutils";
import defAnimList from "./arrAnimList";
import AnimationInfo from "./AnimationInfo.vue";
import { NTooltip } from "naive-ui";
import {
  buildMotionShapes,
  effectTimingPatch,
  cleanupAnim,
  genAnimGrps,
  getEffIdx,
  getEffLstRef,
  setParagraphAnimation,
  setSmartArtAnimation,
} from "shared-vuejs/api/animUtils";
import { Link } from "@vicons/tabler";
import { animationTabbarItems } from "./animationTabbar";
import g from "shared-vuejs/api/global";


const selectedIdx = ref(-1);
const selectedGrp = ref(0);
const selectedEffects = ref(new Set<string>());
let selectionAnchor = -1;

watch(
  () => piniaSlides().slideId,
  () => {
    selectedIdx.value = -1;
    selectedGrp.value = 0;
    selectedEffects.value.clear();
    selectionAnchor = -1;
    setTimeout(refreshAnim, 50);
  },
);

watch(
  () => piniaSelect().selShpFormat,
  () => {
    shapeSelected();
  },
);

const animGrps = ref(null as any);

// watch(
//   () => piniaShapes().shapesAnim,
//   () => {
//     animGrps.value = genAnimGrps();
//   },
// );

onMounted(() => {
  on("animationsChanged", refreshAnim);
  refreshAnim();
});

onUnmounted(() => {
  off("animationsChanged", refreshAnim);
  buildMotionShapes(false);
});

function refreshAnim() {
  buildMotionShapes(true);
  animGrps.value = genAnimGrps();
  shapeSelected();
}

let dragAnim: { idx: number; grpIdx: number } | undefined;

function dragAnimStart(e: DragEvent, idx: number, grpIdx: number) {
  if (!e.dataTransfer) return;
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", `${grpIdx}:${idx}`);
  dragAnim = { idx, grpIdx };
}

function isDropAfter(e: DragEvent) {
  const row = e.currentTarget as HTMLElement;
  const bounds = row.getBoundingClientRect();
  return e.clientY >= bounds.top + bounds.height / 2;
}

function dragAnimOver(e: DragEvent) {
  if (!dragAnim) return;
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
  const row = e.currentTarget as HTMLElement;
  row.classList.toggle("drag-before", !isDropAfter(e));
  row.classList.toggle("drag-after", isDropAfter(e));
}

function dragAnimLeave(e: DragEvent) {
  const row = e.currentTarget as HTMLElement;
  if (e.relatedTarget instanceof Node && row.contains(e.relatedTarget)) return;
  row.classList.remove("drag-before", "drag-after");
}

function dragAnimEnd() {
  document.querySelectorAll(".eff-row.drag-before, .eff-row.drag-after")
    .forEach((row) => row.classList.remove("drag-before", "drag-after"));
  dragAnim = undefined;
}

function dragAnimDrop(e: DragEvent, idx: number, grpIdx: number) {
  if (!dragAnim) return;
  e.preventDefault();
  const source = dragAnim;
  const insertionIdx = idx + (isDropAfter(e) ? 1 : 0);
  dragAnimEnd();
  moveEffGrp(source.grpIdx, source.idx, grpIdx, insertionIdx);
}

function shapeSelected() {
  const selectedShape = getSelectSelShpFormat();
  if (selectedShape?.motionSh) {
    selectedIdx.value = selectedShape.motionEff;
    selectedGrp.value = selectedShape.motionGrp;
    selectedEffects.value = new Set([`${selectedGrp.value}:${selectedIdx.value}`]);
    selectionAnchor = selectedIdx.value;
  } else if (
    animGrps.value?.[selectedGrp.value]?.[selectedIdx.value]?.shpId !==
      selectedShape?.id ||
    selectedIdx.value < 0
  ) {
    const effIdx = getEffIdx(animGrps.value);
    if (effIdx) {
      selectedIdx.value = effIdx[1];
      selectedGrp.value = effIdx[0];
    } else {
      selectedIdx.value = -1;
    }
  } else {
    // selectedIdx.value = -1;
  }
}

function getEffName(row) {
  const list = defAnimList[row.type - 1];
  return list?.[row.eff?.presetID]?.l;
}

function selectTrs(shpId) {
  addHandle(shpId, {
    exclusive: true,
  });
}

function selectEff(shpId, rowIdx, grpIdx, event) {
  if (grpIdx === 0 && (event?.shiftKey || event?.ctrlKey || event?.metaKey)) {
    const next = new Set(event.shiftKey ? [] : selectedEffects.value);
    if (event.shiftKey && selectionAnchor >= 0) {
      const start = Math.min(selectionAnchor, rowIdx);
      const end = Math.max(selectionAnchor, rowIdx);
      for (let idx = start; idx <= end; idx++) next.add(`0:${idx}`);
    } else {
      const key = `0:${rowIdx}`;
      if (next.has(key)) next.delete(key);
      else next.add(key);
      selectionAnchor = rowIdx;
    }
    selectedEffects.value = next;
    const focusKey = next.has(`0:${rowIdx}`) ? rowIdx : Number(next.values().next().value?.split(':')[1]);
    selectedIdx.value = next.size ? focusKey : -1;
    selectedGrp.value = 0;
    selectEffectTargets(next);
    return;
  }

  selectedEffects.value = new Set([`${grpIdx}:${rowIdx}`]);
  selectionAnchor = rowIdx;
  selectedIdx.value = rowIdx;
  selectedGrp.value = grpIdx;
  const eff = animGrps.value?.[selectedGrp.value]?.[selectedIdx.value]?.eff;
  if (eff?.bh?.some(bh => bh.ty === "motion" && Array.isArray(bh.cm))) {
    addHandle(
      "motionSh-" + shpId + ":" + selectedGrp.value + ":" + selectedIdx.value,
      {
        exclusive: true,
      },
    );
  } else {
    addHandle(shpId, {
      exclusive: true,
    });
  }
}

function selectEffectTargets(effects) {
  const shapeIds = new Set<string>();
  for (const key of effects) {
    const [grpIdx, rowIdx] = key.split(':').map(Number);
    const row = animGrps.value?.[grpIdx]?.[rowIdx];
    if (row?.shpId) shapeIds.add(row.shpId);
  }

  deselectAll();
  for (const shpId of shapeIds) {
    addHandle(shpId, { focusCanvas: false });
  }
}

function changeGrp(grpIdx) {
  selectedGrp.value = grpIdx;
  selectedIdx.value = 0;
}

function updateCondition(e) {
  if (e.target.value) {
    if (selectedIdx.value == -1) {
      selectedIdx.value = 0;
    }
    const selectedEff =
      animGrps.value?.[selectedGrp.value]?.[selectedIdx.value];
    const newTrs = "var:" + e.target.value;
    if (selectedEff && selectedEff.trs !== newTrs) {
      selectedEff.trs = newTrs;
      animGrps.value?.[selectedGrp.value].forEach((grpItem) => {
        grpItem.varName = newTrs;
        grpItem.eff.trs = newTrs;
      });
      updateEff({
        trs: newTrs,
      });
    }
  } else {
    e.target.value = e.target.defaultValue;
  }
}

function updateParagraphs(enabled) {
  updateAnimationBuild((list, effects) => setParagraphAnimation(list, effects, enabled));
}

function updateSmartArt(mode) {
  updateAnimationBuild((list, effects) => setSmartArtAnimation(list, effects, mode));
}

function updateAnimationBuild(build) {
  const timing = getSlideInfo().timing;
  if (!timing) return;
  const keys = selectedEffects.value.size
    ? [...selectedEffects.value] : [`${selectedGrp.value}:${selectedIdx.value}`];
  const targets = new Map<number, any[]>();
  for (const key of keys) {
    const [grpIdx, rowIdx] = key.split(":").map(Number);
    const effect = animGrps.value?.[grpIdx]?.[rowIdx]?.eff;
    if (!effect) continue;
    const list = grpIdx === 0 ? timing.m : timing.i?.[grpIdx - 1]?.ef;
    const raw = list?.find(item => toRaw(item) === toRaw(effect));
    if (!raw) continue;
    if (!targets.has(grpIdx)) targets.set(grpIdx, []);
    targets.get(grpIdx)!.push(raw);
  }
  const retained = new Set();
  for (const [grpIdx, effects] of targets) {
    const list = grpIdx === 0 ? timing.m : timing.i?.[grpIdx - 1]?.ef;
    if (!list) continue;
    for (const effect of build(list, effects)) retained.add(effect);
  }
  updateSlideAnimations(timing);
  cleanupAnim();
  saveDexie();
  animGrps.value = genAnimGrps();
  const selection = new Set<string>();
  animGrps.value?.forEach((group, grpIdx) => group.forEach((row, rowIdx) => {
    if (retained.has(toRaw(row.eff))) selection.add(`${grpIdx}:${rowIdx}`);
  }));
  selectedEffects.value = selection;
  const focus = selection.values().next().value;
  if (focus) {
    [selectedGrp.value, selectedIdx.value] = focus.split(":").map(Number);
    selectionAnchor = selectedIdx.value;
  } else {
    selectedIdx.value = -1;
  }
}

function updateEff(eff) {
  const shapesAnim = (getSlideInfo().timing);
  const m = shapesAnim?.m || [];
  const i = shapesAnim?.i || [];

  if (selectedEffects.value.size > 1) {
    const selectedKeys = [...selectedEffects.value];
    const selected = selectedKeys.map((key) => {
      const [grpIdx, rowIdx] = key.split(':').map(Number);
      const row = animGrps.value?.[grpIdx]?.[rowIdx];
      const list = row && getEffLstRef(row.trigger, grpIdx);
      return row && list ? { row, list, raw: list[rowIdx] } : null;
    }).filter((item) => item?.raw);

    for (const item of selected) {
      const { list, raw } = item;
      const patch = typeof eff === "function" ? eff(raw) : eff;
      if (!patch) continue;
      const ownPatch = JSON.parse(JSON.stringify(patch));
      if (ownPatch.trs !== undefined && ownPatch.trs !== raw.trs) {
        const rawIdx = list.indexOf(raw);
        raw.trs = ownPatch.trs;
        list.splice(rawIdx, 1);

        let destination;
        if (ownPatch.trs) {
          destination = i.find((iAnim) => iAnim.ef?.[0]?.trs === ownPatch.trs);
          if (!destination) {
            destination = { ef: [] };
            i.push(destination);
          }
          destination.ef.push(raw);
        } else {
          destination = m;
          destination.push(raw);
        }
      } else {
        Object.assign(raw, effectTimingPatch(raw, ownPatch));
      }
    }

    updateSlideAnimations({ m, i });
    cleanupAnim();
    saveDexie();
    refreshAnim();
    const retained = new Set(
      eff?.trs === undefined
        ? selectedKeys
        : selected.flatMap((item) => {
            for (let grpIdx = 0; grpIdx < (animGrps.value?.length || 0); grpIdx++) {
              const rowIdx = animGrps.value[grpIdx].findIndex((row) => row.eff === item.raw);
              if (rowIdx >= 0) return [`${grpIdx}:${rowIdx}`];
            }
            return [];
          }),
    );
    selectedEffects.value = retained;
    const focusKey = retained.values().next().value;
    if (focusKey) {
      const [grpIdx, rowIdx] = focusKey.split(':').map(Number);
      selectedGrp.value = grpIdx;
      selectedIdx.value = rowIdx;
    } else {
      selectedIdx.value = -1;
    }
    return;
  }

  if (selectedIdx.value == -1) {
    selectedIdx.value = 0;
  }

  const selectedEff = animGrps.value?.[selectedGrp.value]?.[selectedIdx.value];

  const effLstRef = getEffLstRef(selectedEff.trigger, selectedGrp.value);

  const targetEff: any = effLstRef[selectedIdx.value];
  eff = typeof eff === "function" ? eff(targetEff) : eff;
  if (!eff) return;
  eff = JSON.parse(JSON.stringify(eff));

  if (eff?.trs !== undefined && eff?.trs !== targetEff?.trs) {
    let newGrp;
    if (eff.trs) {
      newGrp = i.find((iAnim) => iAnim.ef?.[0]?.trs == eff.trs);
      if (!newGrp) {
        newGrp = { ef: [] };
        i.push(newGrp);
      }
    } else {
      newGrp = m;
    }

    // remove from current group
    targetEff.trs = eff.trs;
    if (selectedGrp.value == 0) {
      //main
      m.splice(selectedIdx.value, 1);
    } else {
      i[selectedGrp.value - 1].ef.splice(selectedIdx.value, 1);
    }
    if (eff.trs) {
      newGrp.ef.push(targetEff);
      selectedGrp.value =
        shapesAnim?.i?.findIndex((iAnim) => iAnim.ef?.[0]?.trs == eff.trs) + 1;
    } else {
      //main
      newGrp.push(targetEff);
      selectedGrp.value = 0;
    }
    const shpId = getSelectSelShpFormat()?.id;
    if (shpId?.startsWith("motionSh-")) {
      deselectAll();
    }
  } else {
    effLstRef[selectedIdx.value] = {
      ...effLstRef[selectedIdx.value],
      ...effectTimingPatch(targetEff, eff),
    };
  }

  updateSlideAnimations({
    m,
    i,
  });

  cleanupAnim();

  saveDexie();

  refreshAnim();
}

function deleteEff() {
  if (selectedGrp.value === 0 && selectedEffects.value.size > 1) {
    const shapesAnim = getSlideInfo().timing;
    const m = shapesAnim?.m || [];
    const i = shapesAnim?.i || [];
    const indices = [...selectedEffects.value]
      .map(key => Number(key.split(':')[1]))
      .sort((a, b) => b - a);
    for (const idx of indices) m.splice(idx, 1);
    updateSlideAnimations({ m, i });
    buildMotionShapes();
    saveDexie();
    selectedEffects.value.clear();
    refreshAnim();
    return;
  }
  const shapesAnim = (getSlideInfo().timing);
  const m = shapesAnim?.m || [];
  const i = shapesAnim?.i || [];
  if (selectedGrp.value == 0) {
    m.splice(selectedIdx.value, 1);
  } else {
    const iAnim = i[selectedGrp.value - 1];
    iAnim?.ef?.splice(selectedIdx.value, 1);
  }

  updateSlideAnimations({
    m,
    i,
  });

  buildMotionShapes();

  saveDexie();

  refreshAnim();
}

function moveUp() {
  if (selectedGrp.value === 0 && selectedEffects.value.size > 1) {
    moveSelectedMain(-1);
    return;
  }
  if (selectedIdx.value > 0) {
    moveEff(-1);
    saveDexie();
  refreshAnim();
  }
}

function moveDown() {
  if (selectedGrp.value === 0 && selectedEffects.value.size > 1) {
    moveSelectedMain(1);
    return;
  }
  if (selectedIdx.value < animGrps.value?.[selectedGrp.value].length - 1) {
    moveEff(1);
    saveDexie();
  refreshAnim();
  }
}

function moveSelectedMain(direction) {
  const timing = getSlideInfo().timing;
  const effects = timing?.m || [];
  const indices = [...selectedEffects.value]
    .map(key => Number(key.split(':')[1]))
    .sort((a, b) => a - b);
  if (!indices.length) return;

  const selected = new Set(indices);
  if (direction < 0) {
    for (let idx = 1; idx < effects.length; idx++) {
      if (selected.has(idx) && !selected.has(idx - 1)) {
        [effects[idx - 1], effects[idx]] = [effects[idx], effects[idx - 1]];
        selected.delete(idx);
        selected.add(idx - 1);
      }
    }
  } else {
    for (let idx = effects.length - 2; idx >= 0; idx--) {
      if (selected.has(idx) && !selected.has(idx + 1)) {
        [effects[idx], effects[idx + 1]] = [effects[idx + 1], effects[idx]];
        selected.delete(idx);
        selected.add(idx + 1);
      }
    }
  }
  selectedEffects.value = new Set([...selected].map(idx => `0:${idx}`));
  selectedIdx.value = direction < 0 ? Math.max(0, indices[0] - 1) : Math.min(effects.length - 1, indices[indices.length - 1] + 1);
  updateSlideAnimations({ m: effects, i: timing?.i || [] });
  saveDexie();
  refreshAnim();
  selectedEffects.value = new Set([...selected].map(idx => `0:${idx}`));
}

function moveEff(step) {
  const shapesAnim = (getSlideInfo().timing);
  const m = shapesAnim?.m || [];
  const i = shapesAnim?.i || [];
  let selectedEff;
  // move current effect to top
  if (selectedGrp.value == 0) {
    selectedEff = m.splice(selectedIdx.value, 1)[0];
    m.splice(selectedIdx.value + step, 0, selectedEff);
  } else {
    selectedEff = i[selectedGrp.value - 1].ef.splice(selectedIdx.value, 1)[0];
    i[selectedGrp.value - 1].ef.splice(
      selectedIdx.value + step,
      0,
      selectedEff,
    );
  }
  selectedIdx.value = selectedIdx.value + step;
  updateSlideAnimations({
    m,
    i,
  });
}

function moveEffGrp(oldGrp, oldIdx, newGrp, newIdx) {
  const shapesAnim = getSlideInfo().timing;
  const m = shapesAnim?.m || [];
  const i = shapesAnim?.i || [];

  const oldAnimGrp = oldGrp === 0 ? m : i[oldGrp - 1]?.ef;
  const newAnimGrp = newGrp === 0 ? m : i[newGrp - 1]?.ef;
  if (!oldAnimGrp?.[oldIdx] || !newAnimGrp) return;

  const insertionIdx = newIdx - (oldGrp === newGrp && oldIdx < newIdx ? 1 : 0);
  if (oldGrp === newGrp && insertionIdx === oldIdx) return;
  const trigger = newAnimGrp[0]?.trs;
  const selectedEff = oldAnimGrp.splice(oldIdx, 1)[0];
  if (newGrp === 0) delete selectedEff.trs;
  else selectedEff.trs = trigger;
  newAnimGrp.splice(insertionIdx, 0, selectedEff);

  selectedIdx.value = insertionIdx;
  selectedGrp.value = newGrp;
  selectedEffects.value = new Set([`${newGrp}:${insertionIdx}`]);
  selectionAnchor = insertionIdx;
  updateSlideAnimations({
    m,
    i,
  });
  saveDexie();
  refreshAnim();
}

function addAnimations() {
  if ([...getSelectSelShps()][0].startsWith("motionSh-")) {
    addHandle(getSelectOriginShpBeforeEditingPoint()?.motionSh, {
      exclusive: true,
    });
  }
  nextTick(() => {
    toggleTaskPane("addanimation");
  });
}
</script>
<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  position: sticky;
  top: 0px;
  background: rgb(248, 248, 248);
  margin: 0px -10px;
  padding: 5px 0;
  width: 100%;
  z-index: 10;
}

.sub-toolbar {
  display: flex;
  justify-content: space-between;
}

.eff-cont {
  overflow-y: auto;
  overflow-x: hidden;
  height: calc(100% - 265px);
  width: calc(100% + 40px);
  margin-left: -20px;
}

tr {
  height: 20px;
}

.tr-header {
  /* position: sticky;
  top: 0;
  z-index: 2; */
  cursor: pointer;
}

td {
  font-size: 14px;
  height: 20px;
}

td.start {
  padding: 0 10px;
  text-align: center;
}

.eff-table {
  border-collapse: collapse;
  margin-top: 5px;
  width: 100%;
}

.eff-row {
  height: 26px;
}

.eff-row.hilite {
  color: #7f0707;
  font-weight: bold;
}

.eff-row.motion-selected,
.eff-row.motion-selected:hover {
  background-color: #b1d3ff;
  color: #173d77;
  font-weight: bold;
}

.eff-row.hilite {
  background-color: #e1ecff;
}

.eff-row:hover {
  background-color: #ececec;
}

.eff-row.hilite:hover {
  background-color: #c8dcff;
}

.anim-name {
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 90%;
  white-space: nowrap;
  font-size: 14px;
}
</style>
<style>
.hilite-trigger {
  color: #7f0707;
  font-weight: bold;
}

.drag-before {
  border-top: 1px solid red;
}

.drag-after {
  border-bottom: 1px solid red;
}
</style>
