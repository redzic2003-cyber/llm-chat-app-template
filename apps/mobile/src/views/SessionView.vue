<script setup lang="ts">
import type { EnrollmentDTO, SessionDTO } from "@tm/shared-types";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { errorText } from "../lib/errors";
import { failure, success } from "../lib/feedback";
import { fmtDate, fmtRange, fmtTime } from "../lib/format";
import { api, state } from "../lib/store";

const props = defineProps<{ id: string }>();
const router = useRouter();
const session = ref<SessionDTO | null>(null);
const enrollments = ref<EnrollmentDTO[]>([]);
const error = ref("");
const manual = ref<EnrollmentDTO | null>(null);
const busy = ref(false);

async function load() {
  try {
    const [s, e] = await Promise.all([api().sessions.get(props.id), api().sessions.enrollments(props.id)]);
    session.value = s;
    enrollments.value = e.items;
    error.value = "";
  } catch (e) {
    error.value = errorText(e);
  }
}

let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  void load();
  timer = setInterval(() => void load(), 10_000);
});
onBeforeUnmount(() => clearInterval(timer));

const expected = computed(() => (session.value ? session.value.counts.enrolled - session.value.counts.excused : 0));
const open = computed(() => session.value && session.value.status !== "completed" && session.value.status !== "cancelled");
const sorted = computed(() =>
  [...enrollments.value].sort((a, b) => Number(a.status === "present") - Number(b.status === "present") || a.participant.lastName.localeCompare(b.participant.lastName, "fr")),
);

/** Validation manuelle (QR oublié) : confirmation explicite, méthode « manual ». */
async function validateManually() {
  if (!manual.value) return;
  busy.value = true;
  try {
    await api().attendance.validate(manual.value.id, { idempotencyKey: crypto.randomUUID(), method: "manual", deviceId: state.deviceId });
    success();
    manual.value = null;
    await load();
  } catch (e) {
    failure();
    error.value = errorText(e);
    manual.value = null;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="screen">
    <header class="topbar">
      <button class="icon-btn" type="button" aria-label="Retour" @click="router.push('/')">‹</button>
      <h1>Session</h1>
      <button class="icon-btn" type="button" aria-label="Actualiser" @click="load">↻</button>
    </header>
    <p v-if="error" class="error-box">{{ error }}</p>

    <template v-if="session">
      <section class="card head">
        <h2>{{ session.training.title }}</h2>
        <p class="subtle">{{ session.training.reference }} · {{ fmtDate(session.startsAt) }} · {{ fmtRange(session.startsAt, session.endsAt) }}</p>
        <p v-if="session.location" class="subtle">{{ session.location }}</p>
        <div class="count">
          <strong>{{ session.counts.present }}</strong>
          <span class="muted">/ {{ expected }} présents</span>
        </div>
        <div class="progress"><div :style="{ width: `${expected ? (session.counts.present / expected) * 100 : 0}%` }" /></div>
      </section>

      <button v-if="open" class="btn btn-primary btn-xl" type="button" @click="router.push(`/sessions/${session.id}/scan`)">SCANNER</button>
      <p v-else class="banner">Session {{ session.status === "cancelled" ? "annulée" : "clôturée" }} : plus de validation possible.</p>

      <div class="card list">
        <button
          v-for="e in sorted"
          :key="e.id"
          type="button"
          class="list-item"
          :disabled="!open || e.status !== 'expected' && e.status !== 'invited'"
          @click="manual = e"
        >
          <span class="mark" :class="e.status">{{ e.status === "present" ? "✓" : e.status === "excused" ? "E" : e.status === "absent" ? "✕" : "○" }}</span>
          <span class="name">
            <strong>{{ e.participant.lastName }}</strong> {{ e.participant.firstName }}
          </span>
          <span v-if="e.validation" class="subtle">{{ fmtTime(e.validation.validatedAt) }}</span>
        </button>
        <p v-if="!enrollments.length" class="empty">Aucun participant inscrit.</p>
      </div>
    </template>

    <div v-if="manual" class="sheet-backdrop" @click.self="manual = null">
      <div class="sheet">
        <p class="subtle">Validation manuelle (sans QR)</p>
        <h2>{{ manual.participant.lastName.toUpperCase() }} {{ manual.participant.firstName }}</h2>
        <p class="subtle">{{ manual.participant.employeeRef ?? "" }} {{ manual.participant.department ?? "" }}</p>
        <button class="btn btn-success btn-xl" type="button" :disabled="busy" @click="validateManually">VALIDER</button>
        <button class="btn" type="button" @click="manual = null">ANNULER</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.head {
  padding: 16px;
}

.head h2 {
  margin: 0 0 4px;
  font-size: 1.25rem;
}

.head p {
  margin: 0;
}

.count {
  margin-top: 10px;
}

.count strong {
  font-size: 2rem;
}

.progress {
  height: 6px;
  border-radius: 999px;
  background: #eef0f3;
  overflow: hidden;
  margin-top: 6px;
}

.progress div {
  height: 100%;
  background: var(--success);
}

.mark {
  display: inline-grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #eef0f3;
  color: var(--muted);
  font-weight: 700;
  flex-shrink: 0;
}

.mark.present {
  background: var(--success-weak);
  color: var(--success);
}

.mark.absent {
  background: var(--danger-weak);
  color: var(--danger);
}

.mark.excused {
  background: var(--warning-weak);
  color: var(--warning);
}

.name {
  flex: 1;
}

.list-item:disabled {
  opacity: 1;
}

.sheet-backdrop {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: flex-end;
  background: rgba(15, 23, 42, 0.45);
}

.sheet {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  padding: 20px 16px calc(var(--safe-bottom) + 16px);
  border-radius: 20px 20px 0 0;
  background: var(--surface);
}

.sheet h2 {
  margin: 0;
}

.sheet p {
  margin: 0;
}
</style>
