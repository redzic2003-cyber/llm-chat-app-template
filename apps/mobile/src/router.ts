import { createRouter, createWebHashHistory } from "vue-router";
import { onUnauthorized, state } from "./lib/store";
import LoginView from "./views/LoginView.vue";
import ScanView from "./views/ScanView.vue";
import SessionView from "./views/SessionView.vue";
import SettingsView from "./views/SettingsView.vue";
import TodayView from "./views/TodayView.vue";

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/login", component: LoginView },
    { path: "/", component: TodayView },
    { path: "/sessions/:id", component: SessionView, props: true },
    { path: "/sessions/:id/scan", component: ScanView, props: true },
    { path: "/settings", component: SettingsView },
  ],
});

router.beforeEach((to) => {
  if (to.path !== "/login" && !state.token) return "/login";
  if (to.path === "/login" && state.token) return "/";
});

onUnauthorized(() => void router.replace("/login"));
