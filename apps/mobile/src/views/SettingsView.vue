<script setup lang="ts">
import { useRouter } from "vue-router";
import { flushQueue, queue } from "../lib/queue";
import { logout, setQuickMode, setSound, state } from "../lib/store";

const router = useRouter();

async function signOut() {
  await logout();
  await router.replace("/login");
}
</script>

<template>
  <div class="screen">
    <header class="topbar">
      <button class="icon-btn" type="button" aria-label="Retour" @click="router.push('/')">‹</button>
      <h1>Réglages</h1>
      <span class="icon-btn" />
    </header>

    <section class="card settings">
      <label class="row">
        <span>
          <strong>Validation rapide</strong>
          <small class="subtle">Après une première confirmation, un seul toucher sur la fiche valide la présence. L'identité est toujours affichée.</small>
        </span>
        <input type="checkbox" :checked="state.quickMode" @change="setQuickMode(($event.target as HTMLInputElement).checked)" />
      </label>
      <label class="row">
        <span>
          <strong>Signal sonore</strong>
          <small class="subtle">Bip court à la validation, grave en cas d'erreur.</small>
        </span>
        <input type="checkbox" :checked="state.sound" @change="setSound(($event.target as HTMLInputElement).checked)" />
      </label>
    </section>

    <section class="card settings">
      <div class="row">
        <span>
          <strong>Validations en attente</strong>
          <small class="subtle">{{ queue.items.length ? queue.items.map((i) => i.label).join(", ") : "Aucune" }}</small>
        </span>
        <button class="btn" type="button" :disabled="!queue.items.length || queue.flushing" @click="flushQueue">Envoyer</button>
      </div>
    </section>

    <section class="card settings">
      <div class="row info">
        <span><strong>{{ state.user?.displayName }}</strong><small class="subtle">{{ state.user?.email }}</small></span>
      </div>
      <div class="row info">
        <span><strong>Serveur</strong><small class="subtle">{{ state.baseUrl }}</small></span>
      </div>
      <div class="row info">
        <span><strong>Appareil</strong><small class="subtle">{{ state.deviceId }}</small></span>
      </div>
    </section>

    <button class="btn" type="button" @click="signOut">Se déconnecter</button>
  </div>
</template>

<style scoped>
.settings {
  display: flex;
  flex-direction: column;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
}

.row:last-child {
  border-bottom: 0;
}

.row span {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.row input[type="checkbox"] {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}
</style>
