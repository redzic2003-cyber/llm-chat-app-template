<script setup lang="ts">
import type { EnrollmentDTO, IssuedQrDTO, ManualEnrollmentStatus, SessionDTO } from "@tm/shared-types";

const route = useRoute();
const api = useApi();
const toast = useToast();
const fmt = useFormat();
const { ask, confirm } = useConfirm();
const { can, canManageSession } = useAuth();

const id = computed(() => String(route.params.id));
const session = ref<SessionDTO | null>(null);
const enrollments = ref<EnrollmentDTO[]>([]);
const notFound = ref(false);
const busy = ref(false);
const pickerOpen = ref(false);
const editOpen = ref(false);
const qrPreview = ref<IssuedQrDTO | null>(null);

async function load(silent = false) {
  try {
    const [s, e] = await Promise.all([api.sessions.get(id.value), api.sessions.enrollments(id.value)]);
    session.value = s;
    enrollments.value = e.items;
  } catch (e) {
    if ((e as { status?: number }).status === 404) notFound.value = true;
    else if (!silent) toast.error(e);
  }
}

// Statut de présence en direct : rafraîchissement toutes les 5 s tant que la session est ouverte.
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  load();
  timer = setInterval(() => {
    if (document.visibilityState === "visible" && isOpen.value && !busy.value) load(true);
  }, 5000);
});
onBeforeUnmount(() => clearInterval(timer));

const manage = computed(() => (session.value ? canManageSession(session.value) : false));
const isOpen = computed(() => session.value?.status !== "completed" && session.value?.status !== "cancelled");
const expected = computed(() => (session.value ? session.value.counts.enrolled - session.value.counts.excused : 0));
const progress = computed(() => (expected.value ? Math.round(((session.value?.counts.present ?? 0) / expected.value) * 100) : 0));
const missingQr = computed(() => enrollments.value.filter((e) => !e.qr.active && e.status !== "excused" && e.status !== "present").length);

async function run<T>(action: () => Promise<T>, success?: string): Promise<T | undefined> {
  busy.value = true;
  try {
    const result = await action();
    if (success) toast.success(success);
    await load(true);
    return result;
  } catch (e) {
    toast.error(e);
  } finally {
    busy.value = false;
  }
}

async function addParticipants(ids: string[]) {
  pickerOpen.value = false;
  await run(() => api.sessions.enroll(id.value, ids), `${ids.length} participant(s) inscrit(s).`);
}

function validate(e: EnrollmentDTO) {
  return run(
    () => api.attendance.validate(e.id, { idempotencyKey: crypto.randomUUID(), method: "manual" }),
    `Présence validée : ${e.participant.firstName} ${e.participant.lastName}.`,
  );
}

async function revoke(e: EnrollmentDTO) {
  const answer = await ask({
    title: "Annuler la présence",
    message: `La présence de ${e.participant.firstName} ${e.participant.lastName} sera annulée (l'historique est conservé).`,
    confirmLabel: "Annuler la présence",
    danger: true,
    input: { label: "Motif (facultatif)" },
  });
  if (answer.ok) await run(() => api.attendance.revoke(e.id, answer.value || undefined), "Présence annulée.");
}

function setStatus(e: EnrollmentDTO, status: ManualEnrollmentStatus) {
  return run(() => api.sessions.setEnrollmentStatus(id.value, e.id, status), "Statut mis à jour.");
}

async function remove(e: EnrollmentDTO) {
  if (await confirm({ title: "Retirer le participant", message: `Retirer ${e.participant.firstName} ${e.participant.lastName} de la session ?`, confirmLabel: "Retirer", danger: true })) {
    await run(() => api.sessions.unenroll(id.value, e.id), "Participant retiré.");
  }
}

async function rotateQr(e: EnrollmentDTO) {
  if (e.qr.active && !(await confirm({ title: "Régénérer le QR", message: "L'ancien QR de ce participant deviendra inutilisable.", confirmLabel: "Régénérer" }))) return;
  const issued = await run(() => (e.qr.active ? api.qr.rotate(e.id) : api.qr.issue(e.id)));
  if (issued) qrPreview.value = issued;
}

async function regenerateAll() {
  if (await confirm({ title: "Régénérer tous les QR", message: "Tous les QR déjà imprimés pour cette session deviendront inutilisables.", confirmLabel: "Régénérer et imprimer", danger: true })) {
    await navigateTo(`/sessions/${id.value}/print?mode=all`);
  }
}

async function complete() {
  const pending = session.value?.counts.pending ?? 0;
  if (await confirm({ title: "Clôturer la session", message: pending ? `${pending} participant(s) non validé(s) seront marqués absents.` : "La session sera clôturée.", confirmLabel: "Clôturer" })) {
    await run(() => api.sessions.complete(id.value), "Session clôturée.");
  }
}

async function cancel() {
  const answer = await ask({ title: "Annuler la session", message: "Les QR émis seront révoqués.", confirmLabel: "Annuler la session", danger: true, input: { label: "Motif" } });
  if (answer.ok) await run(() => api.sessions.cancel(id.value, answer.value || undefined), "Session annulée.");
}

async function report() {
  const created = await run(() => api.reports.create({ type: "session", sessionId: id.value }), "Rapport généré.");
  if (created) window.open(api.reports.downloadUrl(created.id) + "?inline=1", "_blank", "noopener");
}

function onSaved(updated: SessionDTO) {
  editOpen.value = false;
  session.value = updated;
}

function printQr() {
  window.print();
}
</script>

<template>
  <div>
    <EmptyState v-if="notFound" title="Session introuvable"><NuxtLink to="/calendar">Retour au calendrier</NuxtLink></EmptyState>
    <template v-else-if="session">
      <PageHeader :title="session.training.title" :subtitle="session.training.reference">
        <template #before>
          <NuxtLink to="/calendar" class="back no-print"><AppIcon name="chevronLeft" :size="14" /> Calendrier</NuxtLink>
        </template>
        <template v-if="manage && isOpen">
          <button class="btn" type="button" @click="editOpen = true"><AppIcon name="edit" /> Modifier</button>
          <button class="btn" type="button" :disabled="busy" @click="complete"><AppIcon name="check" /> Clôturer</button>
          <button class="btn btn-danger" type="button" :disabled="busy" @click="cancel">Annuler</button>
        </template>
      </PageHeader>

      <div class="grid summary-grid">
        <div class="card card-body info">
          <div><span class="label">Date</span><strong class="cap">{{ fmt.longDate(session.startsAt) }}</strong></div>
          <div><span class="label">Horaire</span><strong>{{ fmt.timeRange(session.startsAt, session.endsAt) }}</strong><span class="subtle">{{ fmt.duration(session.startsAt, session.endsAt) }}</span></div>
          <div><span class="label">Lieu</span><strong>{{ session.location ?? "—" }}</strong></div>
          <div><span class="label">Formateur</span><strong>{{ session.trainer.displayName }}</strong></div>
          <div><span class="label">Statut</span><StatusBadge :session="session.status" /></div>
          <p v-if="session.notes" class="notes muted">{{ session.notes }}</p>
        </div>
        <div class="card card-body presence">
          <span class="label">Présences</span>
          <div class="presence-count">
            <strong>{{ session.counts.present }}</strong>
            <span class="muted">/ {{ expected }} présents</span>
          </div>
          <div class="progress" role="progressbar" :aria-valuenow="progress" aria-valuemin="0" aria-valuemax="100"><div :style="{ width: `${progress}%` }" /></div>
          <span class="subtle">
            {{ session.counts.pending }} à valider · {{ session.counts.absent }} absent(s) · {{ session.counts.excused }} excusé(s)
            <template v-if="isOpen"> · mise à jour automatique</template>
          </span>
        </div>
      </div>

      <section class="card">
        <header class="card-header">
          <h2>Participants ({{ enrollments.length }})</h2>
          <div class="btn-group">
            <button v-if="manage && isOpen" class="btn btn-primary btn-sm" type="button" @click="pickerOpen = true"><AppIcon name="plus" /> Ajouter</button>
            <NuxtLink v-if="manage && isOpen" class="btn btn-sm" :to="`/sessions/${session.id}/print?mode=missing`" :class="{ disabled: !missingQr }">
              <AppIcon name="qr" /> Générer les QR <span v-if="missingQr" class="badge badge-accent">{{ missingQr }}</span>
            </NuxtLink>
            <button v-if="manage && isOpen" class="btn btn-sm" type="button" @click="regenerateAll"><AppIcon name="refresh" /> Régénérer tous</button>
            <NuxtLink class="btn btn-sm" :to="`/sessions/${session.id}/sheet`"><AppIcon name="print" /> Feuille d'émargement</NuxtLink>
            <a class="btn btn-sm" :href="api.sessions.exportCsvUrl(session.id)" download><AppIcon name="download" /> Exporter</a>
            <button v-if="can('reports:generate')" class="btn btn-sm" type="button" :disabled="busy" @click="report"><AppIcon name="file" /> Rapport PDF</button>
          </div>
        </header>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Participant</th>
                <th>Matricule</th>
                <th>Département</th>
                <th>Statut</th>
                <th>Validation</th>
                <th>QR</th>
                <th v-if="manage" class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="e in enrollments" :key="e.id">
                <td><strong>{{ e.participant.lastName }}</strong> {{ e.participant.firstName }}</td>
                <td class="mono">{{ e.participant.employeeRef ?? "—" }}</td>
                <td>{{ e.participant.department ?? "—" }}</td>
                <td><StatusBadge :enrollment="e.status" /></td>
                <td>
                  <template v-if="e.validation">
                    <strong>{{ fmt.time(e.validation.validatedAt) }}</strong>
                    <span class="subtle"> · {{ e.validation.validatedBy.displayName }}{{ e.validation.method === "manual" ? " (manuel)" : "" }}</span>
                  </template>
                  <span v-else class="subtle">—</span>
                </td>
                <td>
                  <span v-if="e.qr.active" class="badge badge-accent" :title="e.qr.lastScannedAt ? `Dernier scan : ${fmt.dateTime(e.qr.lastScannedAt)}` : 'Jamais scanné'">
                    Émis{{ e.qr.scanCount ? ` · ${e.qr.scanCount} scan(s)` : "" }}
                  </span>
                  <span v-else class="subtle">—</span>
                </td>
                <td v-if="manage" class="text-right">
                  <div class="row actions">
                    <template v-if="isOpen && (e.status === 'expected' || e.status === 'invited')">
                      <button class="btn btn-success btn-sm" type="button" :disabled="busy" @click="validate(e)">Valider</button>
                      <button class="btn btn-sm" type="button" :disabled="busy" @click="setStatus(e, 'excused')">Excusé</button>
                      <button class="btn btn-sm" type="button" :disabled="busy" title="QR individuel" @click="rotateQr(e)"><AppIcon name="qr" :size="15" /></button>
                      <button class="btn btn-ghost btn-sm" type="button" :disabled="busy" title="Retirer" @click="remove(e)"><AppIcon name="x" :size="15" /></button>
                    </template>
                    <button v-else-if="e.status === 'present' && (isOpen || can('sessions:manage-any'))" class="btn btn-sm" type="button" :disabled="busy" @click="revoke(e)">Annuler la présence</button>
                    <template v-else-if="e.status === 'excused' || e.status === 'absent'">
                      <button v-if="isOpen" class="btn btn-sm" type="button" :disabled="busy" @click="setStatus(e, 'expected')">Remettre à valider</button>
                      <button v-else-if="session.status === 'completed'" class="btn btn-sm" type="button" :disabled="busy" @click="setStatus(e, e.status === 'absent' ? 'excused' : 'absent')">
                        {{ e.status === "absent" ? "Marquer excusé" : "Marquer absent" }}
                      </button>
                    </template>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          <EmptyState v-if="!enrollments.length" title="Aucun participant inscrit" text="Ajoutez des participants pour générer leurs QR de présence." />
        </div>
      </section>

      <ParticipantPicker :open="pickerOpen" :exclude-ids="enrollments.map((e) => e.participant.id)" @close="pickerOpen = false" @add="addParticipants" />
      <SessionFormDialog :open="editOpen" :session="session" @close="editOpen = false" @saved="onSaved" />
      <AppModal :open="Boolean(qrPreview)" title="QR individuel" width="420px" @close="qrPreview = null">
        <div v-if="qrPreview" class="qr-preview qr-print-target">
          <QrCode :value="qrPreview.payload" :size="220" />
          <strong>{{ qrPreview.participant.lastName }} {{ qrPreview.participant.firstName }}</strong>
          <span class="muted">{{ session.training.title }} · {{ fmt.date(session.startsAt) }} {{ fmt.timeRange(session.startsAt, session.endsAt) }}</span>
          <p class="alert alert-warning">Ce QR n'est affiché qu'une fois. Imprimez-le maintenant ; il faudra sinon le régénérer.</p>
        </div>
        <template #footer>
          <button class="btn" type="button" @click="qrPreview = null">Fermer</button>
          <button class="btn btn-primary" type="button" @click="printQr"><AppIcon name="print" /> Imprimer</button>
        </template>
      </AppModal>
    </template>
  </div>
</template>

<style scoped>
.back {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.85rem;
  color: var(--muted);
}

.summary-grid {
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  margin-bottom: 1rem;
}

@media (max-width: 900px) {
  .summary-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

.info {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem 1.5rem;
}

.info > div {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  align-items: flex-start;
}

.cap {
  text-transform: capitalize;
}

.notes {
  grid-column: 1 / -1;
  font-size: 0.9rem;
}

.presence {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.presence-count strong {
  font-size: 2rem;
  font-weight: 700;
}

.actions {
  justify-content: flex-end;
  flex-wrap: nowrap;
  gap: 0.35rem;
}

.btn.disabled {
  opacity: 0.55;
  pointer-events: none;
}

.qr-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  text-align: center;
}

</style>

<style>
/* Impression du QR individuel : seule la fiche de la modale est imprimée. */
@media print {
  body:has(.qr-print-target) * {
    visibility: hidden;
  }

  .qr-print-target,
  .qr-print-target * {
    visibility: visible;
  }

  .qr-print-target {
    position: fixed;
    inset: 2cm 0 auto 0;
  }

  .qr-print-target .alert {
    display: none;
  }
}
</style>
