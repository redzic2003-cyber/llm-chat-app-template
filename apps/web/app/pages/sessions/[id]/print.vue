<script setup lang="ts">
import type { IssuedQrDTO, SessionDTO } from "@tm/shared-types";

definePageMeta({ layout: "bare" });

/**
 * Fiches QR à imprimer. Les tokens bruts ne sont renvoyés qu'à l'émission : cette
 * page les reçoit une seule fois et ne les stocke nulle part.
 */
const route = useRoute();
const api = useApi();
const fmt = useFormat();
const id = String(route.params.id);
const mode = route.query.mode === "all" ? "all" : "missing";

const session = ref<SessionDTO | null>(null);
const cards = ref<IssuedQrDTO[]>([]);
const error = ref("");
const loading = ref(true);

onMounted(async () => {
  try {
    session.value = await api.sessions.get(id);
    cards.value = (await api.sessions.issueQrBatch(id, mode)).items;
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
});

function printPage() {
  window.print();
}
</script>

<template>
  <div class="print-page">
    <div class="toolbar no-print">
      <NuxtLink :to="`/sessions/${id}`" class="btn"><AppIcon name="chevronLeft" /> Retour à la session</NuxtLink>
      <span class="spacer" />
      <button class="btn btn-primary" type="button" :disabled="!cards.length" @click="printPage"><AppIcon name="print" /> Imprimer</button>
    </div>

    <p v-if="loading" class="muted no-print">Génération des QR…</p>
    <p v-else-if="error" class="form-error no-print">{{ error }}</p>
    <template v-else-if="session">
      <div class="alert alert-warning no-print">
        {{ cards.length }} QR {{ mode === "all" ? "régénéré(s)" : "généré(s)" }}. Ils ne sont affichés qu'une fois : imprimez-les maintenant.
        Les QR imprimés auparavant pour ces participants ne sont plus valides.
      </div>
      <EmptyState v-if="!cards.length" title="Aucun QR à générer" text="Tous les participants ont déjà un QR actif. Utilisez « Régénérer tous » pour les réimprimer." />
      <div class="sheet">
        <article v-for="c in cards" :key="c.enrollmentId" class="qr-card">
          <QrCode :value="c.payload" :size="150" />
          <div class="qr-info">
            <strong class="name">{{ c.participant.lastName.toUpperCase() }} {{ c.participant.firstName }}</strong>
            <span v-if="c.participant.employeeRef" class="mono">{{ c.participant.employeeRef }}</span>
            <span class="training">{{ session.training.title }}</span>
            <span>{{ fmt.date(session.startsAt) }} · {{ fmt.timeRange(session.startsAt, session.endsAt) }}</span>
            <span v-if="session.location">{{ session.location }}</span>
            <small>QR personnel — à présenter au formateur</small>
          </div>
        </article>
      </div>
    </template>
  </div>
</template>

<style scoped>
.print-page {
  max-width: 21cm;
  margin: 0 auto;
  padding: 1.5rem 1rem;
}

.toolbar {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.alert {
  margin-bottom: 1rem;
}

.sheet {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0;
  background: #fff;
}

.qr-card {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  padding: 0.6cm 0.5cm;
  border: 1px dashed #b9bec7;
  break-inside: avoid;
  min-height: 6.6cm;
}

.qr-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  font-size: 0.85rem;
}

.name {
  font-size: 1rem;
}

.training {
  font-weight: 600;
  margin-top: 0.3rem;
}

small {
  margin-top: 0.4rem;
  color: #6b7280;
}

@media print {
  @page {
    size: A4;
    margin: 1cm;
  }

  .print-page {
    padding: 0;
    max-width: none;
  }
}
</style>
