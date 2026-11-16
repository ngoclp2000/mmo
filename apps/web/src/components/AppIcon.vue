<script setup lang="ts">
withDefaults(defineProps<{ name: string; size?: number }>(), { size: 20 });
const paths: Record<string, string> = {
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  chart: 'M3 3v18h18 M7 14l4-4 4 3 6-8',
  eye: 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12 M9 12a3 3 0 106 0 3 3 0 10-6 0',
  bell: 'M18 8a6 6 0 00-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4',
  box: 'M3 7l9-5 9 5v10l-9 5-9-5z M3 7l9 5 9-5 M12 12v10',
  arrow: 'M5 12h14 M13 6l6 6-6 6',
  plus: 'M12 5v14 M5 12h14',
  search: 'M10 3a7 7 0 110 14 7 7 0 010-14 M15 15l6 6',
  chevron: 'M7 10l5 5 5-5',
  check: 'M5 12l4 4L19 6',
  close: 'M6 6l12 12 M18 6L6 18',
  link: 'M10 13a5 5 0 007 0l3-3a5 5 0 00-7-7l-2 2 M14 11a5 5 0 00-7 0l-3 3a5 5 0 007 7l2-2',
  clock: 'M12 8v5l3 2 M12 2a10 10 0 110 20 10 10 0 010-20',
  external:
    'M14 3h7v7 M21 3l-11 11 M10 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-5',
  logout: 'M9 3H4v18h5 M10 12h11 M17 8l4 4-4 4',
  pulse: 'M2 12h5l3-8 4 16 3-8h5',
  info: 'M12 11v6 M12 7h.01 M12 2a10 10 0 110 20 10 10 0 010-20',
  shield: 'M12 2l9 4v6c0 6-9 10-9 10S3 18 3 12V6z M8 12l3 3 5-6',
  down: 'M5 8l7 7 7-7',
  spark: 'M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3z',
  refresh: 'M20 7V2l-3 3a8 8 0 10 3 11 M20 7h-5',
  pause: 'M8 5v14 M16 5v14',
  play: 'M7 4l14 8-14 8z',
};
</script>
<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="paths[name] ?? paths.grid" />
  </svg>
</template>
