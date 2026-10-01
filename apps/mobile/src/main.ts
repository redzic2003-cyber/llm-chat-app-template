import { createApp } from "vue";
import App from "./App.vue";
import { flushQueue, loadQueue } from "./lib/queue";
import { initStore } from "./lib/store";
import { router } from "./router";
import "./styles.css";

async function bootstrap() {
  await initStore();
  await loadQueue();
  createApp(App).use(router).mount("#app");

  // Renvoi des validations en attente : au retour du réseau, au réveil de l'app et périodiquement.
  window.addEventListener("online", () => void flushQueue());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void flushQueue();
  });
  setInterval(() => void flushQueue(), 15_000);
}

void bootstrap();
