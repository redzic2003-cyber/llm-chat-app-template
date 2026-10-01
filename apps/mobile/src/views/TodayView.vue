<script setup lang="ts">
import type { SessionDTO } from "@tm/shared-types";
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { errorText } from "../lib/errors";
import { addDays, fmtLongDay, fmtTime, isSameDay, startOfDay } from "../lib/format";
import { queue } from "../lib/queue";
import { api, state } from "../lib/store";

const router = useRouter();
const day = ref(startOfDay(new Date()));
const sessions = ref<SessionDTO[]>([]);
const loading = ref(false);
const error = ref("");

const title = computed(() => (isSameDay(day.value, new Date()) ? "Aujourd'hui" : fmtLongDay(day.value)));

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const { items } = await api().sessions.list({
      from: day.value.toISOString(),
      to: addDays(day.value, 1).toISOString(),
      // Un formateur ne voit que ses sessions ; un administrateur voit toutes celles du jour.
      mine: state.user?.role === "trainer" ? true : undefined,
    });
    sessions.value = items;
  } catch (e) {
    error.value = errorText(e);
  } finally {
    loading.value = false;
  }
}

function move(n: number) {
  day.value = addDays(day.value, n);
  void load();
}

onMounted(load);
</script>

<template>
  <div class="screen">
    <header class="topbar">
      <button class="icon-btn" type="button" aria-label="Jour précédent" @click="move(-1)">‹</button>
      <h1 class="cap">{{ title }}</h1>
      <button class="icon-btn" type="button" aria-label="Jour suivant" @click="move(1)">›</button>
      <button class="icon-btn" type="button" aria-label="Réglages" @click="router.push('/settings')">⚙</button>
    </header>
    <p class="subtle hello">{{ state.user?.displayName }}</p>

    <p v-if="queue.items.length" class="banner">{{ queue.items.length }} validation(s) en attente d'envoi — renvoi automatique dès que le réseau revient.</p>
    <p v-if="error" class="error-box">{{ error }}</p>

    <div v-if="sessions.length" class="card list">
      <button v-for="s in sessions" :key="s.id" type="button" class="list-item" :class="{ cancelled: s.status === 'cancelled' }" @click="router.push(`/sessions/${s.id}`)">
        <span class="time">{{ fmtTime(s.startsAt) }}</span>
        <span class="info">
          <strong>{{ s.training.title }}</strong>
          <span class="subtle">{{ s.training.reference }}{{ s.location ? ` · ${s.location}` : "" }}</span>
        </span>
        <span class="badge" :class="s.counts.present >= s.counts.enrolled - s.counts.excused && s.counts.enrolled ? 'badge-success' : 'badge-accent'">
          {{ s.status === "cancelled" ? "Annulée" : `${s.counts.present}/${s.counts.enrolled - s.counts.excused}` }}
        </span>
      </button>
    </div>
    <p v-else-if="!loading" class="empty">Aucune session ce jour-là.</p>
    <button class="btn" type="button" :disabled="loading" @click="load">{{ loading ? "Chargement…" : "Actualiser" }}</button>
  </div>
</template>

<style scoped>
.cap {
  text-transform: capitalize;
}

.hello {
  margin: -8px 0 0;
  text-align: center;
}

.time {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  min-width: 48px;
}

.info {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.info strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cancelled {
  opacity: 0.55;
  text-decoration: line-through;
}
</style>
