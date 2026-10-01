<script setup lang="ts">
import type { ParticipantDTO } from "@tm/shared-types";

const props = defineProps<{ open: boolean; participant?: ParticipantDTO | null }>();
const emit = defineEmits<{ close: []; saved: [participant: ParticipantDTO] }>();
const api = useApi();
const toast = useToast();
const error = ref("");
const saving = ref(false);
const form = reactive({ lastName: "", firstName: "", employeeRef: "", department: "", email: "", active: true });

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    error.value = "";
    const p = props.participant;
    Object.assign(form, {
      lastName: p?.lastName ?? "",
      firstName: p?.firstName ?? "",
      employeeRef: p?.employeeRef ?? "",
      department: p?.department ?? "",
      email: p?.email ?? "",
      active: p?.active ?? true,
    });
  },
  { immediate: true },
);

async function submit() {
  error.value = "";
  saving.value = true;
  const body = {
    lastName: form.lastName,
    firstName: form.firstName,
    employeeRef: form.employeeRef || null,
    department: form.department || null,
    email: form.email || null,
    active: form.active,
  };
  try {
    const saved = props.participant ? await api.participants.update(props.participant.id, body) : await api.participants.create(body);
    toast.success(props.participant ? "Participant mis à jour." : "Participant créé.");
    emit("saved", saved);
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <AppModal :open="open" :title="participant ? 'Modifier le participant' : 'Nouveau participant'" @close="emit('close')">
    <form id="participant-form" class="form-grid" @submit.prevent="submit">
      <label class="field">
        <span>Nom</span>
        <input v-model="form.lastName" class="input" required maxlength="100" />
      </label>
      <label class="field">
        <span>Prénom</span>
        <input v-model="form.firstName" class="input" required maxlength="100" />
      </label>
      <label class="field">
        <span>Matricule</span>
        <input v-model="form.employeeRef" class="input mono" maxlength="64" />
      </label>
      <label class="field">
        <span>Département</span>
        <input v-model="form.department" class="input" maxlength="100" />
      </label>
      <label class="field full">
        <span>E-mail (facultatif)</span>
        <input v-model="form.email" class="input" type="email" maxlength="254" />
      </label>
      <label class="checkbox full"><input v-model="form.active" type="checkbox" /> Participant actif</label>
      <p class="subtle full">Seules les données nécessaires sont collectées : nom, prénom, matricule interne et département.</p>
      <p v-if="error" class="form-error full" role="alert">{{ error }}</p>
    </form>
    <template #footer>
      <button class="btn" type="button" @click="emit('close')">Annuler</button>
      <button class="btn btn-primary" type="submit" form="participant-form" :disabled="saving">Enregistrer</button>
    </template>
  </AppModal>
</template>
