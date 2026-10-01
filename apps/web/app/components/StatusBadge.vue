<script setup lang="ts">
import type { EnrollmentStatus, SessionStatus } from "@tm/shared-types";

const props = defineProps<{ session?: SessionStatus; enrollment?: EnrollmentStatus }>();
const info = computed(() =>
  props.session ? SESSION_STATUS[props.session] : props.enrollment ? ENROLLMENT_STATUS[props.enrollment] : { label: "", tone: "" },
);
</script>

<template>
  <span class="badge" :class="info.tone ? `badge-${info.tone}` : ''">{{ info.label }}</span>
</template>
