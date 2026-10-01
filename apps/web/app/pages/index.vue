<script setup lang="ts">
import { diffDays, monthLabel, presetPeriod, type PeriodPreset } from "@tm/analytics";
import type { DashboardStats, TrainingDTO } from "@tm/shared-types";

const api = useApi();
const toast = useToast();
const fmt = useFormat();

const period = ref<{ from: string; to: string; preset: PeriodPreset | "custom" }>({ ...presetPeriod("30d", fmt.today()), preset: "30d" });
const trainingId = ref("");
const trainerId = ref("");
const department = ref("");
const granularity = ref<"day" | "week" | "month">("day");
const stats = ref<DashboardStats | null>(null);
const loading = ref(false);
const trainings = ref<TrainingDTO[]>([]);
const trainers = ref<{ id: string; displayName: string }[]>([]);
const departments = ref<string[]>([]);

async function load() {
  loading.value = true;
  try {
    stats.value = await api.stats.dashboard({
      from: period.value.from,
      to: period.value.to,
      trainingId: trainingId.value || undefined,
      trainerId: trainerId.value || undefined,
      department: department.value || undefined,
    });
  } catch (e) {
    toast.error(e);
  } finally {
    loading.value = false;
  }
}

// Granularité adaptée à la longueur de la période.
watch(
  () => [period.value.from, period.value.to],
  () => {
    const days = diffDays(period.value.from, period.value.to) + 1;
    granularity.value = days <= 45 ? "day" : days <= 200 ? "week" : "month";
  },
  { immediate: true },
);
watch([period, trainingId, trainerId, department], load, { deep: true });

onMounted(async () => {
  load();
  const [t, u, p] = await Promise.all([
    api.trainings.list({ includeInactive: true }),
    api.users.trainers(),
    api.participants.list({ includeInactive: true, limit: 500 }),
  ]).catch(() => [null, null, null] as const);
  trainings.value = t?.items ?? [];
  trainers.value = u?.items ?? [];
  departments.value = [...new Set((p?.items ?? []).map((x) => x.department).filter((d): d is string => !!d))].sort();
});

const summary = computed(() => stats.value?.summary);
const series = computed(() => {
  const s = stats.value;
  if (!s) return [];
  return granularity.value === "day" ? s.byDay : granularity.value === "week" ? s.byWeek : s.byMonth;
});
const seriesLabel = (key: string) =>
  granularity.value === "day" ? fmt.formatDateKey(key).slice(0, 5) : granularity.value === "week" ? key.replace(/^\d{4}-W/, "S") : monthLabel(key);

const timeChart = computed(() =>
  columnChart(series.value.map((p) => seriesLabel(p.key)), series.value.map((p) => p.participants), "Participations"),
);
const trainingChart = computed(() =>
  horizontalBarChart(
    (stats.value?.byTraining ?? []).map((r) => r.title),
    (stats.value?.byTraining ?? []).map((r) => r.participants),
    "Participations",
  ),
);
const departmentChart = computed(() =>
  horizontalBarChart(
    (stats.value?.byDepartment ?? []).map((r) => r.department),
    (stats.value?.byDepartment ?? []).map((r) => r.participants),
    "Participations",
  ),
);
const hasData = computed(() => (summary.value?.sessions ?? 0) > 0);
const rateTone = computed(() => {
  const r = summary.value?.attendanceRate;
  return r === null || r === undefined ? undefined : r >= 90 ? "success" : r >= 75 ? "warning" : "danger";
});
const periodText = computed(() => `${fmt.formatDateKey(period.value.from)} – ${fmt.formatDateKey(period.value.to)}`);
</script>

<template>
  <div>
    <PageHeader title="Dashboard" :subtitle="periodText" />

    <div class="card filters">
      <PeriodPicker v-model="period" />
      <div class="row">
        <select v-model="trainingId" class="input select" aria-label="Formation">
          <option value="">Toutes les formations</option>
          <option v-for="t in trainings" :key="t.id" :value="t.id">{{ t.title }}</option>
        </select>
        <select v-model="trainerId" class="input select" aria-label="Formateur">
          <option value="">Tous les formateurs</option>
          <option v-for="t in trainers" :key="t.id" :value="t.id">{{ t.displayName }}</option>
        </select>
        <select v-model="department" class="input select" aria-label="Département">
          <option value="">Tous les départements</option>
          <option v-for="d in departments" :key="d" :value="d">{{ d }}</option>
        </select>
      </div>
    </div>

    <div class="stack" :class="{ loading }">
      <div class="grid grid-4">
        <KpiCard label="Sessions" :value="fmt.number(summary?.sessions ?? 0)" :hint="`${fmt.hours(summary?.trainingHours ?? 0)} de formation`" />
        <KpiCard label="Participations" :value="fmt.number(summary?.participations ?? 0)" hint="présences validées" />
        <KpiCard label="Participants uniques" :value="fmt.number(summary?.uniqueParticipants ?? 0)" hint="personnes formées" />
        <KpiCard label="Heures-participants" :value="fmt.number(summary?.participantHours ?? 0)" hint="durée × présents" />
      </div>

      <ChartCard
        title="Participations"
        :subtitle="granularity === 'day' ? 'Par jour' : granularity === 'week' ? 'Par semaine ISO' : 'Par mois'"
        :columns="['Période', 'Sessions', 'Participations', 'Heures-participants']"
        :rows="series.map((p) => [seriesLabel(p.key), p.sessions, p.participants, p.participantHours])"
        :empty="!hasData"
      >
        <template #actions>
          <div class="segmented" role="group" aria-label="Granularité">
            <button type="button" :class="{ active: granularity === 'day' }" @click="granularity = 'day'">Jour</button>
            <button type="button" :class="{ active: granularity === 'week' }" @click="granularity = 'week'">Semaine</button>
            <button type="button" :class="{ active: granularity === 'month' }" @click="granularity = 'month'">Mois</button>
          </div>
        </template>
        <VChart :option="timeChart" autoresize style="height: 280px" />
      </ChartCard>

      <div class="grid grid-2">
        <ChartCard
          title="Par formation"
          subtitle="Participations par type de formation"
          :columns="['Formation', 'Sessions', 'Participations', 'Heures-participants']"
          :rows="(stats?.byTraining ?? []).map((r) => [`${r.title} (${r.reference})`, r.sessions, r.participants, r.participantHours])"
          :empty="!hasData"
        >
          <VChart :option="trainingChart" autoresize :style="{ height: horizontalChartHeight(stats?.byTraining.length ?? 0) }" />
        </ChartCard>
        <ChartCard
          title="Par département"
          subtitle="Participations par département"
          :columns="['Département', 'Participations', 'Personnes']"
          :rows="(stats?.byDepartment ?? []).map((r) => [r.department, r.participants, r.uniqueParticipants])"
          :empty="!hasData"
        >
          <VChart :option="departmentChart" autoresize :style="{ height: horizontalChartHeight(stats?.byDepartment.length ?? 0) }" />
        </ChartCard>
      </div>

      <div class="grid grid-4">
        <KpiCard
          label="Taux de présence"
          :value="summary?.attendanceRate === null || summary?.attendanceRate === undefined ? '—' : `${summary.attendanceRate.toLocaleString('fr-CH')} %`"
          :tone="rateTone"
          :hint="`${summary?.participations ?? 0} présents sur ${summary?.expected ?? 0} attendus`"
        />
        <KpiCard label="Absences" :value="fmt.number(summary?.absences ?? 0)" hint="non justifiées" />
        <KpiCard label="Excusés" :value="fmt.number(summary?.excused ?? 0)" hint="absences justifiées" />
        <KpiCard
          label="Durée moyenne"
          :value="summary?.averageSessionMinutes ? `${summary.averageSessionMinutes} min` : '—'"
          :hint="`${fmt.hours(summary?.trainingHours ?? 0)} au total`"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.filters {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
  margin-bottom: 1rem;
}

.select {
  width: auto;
  max-width: 220px;
}

.loading {
  opacity: 0.6;
  transition: opacity 0.2s;
}
</style>
