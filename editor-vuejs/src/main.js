import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
// import "shared-vuejs/api/config";
import router from "./router";
import vue3GoogleLogin from "vue3-google-login";

import "shared-vuejs/api/main.css";
import "../src/assets/editor.css";
// import "../src/assets/navi.css";
import "../src/assets/toolbar.css";
import "../src/assets/handle.css";
import "../src/assets/text.css";
import "../src/assets/table.css";

import "./registerServiceWorker";
import { setupDB } from "shared-vuejs/api/db";

const app = createApp(App);
const pinia = createPinia();

// pinia.use(resetStore);

app.use(pinia);

app.use(router);

const gclientInfo = {
  clientId:
    "275999195543-kebfjsb7rn5q0a2bn8uf5c76bt51ssus.apps.googleusercontent.com",
}; // or  gclientJson

app.use(vue3GoogleLogin, gclientInfo);

// if (ue.firefox && location.href.includes("localhost")) {
// firefox serviceworker can't still work with localhost
setupDB();
// setTimeout(connectWs, 100);
// Keep bootstrap's spinner in the DOM until the initial route and its
// lazy-loaded components are ready to render.
export const appReady = router.isReady().then(() => app.mount("body", true));
// } else {
//   register(`/service-worker.js?22012025`, {
//     registrationOptions: { type: "module", scope: "" },
//     ready: (registration) => {
//       console.log("Service worker is active.");
//       if (!navigator.serviceWorker.controller) {
//         console.log("failed");
//         // window.location.reload();
//       }
//       app.mount("body", true);
//     },
//     error: (err) => console.log(err),
//   });
// }

// export default function resetStore({ store }) {
//   // need this to use $reset in function setup
//   const initialState = structuredClone(store.$state);
//   store.$reset = () => store.$patch(structuredClone(initialState));
// }
