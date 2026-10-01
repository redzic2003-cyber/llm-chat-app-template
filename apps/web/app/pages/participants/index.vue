<script setup lang="ts">
import type { ParticipantDTO, ParticipantImportResult } from "@tm/shared-types";

const api = useApi();
const toast = useToast();
const { can } = useAuth();
const q = ref("");
const includeInactive = ref(false);
const items = ref<ParticipantDTO[]>([]);
const formOpen = ref(false);
const editing = ref<ParticipantDTO | null>(null);
const importOpen = ref(false);
const importResult = ref<ParticipantImportResult | null>(null);
const importing = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
let timer: ReturnType<typeof setTimeout> | undefined;

async function load() {
  try {
    items.value = (await api.participants.list({ q: q.value || undefined, includeInactive: includeInactive.value, limit: 500 })).items;
  } catch (e) {
    toast.error(e);
  }
}
onMounted(load);
watch(q, () => {
  clearTimeout(timer);
  timer = setTimeout(load, 150);
});
watch(includeInactive, load);

function openForm(p: ParticipantDTO | null) {
  editing.value = p;
  formOpen.value = true;
}

function onSaved() {
  formOpen.value = false;
  load();
}

async function onFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  importing.value = true;
  importResult.value = null;
  try {
    importResult.value = await api.participants.import(await file.text());
    toast.success("Import terminé.");
    load();
  } catch (e) {
    toast.error(e);
  } finally {
    importing.value = false;
    if (fileInput.value) fileInput.value.value = "";
  }
}
</script>

<template>
  <div>
    <PageHeader title="Participants" :subtitle="`${items.length} affiché(s)`">
      <label class="checkbox"><input v-model="includeInactive" type="checkbox" /> Inclure les inactifs</label>
      <button v-if="can('participants:write')" class="btn" type="button" @click="importResult = null; importOpen = true"><AppIcon name="upload" /> Importer CSV</button>
      <button v-if="can('participants:write')" class="btn btn-primary" type="button" @click="openForm(null)"><AppIcon name="plus" /> Nouveau participant</button>
    </PageHeader>

    <div class="search card">
      <AppIcon name="search" />
      <input v-model="q" class="search-input" type="search" placeholder="Rechercher par nom, prénom, matricule ou département…" aria-label="Rechercher" autofocus />
    </div>

    <div class="card table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Nom</th>
            <th>Prénom</th>
            <th>Matricule</th>
            <th>Département</th>
            <th>Statut</th>
            <th v-if="can('participants:write')" class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in items" :key="p.id" class="clickable" :class="{ inactive: !p.active }" @click="navigateTo(`/participants/${p.id}`)">
            <td><strong>{{ p.lastName }}</strong></td>
            <td>{{ p.firstName }}</td>
            <td class="mono">{{ p.employeeRef ?? "—" }}</td>
            <td>{{ p.department ?? "—" }}</td>
            <td><span class="badge" :class="p.active ? 'badge-success' : ''">{{ p.active ? "Actif" : "Inactif" }}</span></td>
            <td v-if="can('participants:write')" class="text-right">
              <button class="btn btn-sm" type="button" @click.stop="openForm(p)">Modifier</button>
            </td>
          </tr>
        </tbody>
      </table>
      <EmptyState v-if="!items.length" :title="q ? 'Aucun résultat' : 'Aucun participant'" />
    </div>

    <ParticipantFormDialog :open="formOpen" :participant="editing" @close="formOpen = false" @saved="onSaved" />

    <AppModal :open="importOpen" title="Importer des participants (CSV)" @close="importOpen = false">
      <div class="stack">
        <p class="muted">
          Fichier CSV (séparateur <code>;</code> ou <code>,</code>) avec une ligne d'en-tête. Colonnes reconnues :
          <code>matricule</code>, <code>nom</code>, <code>prénom</code>, <code>département</code>, <code>email</code>
          (ou <code>employee_ref</code>, <code>last_name</code>, <code>first_name</code>, <code>department</code>).
        </p>
        <p class="subtle">Une ligne dont le matricule existe déjà met à jour la fiche correspondante.</p>
        <pre class="sample">matricule;nom;prénom;département
E1001;Dupont;Jean;Production</pre>
        <input ref="fileInput" type="file" accept=".csv,text/csv" :disabled="importing" @change="onFile" />
        <div v-if="importResult" class="alert" :class="importResult.errors.length ? 'alert-warning' : 'alert-success'">
          {{ importResult.created }} créé(s), {{ importResult.updated }} mis à jour, {{ importResult.skipped }} ignoré(s).
          <ul v-if="importResult.errors.length">
            <li v-for="err in importResult.errors.slice(0, 20)" :key="err.line">Ligne {{ err.line }} : {{ err.message }}</li>
          </ul>
        </div>
      </div>
      <template #footer>
        <button class="btn" type="button" @click="importOpen = false">Fermer</button>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.search {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.25rem 0.9rem;
  margin-bottom: 1rem;
  color: var(--muted);
}

.search-input {
  flex: 1;
  border: 0;
  padding: 0.6rem 0;
  font: inherit;
  background: transparent;
  color: var(--text);
}

.search-input:focus {
  outline: none;
}

.sample {
  margin: 0;
  padding: 0.6rem 0.8rem;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 0.82rem;
}

.alert ul {
  margin: 0.4rem 0 0;
  padding-left: 1.2rem;
}
</style>
