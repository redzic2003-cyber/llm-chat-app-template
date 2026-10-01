<script setup lang="ts">
/** Fenêtre modale basée sur <dialog> (focus, Échap et accessibilité natifs). */
const props = withDefaults(defineProps<{ open: boolean; title: string; width?: string }>(), { width: "560px" });
const emit = defineEmits<{ close: [] }>();
const dialog = ref<HTMLDialogElement | null>(null);

watch(
  () => props.open,
  (open) => {
    if (!dialog.value) return;
    if (open && !dialog.value.open) dialog.value.showModal();
    if (!open && dialog.value.open) dialog.value.close();
  },
);
onMounted(() => {
  if (props.open) dialog.value?.showModal();
});
</script>

<template>
  <dialog ref="dialog" class="modal" :style="{ width: props.width }" @close="emit('close')" @cancel.prevent="emit('close')">
    <div v-if="props.open" class="modal-inner">
      <header class="modal-header">
        <h2>{{ props.title }}</h2>
        <button class="btn btn-ghost btn-sm" type="button" aria-label="Fermer" @click="emit('close')">
          <AppIcon name="x" />
        </button>
      </header>
      <div class="modal-body"><slot /></div>
      <footer v-if="$slots.footer" class="modal-footer"><slot name="footer" /></footer>
    </div>
  </dialog>
</template>

<style scoped>
.modal {
  max-width: calc(100vw - 2rem);
  max-height: calc(100vh - 2rem);
  padding: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-lg);
  color: var(--text);
}

.modal::backdrop {
  background: rgba(15, 23, 42, 0.38);
}

.modal-inner {
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 2rem);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.9rem 1.2rem;
  border-bottom: 1px solid var(--border);
}

.modal-body {
  padding: 1.2rem;
  overflow-y: auto;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.85rem 1.2rem;
  border-top: 1px solid var(--border);
  background: var(--surface-2);
}
</style>
