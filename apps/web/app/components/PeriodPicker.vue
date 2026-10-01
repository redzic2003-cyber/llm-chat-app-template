<script setup lang="ts">
import { presetPeriod, type PeriodPreset } from "@tm/analytics";

/** Sélecteur de période partagé par le dashboard et les rapports. */
const model = defineModel<{ from: string; to: string; preset: PeriodPreset | "custom" }>({ required: true });
const { today } = useFormat();

const PRESETS: { id: PeriodPreset | "custom"; label: string }[] = [
  { id: "7d", label: "7 jours" },
  { id: "30d", label: "30 jours" },
  { id: "month", label: "Mois courant" },
  { id: "quarter", label: "Trimestre" },
  { id: "year", label: "Année" },
  { id: "custom", label: "Personnalisée" },
];

function choose(id: PeriodPreset | "custom") {
  if (id === "custom") model.value = { ...model.value, preset: "custom" };
  else model.value = { ...presetPeriod(id, today()), preset: id };
}

function setDate(key: "from" | "to", value: string) {
  if (!value) return;
  const next = { ...model.value, [key]: value, preset: "custom" as const };
  if (next.to < next.from) {
    if (key === "from") next.to = value;
    else next.from = value;
  }
  model.value = next;
}
</script>

<template>
  <div class="row">
    <div class="segmented" role="group" aria-label="Période">
      <button v-for="p in PRESETS" :key="p.id" type="button" :class="{ active: model.preset === p.id }" @click="choose(p.id)">
        {{ p.label }}
      </button>
    </div>
    <div v-if="model.preset === 'custom'" class="row">
      <input class="input date" type="date" :value="model.from" aria-label="Du" @change="setDate('from', ($event.target as HTMLInputElement).value)" />
      <span class="muted">→</span>
      <input class="input date" type="date" :value="model.to" aria-label="Au" @change="setDate('to', ($event.target as HTMLInputElement).value)" />
    </div>
  </div>
</template>

<style scoped>
.date {
  width: auto;
}
</style>
