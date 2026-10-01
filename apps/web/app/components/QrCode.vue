<script setup lang="ts">
import QRCode from "qrcode";

/** QR rendu en SVG côté navigateur : le contenu (TRN1:<token>) ne quitte jamais la page. */
const props = withDefaults(defineProps<{ value: string; size?: number }>(), { size: 160 });
const svg = ref("");

watch(
  () => props.value,
  async (value) => {
    svg.value = await QRCode.toString(value, { type: "svg", errorCorrectionLevel: "M", margin: 1, color: { dark: "#000000", light: "#ffffff" } });
  },
  { immediate: true },
);
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -- SVG généré localement par la bibliothèque qrcode -->
  <div class="qr" :style="{ width: `${size}px`, height: `${size}px` }" role="img" aria-label="QR de présence" v-html="svg" />
</template>

<style scoped>
.qr :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
