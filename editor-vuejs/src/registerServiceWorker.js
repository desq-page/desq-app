/* eslint-disable no-console */

const hooks = {
  ready() {
    console.log("App is being served from cache by a service worker.\n");
  },
  registered() {
    console.log("Service worker has been registered.");
  },
  cached() {
    console.log("Content has been cached for offline use.");
  },
  updatefound() {
    console.log("New content is downloading.");
  },
  updated(registration) {
    console.log("New content is available; please refresh.");
    // const confirmationResult = confirm(
    //   "New content found! Do you want to reload the app?",
    // );
    // if (confirmationResult)
    registration.waiting?.postMessage({ action: "skipWaiting" });
  },
  offline() {
    console.log(
      "No internet connection found. App is running in offline mode.",
    );
  },
  error(error) {
    console.error("Error during service worker registration:", error);
  },
  message(message) {
    console.log(message);
  },
};

function handleError(error) {
  if (!navigator.onLine) hooks.offline();
  hooks.error(error);
}

async function registerWorker() {
  try {
    const registration = await navigator.serviceWorker.register(
      "/service-worker.js",
      { type: "module", scope: "/" },
    );
    hooks.registered();
    if (registration.waiting) hooks.updated(registration);

    const observeInstallingWorker = () => {
      const worker = registration.installing;
      if (!worker) return;
      hooks.updatefound();
      worker.addEventListener("statechange", () => {
        if (worker.state !== "installed") return;
        if (navigator.serviceWorker.controller) {
          hooks.updated(registration);
        } else {
          hooks.cached();
        }
      });
    };
    registration.addEventListener("updatefound", observeInstallingWorker);
    observeInstallingWorker();
    await navigator.serviceWorker.ready;
    hooks.ready();
  } catch (error) {
    handleError(error);
    throw error;
  }
}

export const serviceWorkerReady = "serviceWorker" in navigator ? (() => {
  let refreshing = false;
  let hadController = Boolean(navigator.serviceWorker.controller);
  let startupTimedOut = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController) {
      hadController = Boolean(navigator.serviceWorker.controller);
      if (!startupTimedOut) return;
    }
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  navigator.serviceWorker.addEventListener("message", hooks.message);

  // An active worker does not necessarily control this page yet. Wait for
  // claim() before mounting components that request OPFS-backed /res/ URLs.
  const controlled = new Promise((resolve) => {
    if (navigator.serviceWorker.controller) return resolve();
    const onChange = () => {
      if (!navigator.serviceWorker.controller) return;
      navigator.serviceWorker.removeEventListener("controllerchange", onChange);
      resolve();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onChange);
  });
  return Promise.race([
    registerWorker().then(() => controlled).catch(() => {}),
    new Promise((resolve) => setTimeout(() => { startupTimedOut = true; resolve(); }, 10000)),
  ]);
})() : Promise.resolve();
