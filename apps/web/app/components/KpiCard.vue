<script setup lang="ts">
defineProps<{ label: string; value: string | number; hint?: string; tone?: "success" | "warning" | "danger" }>();
</script>

<template>
  <div class="card kpi">
    <span class="kpi-label">{{ label }}</span>
    <strong class="kpi-value" :class="tone ? `kpi-${tone}` : ''">{{ value }}</strong>
    <span v-if="hint" class="subtle">{{ hint }}</span>
  </div>
</template>

<style scoped>
.kpi {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 1rem 1.15rem;
}

.kpi-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--muted);
}

.kpi-value {
  font-size: 1.75rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.kpi-success {
  color: var(--success);
}

.kpi-warning {
  color: var(--warning);
}

.kpi-danger {
  color: var(--danger);
}
</style>
