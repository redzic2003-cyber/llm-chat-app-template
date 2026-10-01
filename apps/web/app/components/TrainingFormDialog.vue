<script setup lang="ts">
import type { TrainingDTO } from "@tm/shared-types";

const props = defineProps<{ open: boolean; training?: TrainingDTO | null }>();
const emit = defineEmits<{ close: []; saved: [training: TrainingDTO] }>();
const api = useApi();
const toast = useToast();
const error = ref("");
const saving = ref(false);
const form = reactive({ reference: "", title: "", description: "", duration: "" as string | number, active: true });

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    error.value = "";
    const t = props.training;
    Object.assign(form, {
      reference: t?.reference ?? "",
      title: t?.title ?? "",
      description: t?.description ?? "",
      duration: t?.defaultDurationMinutes ?? "",
      active: t?.active ?? true,
    });
  },
  { immediate: true },
);

async function submit() {
  error.value = "";
  saving.value = true;
  const body = {
    reference: form.reference,
    title: form.title,
    description: form.description || null,
    defaultDurationMinutes: form.duration === "" ? null : Number(form.duration),
    active: form.active,
  };
  try {
    const saved = props.training ? await api.trainings.update(props.training.id, body) : await api.trainings.create(body);
    toast.success(props.training ? "Formation mise à jour." : "Formation créée.");
    emit("saved", saved);
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <AppModal :open="open" :title="training ? 'Modifier la formation' : 'Nouvelle formation'" @close="emit('close')">
    <form id="training-form" class="form-grid" @submit.prevent="submit">
      <label class="field">
        <span>Référence</span>
        <input v-model="form.reference" class="input mono" required maxlength="32" placeholder="SEC-INC-01" />
        <small>Unique · lettres, chiffres, . _ / -</small>
      </label>
      <label class="field">
        <span>Durée standard (minutes)</span>
        <input v-model="form.duration" class="input" type="number" min="5" max="1440" step="5" placeholder="120" />
      </label>
      <label class="field full">
        <span>Titre</span>
        <input v-model="form.title" class="input" required maxlength="200" placeholder="Sécurité incendie" />
      </label>
      <label class="field full">
        <span>Description</span>
        <textarea v-model="form.description" class="input" maxlength="2000" rows="3" />
      </label>
      <label class="checkbox full"><input v-model="form.active" type="checkbox" /> Formation active</label>
      <p v-if="error" class="form-error full" role="alert">{{ error }}</p>
    </form>
    <template #footer>
      <button class="btn" type="button" @click="emit('close')">Annuler</button>
      <button class="btn btn-primary" type="submit" form="training-form" :disabled="saving">Enregistrer</button>
    </template>
  </AppModal>
</template>
