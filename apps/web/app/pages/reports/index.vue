<script setup lang="ts">
import { addDays, endOfMonth, isoWeek, startOfIsoWeek } from "@tm/analytics";
import type { PeriodReportType, ReportDTO } from "@tm/shared-types";

const api = useApi();
const toast = useToast();
const fmt = useFormat();
const { can } = useAuth();

const TYPE_LABELS: Record<string, string> = {
  weekly: "Hebdomadaire",
  monthly: "Mensuel",
  yearly: "Annuel",
  custom: "Période libre",
  session: "Session",
  participant: "Participant",
};

const today = fmt.today();
const lastMonth = addDays(`${today.slice(0, 7)}-01`, -1).slice(0, 7);
const type = ref<PeriodReportType>("monthly");
const weekDay = ref(addDays(today, -7));
const month = ref(lastMonth);
const year = ref(Number(today.slice(0, 4)));
const custom = ref({ from: addDays(today, -29), to: today });
const reports = ref<ReportDTO[]>([]);
const generating = ref(false);

const period = computed(() => {
  switch (type.value) {
    case "weekly": {
      const from = startOfIsoWeek(weekDay.value || today);
      return { from, to: addDays(from, 6) };
    }
    case "monthly":
      return { from: `${month.value}-01`, to: endOfMonth(`${month.value}-01`) };
    case "yearly":
      return { from: `${year.value}-01-01`, to: `${year.value}-12-31` };
    default:
      return custom.value;
  }
});
const periodHint = computed(() => {
  const p = period.value;
  const prefix = type.value === "weekly" ? `Semaine ${isoWeek(p.from).week} · ` : "";
  return `${prefix}${fmt.formatDateKey(p.from)} – ${fmt.formatDateKey(p.to)}`;
});

async function load() {
  try {
    reports.value = (await api.reports.list()).items;
  } catch (e) {
    toast.error(e);
  }
}
onMounted(load);

async function generate() {
  generating.value = true;
  try {
    const created = await api.reports.create({ type: type.value, ...period.value });
    toast.success(`Rapport généré : ${created.title}`);
    await load();
    window.open(api.reports.downloadUrl(created.id) + "?inline=1", "_blank", "noopener");
  } catch (e) {
    toast.error(e);
  } finally {
    generating.value = false;
  }
}
</script>

<template>
  <div>
    <PageHeader title="Rapports" subtitle="Bilans PDF générés à partir des présences validées" />

    <section v-if="can('reports:generate')" class="card card-body generator">
      <div class="row">
        <div class="segmented" role="group" aria-label="Type de rapport">
          <button v-for="t in ['weekly', 'monthly', 'yearly', 'custom'] as const" :key="t" type="button" :class="{ active: type === t }" @click="type = t">
            {{ TYPE_LABELS[t] }}
          </button>
        </div>
        <label v-if="type === 'weekly'" class="field inline"><span>Un jour de la semaine</span><input v-model="weekDay" class="input" type="date" /></label>
        <label v-else-if="type === 'monthly'" class="field inline"><span>Mois</span><input v-model="month" class="input" type="month" /></label>
        <label v-else-if="type === 'yearly'" class="field inline"><span>Année</span><input v-model.number="year" class="input" type="number" min="2000" max="2100" /></label>
        <template v-else>
          <label class="field inline"><span>Du</span><input v-model="custom.from" class="input" type="date" /></label>
          <label class="field inline"><span>Au</span><input v-model="custom.to" class="input" type="date" :min="custom.from" /></label>
        </template>
        <span class="spacer" />
        <span class="muted">{{ periodHint }}</span>
        <button class="btn btn-primary" type="button" :disabled="generating" @click="generate">
          <AppIcon name="file" /> {{ generating ? "Génération…" : "Générer le PDF" }}
        </button>
      </div>
      <p class="subtle">Les rapports de session et individuels se génèrent depuis la fiche de la session ou du participant.</p>
    </section>

    <section class="card">
      <header class="card-header"><h2>Rapports générés</h2></header>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Rapport</th>
              <th>Type</th>
              <th>Période</th>
              <th>Généré par</th>
              <th>Date</th>
              <th>Empreinte SHA-256</th>
              <th class="text-right" />
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in reports" :key="r.id">
              <td><strong>{{ r.title }}</strong></td>
              <td><span class="badge">{{ TYPE_LABELS[r.type] ?? r.type }}</span></td>
              <td class="nowrap">{{ fmt.formatDateKey(r.periodStart) }}<template v-if="r.periodEnd !== r.periodStart"> – {{ fmt.formatDateKey(r.periodEnd) }}</template></td>
              <td>{{ r.generatedBy.displayName }}</td>
              <td class="nowrap">{{ fmt.dateTime(r.createdAt) }}</td>
              <td class="mono subtle" :title="r.sha256">{{ r.sha256.slice(0, 12) }}…</td>
              <td class="text-right nowrap">
                <a class="btn btn-sm" :href="`${api.reports.downloadUrl(r.id)}?inline=1`" target="_blank" rel="noopener">Ouvrir</a>
                <a class="btn btn-sm" :href="api.reports.downloadUrl(r.id)" download><AppIcon name="download" :size="15" /> {{ fmt.bytes(r.sizeBytes) }}</a>
              </td>
            </tr>
          </tbody>
        </table>
        <EmptyState v-if="!reports.length" title="Aucun rapport" text="Générez un premier bilan ci-dessus." />
      </div>
    </section>
  </div>
</template>

<style scoped>
.generator {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.generator .row {
  align-items: flex-end;
}

.field.inline .input {
  width: auto;
}
</style>
