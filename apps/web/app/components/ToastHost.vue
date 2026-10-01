<script setup lang="ts">
const { toasts, dismiss } = useToast();
</script>

<template>
  <div class="toasts no-print" aria-live="polite">
    <div v-for="t in toasts" :key="t.id" class="toast" :class="`toast-${t.tone}`" role="status" @click="dismiss(t.id)">
      <AppIcon :name="t.tone === 'success' ? 'check' : t.tone === 'error' ? 'x' : 'refresh'" />
      <span>{{ t.message }}</span>
    </div>
  </div>
</template>

<style scoped>
.toasts {
  position: fixed;
  right: 1rem;
  bottom: 1rem;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-width: min(420px, calc(100vw - 2rem));
}

.toast {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-lg);
  font-size: 0.9rem;
  cursor: pointer;
}

.toast-success {
  border-left: 4px solid var(--success);
}

.toast-success svg {
  color: var(--success);
}

.toast-error {
  border-left: 4px solid var(--danger);
}

.toast-error svg {
  color: var(--danger);
}

.toast-info {
  border-left: 4px solid var(--accent);
}
</style>
