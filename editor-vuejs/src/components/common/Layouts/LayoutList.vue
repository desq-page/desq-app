<template>
  <div id="slideLayoutLists">
    <div
      :id="`SGT_layoutdialog_${layout.layoutid}`"
      class="sgLayoutDialogLayout sgLayoutDialogLayoutActive"
      v-for="layout in slideLayouts"
      :key="layout.layoutid"
    >
      Blank
      <canvas
        width="200"
        height="200"
        style="width: 82px; height: 62px"
        @click="() => onClick(layout)"
      ></canvas>
    </div>
  </div>
</template>
<script setup>
// import { addBlankLayout } from "shared-vuejs/api/slide";
// import { insertSlideFunction } from "shared-vuejs/api/layout";

// const slideLayouts = computed(
//   () => piniaInfo().layouts.filter((l) => g.layoutObjs[l].parentid) // exclude masters
// );

function onClick(layout) {
  // insertSlideFunction(piniaSlides().slideIndex, { layoutid: layout.layoutid });
}

// if (!piniaSlides().slideInfo.layoutid) {
//   var blankLayout = addBlankLayout();
//   piniaSlides().slideInfo.layoutid =
//     blankLayout;
// }

// for (var i = 0; i < piniaInfo().layouts.length; i++) {
//   var layout = g.layoutObjs[piniaInfo().layouts[i]];
//   if (layout.parentid) {
//     layoutindex++;
//     //only for child layout
//     var align;

//     //html += '<div style="float:left;margin:5px;padding: 2px">'
//     var mylayout = new SGElement("div", {
//       id: "SGT_layoutdialog_" + layout.layoutid,
//       class: "sgLayoutDialogLayout",
//       html: layout.layoutname,
//     });

//     if (options.insertSlide) {
//       addClickEvent(mylayout, function (e) {
//         insertSlideFunction(piniaSlides().slideIndex, {
//           layoutid: layout.layoutid,
//         });
//       });
//     } else {
//       //html += '<div id="SGT_layoutdialog_' + layout.layoutid + '" class="sgLayoutDialogLayout" onclick="chooseLayoutItem(event,this)" ontouchend="chooseLayoutItem(event,this)">'+ layout.layoutname + '</div>'
//       addClickEvent(mylayout, function (e) {
//         chooseLayoutItem(e, mylayout);
//       });
//     }

//     layoutlist.appendChild(mylayout);

//     //html += '</div>'
//   }
// }
</script>
