<script setup lang="ts">
import type { ParticipantDTO } from "@tm/shared-types";

/** Recherche instantanée et sélection multiple de participants à inscrire. */
const props = defineProps<{ open: boolean; excludeIds: string[] }>();
const emit = defineEmits<{ close: []; add: [ids: string[]] }>();
const api = useApi();
const toast = useToast();

const q = ref("");
const results = ref<ParticipantDTO[]>([]);
const selected = ref<Set<string>>(new Set());
let timer: ReturnType<typeof setTimeout> | undefined;

async function search() {
  try {
    results.value = (await api.participants.list({ q: q.value || undefined, limit: 60 })).items;
  } catch (e) {
    toast.error(e);
  }
}

watch(q, () => {
  clearTimeout(timer);
  timer = setTimeout(search, 180);
});
watch(
  () => props.open,
  (open) => {
    if (open) {
      q.value = "";
      selected.value = new Set();
      search();
    }
  },
  { immediate: true },
);

const excluded = computed(() => new Set(props.excludeIds));
function toggle(id: string) {
  const next = new Set(selected.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  selected.value = next;
}
</script>

<template>
  <AppModal :open="open" title="Ajouter des participants" width="640px" @close="emit('close')">
    <div class="stack">
      <input v-model="q" class="input" type="search" placeholder="Nom, prénom, matricule, département…" autofocus />
      <div class="picker-list">
        <label v-for="p in results" :key="p.id" class="picker-item" :class="{ disabled: excluded.has(p.id) }">
          <input type="checkbox" :disabled="excluded.has(p.id)" :checked="excluded.has(p.id) || selected.has(p.id)" @change="toggle(p.id)" />
          <span class="picker-name">{{ p.lastName }} {{ p.firstName }}</span>
          <span class="subtle">{{ p.employeeRef ?? "" }}</span>
          <span class="subtle picker-dept">{{ p.department ?? "" }}</span>
          <span v-if="excluded.has(p.id)" class="badge">Déjà inscrit</span>
        </label>
        <EmptyState v-if="!results.length" title="Aucun participant trouvé" />
      </div>
    </div>
    <template #footer>
      <span class="muted spacer">{{ selected.size }} sélectionné(s)</span>
      <button class="btn" type="button" @click="emit('close')">Annuler</button>
      <button class="btn btn-primary" type="button" :disabled="!selected.size" @click="emit('add', [...selected])">Inscrire</button>
    </template>
  </AppModal>
</template>

<style scoped>
.picker-list {
  max-height: 46vh;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}

.picker-item {
  display: grid;
  grid-template-columns: auto 1fr auto auto auto;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
}

.picker-item:last-child {
  border-bottom: 0;
}

.picker-item:hover {
  background: var(--surface-2);
}

.picker-item.disabled {
  cursor: default;
  opacity: 0.6;
}

.picker-name {
  font-weight: 550;
}

.picker-dept {
  min-width: 90px;
}
</style>
