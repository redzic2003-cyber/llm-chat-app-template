<script setup lang="ts">
defineProps<{ title: string; text?: string }>();
</script>

<template>
  <div class="empty">
    <strong>{{ title }}</strong>
    <p v-if="text" class="muted">{{ text }}</p>
    <slot />
  </div>
</template>

<style scoped>
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 2.5rem 1rem;
  text-align: center;
}
</style>
