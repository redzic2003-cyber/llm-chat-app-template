<script setup lang="ts">
import type { EnrollmentDTO, SessionDTO } from "@tm/shared-types";

definePageMeta({ layout: "bare" });

/** Feuille d'émargement imprimable (statut, heure de validation, signature). */
const route = useRoute();
const api = useApi();
const fmt = useFormat();
const id = String(route.params.id);
const session = ref<SessionDTO | null>(null);
const enrollments = ref<EnrollmentDTO[]>([]);
const error = ref("");

onMounted(async () => {
  try {
    [session.value, enrollments.value] = await Promise.all([api.sessions.get(id), api.sessions.enrollments(id).then((r) => r.items)]);
  } catch (e) {
    error.value = errorMessage(e);
  }
});

function printPage() {
  window.print();
}
</script>

<template>
  <div class="sheet-page">
    <div class="toolbar no-print">
      <NuxtLink :to="`/sessions/${id}`" class="btn"><AppIcon name="chevronLeft" /> Retour à la session</NuxtLink>
      <span class="spacer" />
      <button class="btn btn-primary" type="button" @click="printPage"><AppIcon name="print" /> Imprimer</button>
    </div>
    <p v-if="error" class="form-error">{{ error }}</p>
    <template v-if="session">
      <header class="sheet-header">
        <div>
          <h1>{{ session.training.title }}</h1>
          <p class="muted">{{ session.training.reference }}</p>
        </div>
        <dl>
          <dt>Date</dt>
          <dd>{{ fmt.date(session.startsAt) }}</dd>
          <dt>Horaire</dt>
          <dd>{{ fmt.timeRange(session.startsAt, session.endsAt) }}</dd>
          <dt>Lieu</dt>
          <dd>{{ session.location ?? "—" }}</dd>
          <dt>Formateur</dt>
          <dd>{{ session.trainer.displayName }}</dd>
        </dl>
      </header>
      <table class="table sheet-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Nom</th>
            <th>Prénom</th>
            <th>Matricule</th>
            <th>Statut</th>
            <th>Validé à</th>
            <th class="sign">Signature</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(e, i) in enrollments" :key="e.id">
            <td>{{ i + 1 }}</td>
            <td><strong>{{ e.participant.lastName }}</strong></td>
            <td>{{ e.participant.firstName }}</td>
            <td class="mono">{{ e.participant.employeeRef ?? "" }}</td>
            <td>{{ ENROLLMENT_STATUS[e.status].label }}</td>
            <td>{{ e.validation ? fmt.time(e.validation.validatedAt) : "" }}</td>
            <td class="sign" />
          </tr>
        </tbody>
      </table>
      <footer class="sheet-footer">
        <span>Signature du formateur :</span>
        <span class="muted">Édité le {{ fmt.dateTime(new Date().toISOString()) }}</span>
      </footer>
    </template>
  </div>
</template>

<style scoped>
.sheet-page {
  max-width: 21cm;
  margin: 0 auto;
  padding: 1.5rem 1rem;
  background: #fff;
}

.toolbar {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.sheet-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

dl {
  display: grid;
  grid-template-columns: auto auto;
  gap: 0.15rem 0.75rem;
  margin: 0;
  font-size: 0.9rem;
}

dt {
  color: var(--muted);
}

dd {
  margin: 0;
  font-weight: 600;
}

.sheet-table td {
  height: 1.1cm;
}

.sign {
  width: 30%;
}

.sheet-footer {
  display: flex;
  justify-content: space-between;
  margin-top: 1.5rem;
  padding-top: 2.5rem;
}

@media print {
  @page {
    size: A4;
    margin: 1.2cm;
  }

  .sheet-page {
    padding: 0;
  }
}
</style>
