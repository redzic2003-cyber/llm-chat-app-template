<script setup lang="ts">
/** Carte de graphique avec bascule vers une vue tableau (équivalent accessible). */
defineProps<{
  title: string;
  subtitle?: string;
  columns: string[];
  rows: (string | number)[][];
  empty?: boolean;
}>();
const asTable = ref(false);
</script>

<template>
  <section class="card chart-card">
    <header class="card-header">
      <div>
        <h2>{{ title }}</h2>
        <p v-if="subtitle" class="subtle">{{ subtitle }}</p>
      </div>
      <div class="row">
        <slot name="actions" />
        <div class="segmented" role="group" aria-label="Affichage">
          <button type="button" :class="{ active: !asTable }" @click="asTable = false">Graphique</button>
          <button type="button" :class="{ active: asTable }" @click="asTable = true">Tableau</button>
        </div>
      </div>
    </header>
    <div class="card-body">
      <EmptyState v-if="empty" title="Aucune donnée" text="Aucune session comptabilisée sur cette période." />
      <div v-else-if="asTable" class="table-wrap chart-table">
        <table class="table">
          <thead>
            <tr>
              <th v-for="(c, i) in columns" :key="c" :class="{ 'text-right': i > 0 }">{{ c }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in rows" :key="i">
              <td v-for="(cell, j) in r" :key="j" :class="{ 'text-right': j > 0 }" style="font-variant-numeric: tabular-nums">{{ cell }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <slot v-else />
    </div>
  </section>
</template>

<style scoped>
.chart-card {
  min-width: 0;
}

.chart-table {
  max-height: 320px;
  overflow-y: auto;
}
</style>
