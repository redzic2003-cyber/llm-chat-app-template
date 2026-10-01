<script setup lang="ts">
const { pending, settle } = useConfirm();
const value = ref("");
watch(pending, () => (value.value = ""));
</script>

<template>
  <AppModal :open="Boolean(pending)" :title="pending?.title ?? ''" width="460px" @close="settle(false)">
    <div class="stack">
      <p>{{ pending?.message }}</p>
      <label v-if="pending?.input" class="field">
        <span>{{ pending.input.label }}</span>
        <input v-model="value" class="input" :placeholder="pending.input.placeholder" maxlength="500" @keydown.enter="settle(true, value)" />
      </label>
    </div>
    <template #footer>
      <button class="btn" type="button" @click="settle(false)">Retour</button>
      <button class="btn" :class="pending?.danger ? 'btn-danger' : 'btn-primary'" type="button" @click="settle(true, value)">
        {{ pending?.confirmLabel ?? "Confirmer" }}
      </button>
    </template>
  </AppModal>
</template>
