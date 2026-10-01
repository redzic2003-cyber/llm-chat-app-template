<script setup lang="ts">
/**
 * Scan → aperçu → validation (docs/blueprint/06-mobile-app.md).
 * Le scan seul ne valide jamais : il affiche l'identité, puis le formateur confirme.
 */
import { ApiClientError } from "@tm/api-client";
import { parsePayload } from "@tm/qr-core";
import type { ScanResolveResponse, SessionDTO } from "@tm/shared-types";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import WebScanner from "../components/WebScanner.vue";
import { errorText, errorTitle } from "../lib/errors";
import { failure, success, tick } from "../lib/feedback";
import { fmtDate, fmtRange, fmtTime } from "../lib/format";
import { enqueue } from "../lib/queue";
import { isNative, prepareNativeScanner, scanNative } from "../lib/scanner";
import { api, state } from "../lib/store";

type Phase =
  | { kind: "scanning" }
  | { kind: "resolving" }
  | { kind: "confirm"; preview: ScanResolveResponse; idempotencyKey: string }
  | { kind: "validating"; preview: ScanResolveResponse; idempotencyKey: string }
  | { kind: "success"; name: string; time: string; offline: boolean }
  | { kind: "error"; title: string; text: string; detail?: string };

const props = defineProps<{ id: string }>();
const router = useRouter();
const phase = ref<Phase>({ kind: "scanning" });
const session = ref<SessionDTO | null>(null);
const confirmedOnce = ref(false);
const manualPayload = ref("");
const native = isNative();
let lastPayload = "";
let lastPayloadAt = 0;
let leaving = false;
let resumeTimer: ReturnType<typeof setTimeout> | undefined;

const quick = computed(() => state.quickMode && confirmedOnce.value);

function showError(error: unknown) {
  failure();
  let detail: string | undefined;
  if (error instanceof ApiClientError) {
    const d = error.details as { validatedAt?: string; validatedBy?: { displayName: string }; session?: { title: string; startsAt: string } } | undefined;
    if (d?.validatedAt) detail = `Validé à ${fmtTime(d.validatedAt)}${d.validatedBy ? ` par ${d.validatedBy.displayName}` : ""}`;
    if (d?.session) detail = `QR de la session « ${d.session.title} » du ${fmtDate(d.session.startsAt)}`;
  }
  phase.value = { kind: "error", title: errorTitle(error), text: errorText(error), detail };
}

async function handle(raw: string) {
  const now = Date.now();
  if (raw === lastPayload && now - lastPayloadAt < 3000) return;
  lastPayload = raw;
  lastPayloadAt = now;
  if (!parsePayload(raw).ok) {
    failure();
    phase.value = { kind: "error", title: "QR NON RECONNU", text: "Ce QR n'est pas un QR de présence." };
    return;
  }
  tick();
  phase.value = { kind: "resolving" };
  try {
    const preview = await api().scans.resolve({ payload: raw, sessionId: props.id, deviceId: state.deviceId });
    if (preview.attendance.status === "validated") {
      failure();
      phase.value = {
        kind: "error",
        title: "DÉJÀ VALIDÉ",
        text: `${preview.participant.firstName} ${preview.participant.lastName}`,
        detail: `Validé à ${fmtTime(preview.attendance.validatedAt)} par ${preview.attendance.validatedBy.displayName}`,
      };
      return;
    }
    phase.value = { kind: "confirm", preview, idempotencyKey: crypto.randomUUID() };
  } catch (error) {
    showError(error);
  }
}

async function validate() {
  const current = phase.value;
  if (current.kind !== "confirm") return;
  phase.value = { kind: "validating", preview: current.preview, idempotencyKey: current.idempotencyKey };
  const name = `${current.preview.participant.firstName} ${current.preview.participant.lastName}`;
  try {
    const result = await api().attendance.validate(current.preview.enrollmentId, {
      idempotencyKey: current.idempotencyKey,
      method: "qr",
      deviceId: state.deviceId,
    });
    confirmedOnce.value = true;
    success();
    phase.value = { kind: "success", name, time: fmtTime(result.validatedAt), offline: false };
    resumeTimer = setTimeout(next, 1100);
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 0) {
      // Réseau coupé après l'aperçu : la validation est mise en file et renvoyée automatiquement.
      await enqueue({
        enrollmentId: current.preview.enrollmentId,
        sessionId: props.id,
        idempotencyKey: current.idempotencyKey,
        label: name,
        queuedAt: new Date().toISOString(),
      });
      confirmedOnce.value = true;
      success();
      phase.value = { kind: "success", name, time: fmtTime(new Date().toISOString()), offline: true };
      resumeTimer = setTimeout(next, 1600);
      return;
    }
    showError(error);
  }
}

function cancel() {
  next();
}

async function nativeLoop() {
  phase.value = { kind: "scanning" };
  try {
    const raw = await scanNative();
    if (raw === null) {
      if (!leaving) await router.replace(`/sessions/${props.id}`);
      return;
    }
    await handle(raw);
  } catch (error) {
    showError(error);
  }
}

/** Retour au scanner (automatique après un succès, sur geste après une erreur). */
function next() {
  clearTimeout(resumeTimer);
  if (leaving) return;
  if (native) void nativeLoop();
  else phase.value = { kind: "scanning" };
}

onMounted(async () => {
  try {
    session.value = await api().sessions.get(props.id);
  } catch {
    // l'en-tête restera minimal
  }
  if (native) {
    try {
      await prepareNativeScanner();
      void nativeLoop();
    } catch (error) {
      showError(error);
    }
  }
});

onBeforeUnmount(() => {
  leaving = true;
  clearTimeout(resumeTimer);
});

function onWebDecode(value: string) {
  if (phase.value.kind === "scanning") void handle(value);
}

function submitManual() {
  if (manualPayload.value.trim()) {
    lastPayload = "";
    void handle(manualPayload.value.trim());
    manualPayload.value = "";
  }
}
</script>

<template>
  <div class="screen scan" :class="phase.kind">
    <header class="topbar">
      <button class="icon-btn" type="button" aria-label="Retour" @click="router.replace(`/sessions/${id}`)">‹</button>
      <h1>{{ session?.training.title ?? "Scanner" }}</h1>
      <span class="icon-btn" />
    </header>

    <!-- Lecture -->
    <template v-if="phase.kind === 'scanning' || phase.kind === 'resolving'">
      <WebScanner v-if="!native" @decode="onWebDecode" @error="(m) => (phase = { kind: 'error', title: 'CAMÉRA', text: m })" />
      <p class="center muted">{{ phase.kind === "resolving" ? "Vérification du QR…" : native ? "Ouverture du scanner…" : "Présentez le QR devant la caméra" }}</p>
      <form v-if="!native" class="manual" @submit.prevent="submitManual">
        <input v-model="manualPayload" class="input" placeholder="TRN1:… (saisie manuelle)" autocapitalize="off" autocomplete="off" />
        <button class="btn" type="submit">OK</button>
      </form>
    </template>

    <!-- Confirmation -->
    <template v-else-if="phase.kind === 'confirm' || phase.kind === 'validating'">
      <section class="identity card" :class="{ tappable: quick }" @click="quick && phase.kind === 'confirm' ? validate() : undefined">
        <p class="subtle">QR reconnu</p>
        <h2>{{ phase.preview.participant.lastName.toUpperCase() }}<br />{{ phase.preview.participant.firstName }}</h2>
        <p v-if="phase.preview.participant.employeeRef" class="subtle">{{ phase.preview.participant.employeeRef }}</p>
        <hr />
        <p><strong>{{ phase.preview.session.title }}</strong></p>
        <p class="muted">{{ fmtDate(phase.preview.session.startsAt) }} · {{ fmtRange(phase.preview.session.startsAt, phase.preview.session.endsAt) }}</p>
        <p v-if="phase.preview.timing !== 'on_time'" class="banner">
          {{ phase.preview.timing === "early" ? "Attention : la session n'a pas encore commencé." : "Attention : la session est terminée." }}
        </p>
        <p v-if="quick" class="quick-hint">Touchez la carte pour valider</p>
      </section>
      <button v-if="!quick" class="btn btn-success btn-xl" type="button" :disabled="phase.kind === 'validating'" @click="validate">
        {{ phase.kind === "validating" ? "VALIDATION…" : "VALIDER" }}
      </button>
      <button class="btn btn-xl" type="button" :disabled="phase.kind === 'validating'" @click="cancel">ANNULER</button>
    </template>

    <!-- Succès -->
    <section v-else-if="phase.kind === 'success'" class="result ok" :class="{ offline: phase.offline }" @click="next">
      <div class="big">✓</div>
      <h2>{{ phase.offline ? "ENREGISTRÉ" : "VALIDÉ" }}</h2>
      <p class="name">{{ phase.name }}</p>
      <p>{{ phase.time }}</p>
      <p v-if="phase.offline" class="small">Hors ligne : envoi automatique dès le retour du réseau.</p>
    </section>

    <!-- Erreur -->
    <section v-else-if="phase.kind === 'error'" class="result ko" @click="next">
      <div class="big">!</div>
      <h2>{{ phase.title }}</h2>
      <p class="name">{{ phase.text }}</p>
      <p v-if="phase.detail">{{ phase.detail }}</p>
      <button class="btn btn-xl continue" type="button" @click.stop="next">Continuer</button>
    </section>
  </div>
</template>

<style scoped>
.center {
  text-align: center;
}

.manual {
  display: flex;
  gap: 8px;
}

.manual .input {
  flex: 1;
  min-width: 0;
}

.identity {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 22px 18px;
}

.identity h2 {
  margin: 0;
  font-size: 1.9rem;
  line-height: 1.15;
}

.identity p {
  margin: 0;
}

.identity hr {
  width: 100%;
  border: 0;
  border-top: 1px solid var(--border);
  margin: 8px 0;
}

.identity.tappable {
  border: 2px solid var(--success);
}

.quick-hint {
  margin-top: 8px !important;
  color: var(--success);
  font-weight: 650;
}

.result {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: 20px;
  padding: 24px;
  text-align: center;
  color: #fff;
}

.result h2 {
  margin: 0;
  font-size: 2rem;
  letter-spacing: 0.04em;
}

.result p {
  margin: 0;
}

.result .name {
  font-size: 1.3rem;
  font-weight: 650;
}

.result .small {
  font-size: 0.9rem;
  opacity: 0.9;
}

.result .big {
  display: grid;
  place-items: center;
  width: 96px;
  height: 96px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  font-size: 3.2rem;
  font-weight: 800;
}

.ok {
  background: var(--success);
}

.ok.offline {
  background: var(--warning);
}

.ko {
  background: var(--danger);
}

.continue {
  margin-top: 18px;
  width: 100%;
  background: rgba(255, 255, 255, 0.95);
  color: var(--danger);
  border: 0;
}
</style>
