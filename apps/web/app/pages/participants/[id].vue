<script setup lang="ts">
import type { ParticipantDetailDTO } from "@tm/shared-types";

const route = useRoute();
const api = useApi();
const toast = useToast();
const fmt = useFormat();
const { can } = useAuth();
const participant = ref<ParticipantDetailDTO | null>(null);
const editOpen = ref(false);
const generating = ref(false);

async function load() {
  try {
    participant.value = await api.participants.get(String(route.params.id));
  } catch (e) {
    toast.error(e);
  }
}
onMounted(load);

async function report() {
  if (!participant.value) return;
  generating.value = true;
  try {
    const created = await api.reports.create({ type: "participant", participantId: participant.value.id });
    toast.success("Rapport généré.");
    window.open(api.reports.downloadUrl(created.id) + "?inline=1", "_blank", "noopener");
  } catch (e) {
    toast.error(e);
  } finally {
    generating.value = false;
  }
}
</script>

<template>
  <div v-if="participant">
    <PageHeader :title="`${participant.lastName} ${participant.firstName}`" :subtitle="[participant.employeeRef, participant.department].filter(Boolean).join(' · ')">
      <template #before>
        <NuxtLink to="/participants" class="back"><AppIcon name="chevronLeft" :size="14" /> Participants</NuxtLink>
      </template>
      <button v-if="can('participants:write')" class="btn" type="button" @click="editOpen = true"><AppIcon name="edit" /> Modifier</button>
      <button v-if="can('reports:generate')" class="btn btn-primary" type="button" :disabled="generating" @click="report"><AppIcon name="file" /> Rapport individuel</button>
    </PageHeader>

    <div class="grid grid-3" style="margin-bottom: 1rem">
      <KpiCard label="Formations suivies" :value="participant.totals.sessionsAttended" />
      <KpiCard label="Heures de formation" :value="fmt.hours(participant.totals.hoursAttended)" />
      <KpiCard label="Statut" :value="participant.active ? 'Actif' : 'Inactif'" :hint="participant.email ?? undefined" />
    </div>

    <section class="card">
      <header class="card-header"><h2>Historique</h2></header>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Formation</th>
              <th>Horaire</th>
              <th>Session</th>
              <th>Présence</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="h in participant.history" :key="h.enrollmentId" class="clickable" @click="navigateTo(`/sessions/${h.sessionId}`)">
              <td class="nowrap">{{ fmt.date(h.startsAt) }}</td>
              <td><strong>{{ h.training.title }}</strong> <span class="subtle mono">{{ h.training.reference }}</span></td>
              <td class="nowrap">{{ fmt.timeRange(h.startsAt, h.endsAt) }}</td>
              <td><StatusBadge :session="h.sessionStatus" /></td>
              <td>
                <StatusBadge :enrollment="h.status" />
                <span v-if="h.validatedAt" class="subtle"> {{ fmt.time(h.validatedAt) }}</span>
              </td>
            </tr>
          </tbody>
        </table>
        <EmptyState v-if="!participant.history.length" title="Aucune formation" />
      </div>
    </section>
    <ParticipantFormDialog :open="editOpen" :participant="participant" @close="editOpen = false" @saved="editOpen = false; load()" />
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
</style>
