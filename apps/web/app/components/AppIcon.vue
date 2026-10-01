<script setup lang="ts">
/** Icônes SVG minimalistes (traits 1.8px, 20×20), sans dépendance externe. */
const props = withDefaults(defineProps<{ name: string; size?: number }>(), { size: 18 });

const PATHS: Record<string, string> = {
  dashboard: "M3 3h6v8H3zM11 3h6v5h-6zM11 10h6v7h-6zM3 13h6v4H3z",
  calendar: "M3 5h14v12H3zM3 9h14M7 3v4M13 3v4",
  book: "M4 4h9a3 3 0 0 1 3 3v10H7a3 3 0 0 1-3-3zM4 14a3 3 0 0 1 3-3h9",
  users: "M7 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 17c0-3 2.2-5 5-5s5 2 5 5M13 4a3 3 0 0 1 0 5M15 12c1.8.6 3 2.4 3 5",
  file: "M5 2h7l4 4v12H5zM12 2v4h4M8 11h6M8 14h6",
  settings: "M10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM10 1v3M10 16v3M1 10h3M16 10h3M3.5 3.5l2 2M14.5 14.5l2 2M3.5 16.5l2-2M14.5 5.5l2-2",
  logout: "M8 4H4v12h4M13 6l4 4-4 4M17 10H8",
  plus: "M10 4v12M4 10h12",
  qr: "M3 3h5v5H3zM12 3h5v5h-5zM3 12h5v5H3zM12 12h2v2h-2zM15 15h2v2h-2zM12 16h1M16 12h1",
  download: "M10 3v10M6 9l4 4 4-4M4 17h12",
  print: "M5 8V3h10v5M5 14H3V8h14v6h-2M5 12h10v6H5z",
  check: "M4 10.5l4 4 8-9",
  x: "M5 5l10 10M15 5L5 15",
  search: "M9 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM13.5 13.5L18 18",
  edit: "M4 16h3l9-9-3-3-9 9zM12 5l3 3",
  refresh: "M16 10a6 6 0 1 1-2-4.5M16 3v4h-4",
  upload: "M10 14V4M6 8l4-4 4 4M4 17h12",
  menu: "M3 5h14M3 10h14M3 15h14",
  chevronLeft: "M12 4l-6 6 6 6",
  more: "M5 10h.01M10 10h.01M15 10h.01",
};
</script>

<template>
  <svg
    :width="props.size"
    :height="props.size"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="PATHS[props.name] ?? ''" />
  </svg>
</template>
