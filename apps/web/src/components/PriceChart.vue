<script setup lang="ts">
import { computed } from 'vue';
import type { Observation } from '../types';
const props = defineProps<{ history: Observation[] }>();
const samples = computed(() =>
  [...props.history]
    .filter((p) => p.currency === 'VND')
    .sort((a, b) => +new Date(a.observed_at) - +new Date(b.observed_at)),
);
const low = computed(
  () => Math.min(...samples.value.map((p) => Number(p.amount))) * 0.9,
);
const high = computed(
  () => Math.max(...samples.value.map((p) => Number(p.amount))) * 1.05,
);
const points = computed(() =>
  samples.value
    .map(
      (p, i) =>
        `${30 + i * (540 / Math.max(1, samples.value.length - 1))},${160 - ((Number(p.amount) - low.value) / (high.value - low.value || 1)) * 130}`,
    )
    .join(' '),
);
</script>
<template>
  <div class="price-chart">
    <svg
      v-if="samples.length"
      viewBox="0 0 600 190"
      role="img"
      aria-label="Lịch sử giá quan sát synthetic"
    >
      <path
        d="M25 35H575 M25 95H575 M25 155H575"
        stroke="#e9ece6"
        stroke-dasharray="4 4"
      />
      <polygon
        :points="`30,170 ${points} ${30 + (samples.length - 1) * (540 / Math.max(1, samples.length - 1))},170`"
        fill="#e4efe7"
      />
      <polyline
        :points="points"
        fill="none"
        stroke="#28634f"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <g v-for="(p, i) in samples" :key="p.id">
        <circle
          :cx="30 + i * (540 / Math.max(1, samples.length - 1))"
          :cy="160 - ((Number(p.amount) - low) / (high - low || 1)) * 130"
          r="4"
          fill="#28634f"
        />
      </g>
    </svg>
    <p v-else>Chưa có quan sát VND.</p>
    <div class="chart-caption">
      <span>Từ lần quan sát mẫu đầu tiên</span
      ><span>{{ samples.length }} mẫu · VND · Chưa gồm vận chuyển/voucher</span>
    </div>
  </div>
</template>
