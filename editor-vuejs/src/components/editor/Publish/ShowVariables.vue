<template>
  <NModal
    v-model:show="show"
    :mask-closable="true"
    preset="dialog"
    :title="`Show Variables`"
    :closable="true"
    :style="{
      cursor: !disabled ? 'auto' : 'wait',
      width: '50vw',
      minWidth: '360px',
      height: '60vh',
    }"
    class="show-vars-modal"
    @close="piniaInfo().openShowVarsModal = null"
  >
    <template #icon>
      <NIcon><BracesVariable24Filled /></NIcon>
    </template>
    <div ref="tree"></div>
    <!-- <n-tree block-line :data="vars" expand-on-click /> -->
  </NModal>
</template>
<script setup lang="ts">
import { piniaInfo } from "@/lib/common/store";

import { NModal, NIcon } from "naive-ui";
import { BracesVariable24Filled } from "@vicons/fluent";
import { ref, watch, nextTick } from "vue";
import jsonview from "@pgrabovets/json-view";

const props = defineProps({
  disabled: Boolean,
});

// const vars = ref();

const show = ref(false);
const tree = ref();
watch(
  () => piniaInfo().openShowVarsModal,
  () => {
    if (piniaInfo().openShowVarsModal) {
      // vars.value = mapToTree(piniaInfo().openShowVarsModal);
      nextTick(() => {
        const view = jsonview.renderJSON(
          piniaInfo().openShowVarsModal,
          tree.value,
        );
        jsonview.traverse(view, node => {
          console.log(node)
          if (node.depth == 0) {
            jsonview.toggleNode(node);
          }
        });
      });

      // console.log(vars.value);
      // Object.keys(props.vars).forEach(vr => {
      //   let children = [];
      //   if (typeof props.vars[vr] == "string") {
      //     children.push (props.vars[vr])
      //   } else if (props.vars[vr].constructor == Array) {
      //     children = props.vars[vr].map(itm )
      //   }
      //   data.children.push({
      //     label: vr,
      //     children
      //   })
      // })
      show.value = true;
    }
  },
);
</script>
<style scoped></style>

<style>
.show-vars-modal .n-dialog__content {
  height: calc(100% - 30px);
  overflow-y: auto;
  overflow-x: hidden;
}
</style>
