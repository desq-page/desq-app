<script setup>
// import EditorView from "./views/EditorView.vue";
// import HomeView from "./views/HomeView.vue";
import { NConfigProvider, NDialogProvider } from "naive-ui";
// import { RouterView } from "vue-router";
import g from "shared-vuejs/api/global";
// used for drag in thumbtable, drag media and shapes to slides
import "shared-vuejs/api/DragDropTouch";

// window.addEventListener("DOMContentLoaded", () => {
//   if ("serviceWorker" in navigator) {
//     navigator.serviceWorker.ready.then(() => {
//       console.log("sw ready");
//     });

//     navigator.serviceWorker.register("/sw.js", { scope: "./" }).then(() => {
//       console.log("sw registered");
//     });
//   }
// });
</script>

<template>
  <NDialogProvider>
    <NConfigProvider :theme-overrides="g.themeOverrides" abstract>
      <RouterView v-slot="{ Component, route }">
        <Transition name="page">
          <div :data-name="route.name" :key="route.name" :id="route.id">
            <component :is="Component"></component>
          </div>
        </Transition>
      </RouterView>
      <!-- <RouterView /> -->
    </NConfigProvider>
  </NDialogProvider>
</template>
<style>
.page-enter-from {
  opacity: 0;
}
.page-enter-active {
  transition: opacity 1s ease;
}
.page-enter-to {
  opacity: 1;
}
</style>
