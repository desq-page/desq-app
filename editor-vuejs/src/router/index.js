import { createRouter, createWebHistory } from "vue-router";
import HomePage from "../pages/HomePage.vue";
import RawSSG from "../pages/RawSSG.vue";
import LoginView from "../pages/LoginView.vue";
import { logEditorOpen } from "../lib/editor-telemetry";

const Player = () => import("../Player.vue");
const EditorPage = () => import("../pages/EditorPage.vue");
const DashboardWorkspace = () => import("../pages/DashboardWorkspace.vue");
const TermsPage = () => import("../pages/TermsPage.vue");
const SupportPage = () => import("../pages/SupportPage.vue");

const router = createRouter({
    history: createWebHistory(),
    routes: [
      {
        path: "/player",
        name: "player",
        id: "container",
        component: Player,
      },
      // {
      //   path: "/home",
      //   name: "home",
      //   component: HomePage,
      //   meta: {
      //     transition: true,
      //   },
      // },
      {
        path: "/",
        name: "root",
        component: HomePage,
        props: {
          // rawFileName: "root",
        },
      },
      {
        path: "/dashboard",
        redirect: "/work",
      },
      {
        path: "/work",
        name: "work",
        component: DashboardWorkspace,
      },
      {
        path: "/about",
        name: "about",
        component: RawSSG,
        props: {
          // rawFileName: "about",
        },
      },
      {
        path: "/terms",
        name: "terms",
        component: TermsPage,
      },
      {
        path: "/support",
        name: "support",
        component: SupportPage,
      },
      {
        path: "/login",
        name: "login",
        component: LoginView,
      },
      {
        path: "/edit2/:id",
        name: "edit2",
        component: () => import("../pages/VanEditorPage.vue"),
      },
      {
        path: "/edit/:id",
        name: "edit",
        component: EditorPage,
        // beforeEnter: async (to, from) => {

        // },
      },
    ],
  });
router.afterEach((to, from, failure) => {
  if (!failure && typeof document !== "undefined") {
    const publicRoutes = new Set(["root", "work", "about", "terms", "support", "player"]);
    const noindexRoutes = new Set(["login", "edit", "edit2"]);
    const routeName = String(to.name || "");
    const isNoindex = noindexRoutes.has(routeName) || !publicRoutes.has(routeName);

    let robotsMeta = document.head.querySelector('meta[name="robots"]');
    if (isNoindex) {
      if (!robotsMeta) {
        robotsMeta = document.createElement("meta");
        robotsMeta.name = "robots";
        document.head.appendChild(robotsMeta);
      }
      robotsMeta.content = "noindex,follow";
    } else {
      robotsMeta?.remove();
    }

    let canonicalLink = document.head.querySelector('link[rel="canonical"]');
    if (publicRoutes.has(routeName)) {
      const canonicalPath = routeName === "player" && typeof to.query.fileId === "string"
        ? `/player?fileId=${encodeURIComponent(to.query.fileId)}`
        : to.path;
      if (!canonicalLink) {
        canonicalLink = document.createElement("link");
        canonicalLink.rel = "canonical";
        document.head.appendChild(canonicalLink);
      }
      canonicalLink.href = `https://desq.page${canonicalPath}`;
    } else {
      canonicalLink?.remove();
    }
  }
  // Report initial navigation too, even when the editor shell was served locally.
  if (!failure && to.name === "edit") logEditorOpen(to.path);
});
export default router;
