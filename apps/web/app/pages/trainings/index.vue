<script setup lang="ts">
import type { TrainingDTO } from "@tm/shared-types";

const api = useApi();
const toast = useToast();
const { confirm } = useConfirm();
const { can } = useAuth();
const items = ref<TrainingDTO[]>([]);
const includeInactive = ref(false);
const editing = ref<TrainingDTO | null>(null);
const formOpen = ref(false);

async function load() {
  try {
    items.value = (await api.trainings.list({ includeInactive: includeInactive.value })).items;
  } catch (e) {
    toast.error(e);
  }
}
onMounted(load);
watch(includeInactive, load);

function openForm(t: TrainingDTO | null) {
  editing.value = t;
  formOpen.value = true;
}

async function toggleActive(t: TrainingDTO) {
  if (t.active && !(await confirm({ title: "Désactiver la formation", message: `« ${t.title} » ne pourra plus être planifiée. L'historique est conservé.`, confirmLabel: "Désactiver", danger: true }))) return;
  try {
    if (t.active) await api.trainings.deactivate(t.id);
    else await api.trainings.update(t.id, { active: true });
    toast.success(t.active ? "Formation désactivée." : "Formation réactivée.");
    load();
  } catch (e) {
    toast.error(e);
  }
}

function onSaved() {
  formOpen.value = false;
  load();
}

const duration = (m: number | null) => (m ? (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, "0")}` : ""}` : `${m} min`) : "—");
</script>

<template>
  <div>
    <PageHeader title="Formations" subtitle="Catalogue des types de formation">
      <label class="checkbox"><input v-model="includeInactive" type="checkbox" /> Afficher les inactives</label>
      <button v-if="can('trainings:write')" class="btn btn-primary" type="button" @click="openForm(null)"><AppIcon name="plus" /> Nouvelle formation</button>
    </PageHeader>
    <div class="card table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Référence</th>
            <th>Titre</th>
            <th>Durée standard</th>
            <th>Statut</th>
            <th v-if="can('trainings:write')" class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in items" :key="t.id" :class="{ inactive: !t.active }">
            <td class="mono">{{ t.reference }}</td>
            <td>
              <strong>{{ t.title }}</strong>
              <div v-if="t.description" class="subtle">{{ t.description }}</div>
            </td>
            <td class="nowrap">{{ duration(t.defaultDurationMinutes) }}</td>
            <td><span class="badge" :class="t.active ? 'badge-success' : ''">{{ t.active ? "Active" : "Inactive" }}</span></td>
            <td v-if="can('trainings:write')" class="text-right nowrap">
              <button class="btn btn-sm" type="button" @click="openForm(t)">Modifier</button>
              <button class="btn btn-sm btn-ghost" type="button" @click="toggleActive(t)">{{ t.active ? "Désactiver" : "Réactiver" }}</button>
            </td>
          </tr>
        </tbody>
      </table>
      <EmptyState v-if="!items.length" title="Aucune formation" text="Créez un premier type de formation pour pouvoir planifier des sessions." />
    </div>
    <TrainingFormDialog :open="formOpen" :training="editing" @close="formOpen = false" @saved="onSaved" />
  </div>
</template>
