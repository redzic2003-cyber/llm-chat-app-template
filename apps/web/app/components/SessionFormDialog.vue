<script setup lang="ts">
import type { SessionDTO, TrainingDTO } from "@tm/shared-types";

const props = defineProps<{
  open: boolean;
  session?: SessionDTO | null;
  /** Créneau présélectionné (depuis le calendrier). */
  slot?: { date: string; start: string; end: string } | null;
}>();
const emit = defineEmits<{ close: []; saved: [session: SessionDTO] }>();

const api = useApi();
const toast = useToast();
const fmt = useFormat();
const { user, can } = useAuth();

const trainings = ref<TrainingDTO[]>([]);
const trainers = ref<{ id: string; displayName: string }[]>([]);
const error = ref("");
const saving = ref(false);
const form = reactive({ trainingId: "", trainerId: "", date: "", start: "08:00", end: "10:00", location: "", status: "planned" as "draft" | "planned", notes: "" });

const editing = computed(() => Boolean(props.session));

function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  const total = Math.min(23 * 60 + 59, h * 60 + m + minutes);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

watch(
  () => props.open,
  async (open) => {
    if (!open) return;
    error.value = "";
    const s = props.session;
    Object.assign(form, {
      trainingId: s?.training.id ?? "",
      trainerId: s?.trainer.id ?? user.value?.id ?? "",
      date: s ? fmt.dateKey(s.startsAt) : (props.slot?.date ?? fmt.today()),
      start: s ? fmt.time(s.startsAt) : (props.slot?.start ?? "08:00"),
      end: s ? fmt.time(s.endsAt) : (props.slot?.end ?? "10:00"),
      location: s?.location ?? "",
      status: s?.status === "draft" ? "draft" : "planned",
      notes: s?.notes ?? "",
    });
    try {
      const [t, u] = await Promise.all([api.trainings.list(), can("sessions:manage-any") ? api.users.trainers() : Promise.resolve({ items: [] })]);
      trainings.value = t.items;
      trainers.value = u.items;
    } catch (e) {
      toast.error(e);
    }
  },
  { immediate: true },
);

function onTrainingChange() {
  const t = trainings.value.find((x) => x.id === form.trainingId);
  if (t?.defaultDurationMinutes && !editing.value) form.end = addMinutes(form.start, t.defaultDurationMinutes);
}

async function submit() {
  error.value = "";
  if (!form.trainingId) return (error.value = "Choisissez une formation.");
  if (form.end <= form.start) return (error.value = "L'heure de fin doit suivre l'heure de début.");
  saving.value = true;
  const body = {
    trainingId: form.trainingId,
    trainerId: can("sessions:manage-any") ? form.trainerId || undefined : undefined,
    startsAt: fmt.toUtc(form.date, form.start),
    endsAt: fmt.toUtc(form.date, form.end),
    location: form.location || null,
    notes: form.notes || null,
    status: form.status,
  };
  try {
    const saved = props.session ? await api.sessions.update(props.session.id, body) : await api.sessions.create(body);
    toast.success(props.session ? "Session mise à jour." : "Session planifiée.");
    emit("saved", saved);
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <AppModal :open="open" :title="editing ? 'Modifier la session' : 'Planifier une session'" @close="emit('close')">
    <form id="session-form" class="form-grid" @submit.prevent="submit">
      <label class="field full">
        <span>Formation</span>
        <select v-model="form.trainingId" class="input" required @change="onTrainingChange">
          <option value="" disabled>Choisir…</option>
          <option v-for="t in trainings" :key="t.id" :value="t.id">{{ t.title }} — {{ t.reference }}</option>
        </select>
      </label>
      <label class="field full">
        <span>Date</span>
        <input v-model="form.date" class="input" type="date" required />
      </label>
      <label class="field">
        <span>Début</span>
        <input v-model="form.start" class="input" type="time" step="300" required />
      </label>
      <label class="field">
        <span>Fin</span>
        <input v-model="form.end" class="input" type="time" step="300" required />
      </label>
      <label class="field">
        <span>Lieu</span>
        <input v-model="form.location" class="input" maxlength="200" placeholder="Local EHS" />
      </label>
      <label v-if="can('sessions:manage-any')" class="field">
        <span>Formateur</span>
        <select v-model="form.trainerId" class="input">
          <option v-for="t in trainers" :key="t.id" :value="t.id">{{ t.displayName }}</option>
        </select>
      </label>
      <label v-if="!editing || session?.status === 'draft' || session?.status === 'planned'" class="field">
        <span>Statut</span>
        <select v-model="form.status" class="input">
          <option value="planned">Planifiée</option>
          <option value="draft">Brouillon</option>
        </select>
      </label>
      <label class="field full">
        <span>Notes</span>
        <textarea v-model="form.notes" class="input" maxlength="2000" rows="2" />
      </label>
      <p v-if="error" class="form-error full" role="alert">{{ error }}</p>
    </form>
    <template #footer>
      <button class="btn" type="button" @click="emit('close')">Annuler</button>
      <button class="btn btn-primary" type="submit" form="session-form" :disabled="saving">{{ editing ? "Enregistrer" : "Planifier" }}</button>
    </template>
  </AppModal>
</template>
