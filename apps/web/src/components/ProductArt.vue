<script setup lang="ts">
defineProps<{ kind: string; color?: string }>();
</script>
<template>
  <svg
    class="product-art"
    viewBox="0 0 360 230"
    role="img"
    :aria-label="
      kind === 'sneaker'
        ? 'Minh họa giày mẫu'
        : kind === 'headphones'
          ? 'Minh họa tai nghe mẫu'
          : 'Minh họa balo mẫu'
    "
  >
    <ellipse cx="180" cy="199" rx="106" ry="12" fill="#27372e" opacity=".08" />
    <g
      v-if="kind === 'sneaker'"
      transform="translate(27 31) rotate(-10 150 100)"
    >
      <path
        d="M35 104C38 80 51 61 66 50L91 65 117 74 145 57C148 78 156 88 183 96L237 114C261 120 276 130 279 145L275 164H38L24 149Z"
        fill="#e9e2d2"
        stroke="#c8c0ad"
        stroke-width="2"
      />
      <path
        d="M29 145C92 157 215 150 279 145L275 164Q146 176 29 162Z"
        fill="#fffdf7"
        stroke="#d0c9b9"
        stroke-width="2"
      />
      <path d="M55 61L78 80 62 117 33 122" fill="#c6c1ac" />
      <path d="M111 78L159 100 143 132 91 114Z" fill="#f7f4e9" />
      <path
        d="M142 116Q187 112 223 130L181 128 145 138 129 133Z"
        fill="#315749"
      />
      <path
        d="M103 80l38 17 M98 89l38 17 M92 99l38 17"
        stroke="#b8ae95"
        stroke-width="4"
      />
      <path
        d="M42 158h33 M87 160h33 M133 160h33 M179 158h33 M224 155h33"
        stroke="#b8b5a8"
        stroke-width="2"
      />
      <path
        d="M68 51Q60 75 80 79"
        fill="none"
        stroke="#8a9688"
        stroke-width="5"
      />
    </g>
    <g
      v-else-if="kind === 'headphones'"
      transform="translate(75 15) rotate(-8 100 100)"
    >
      <path
        d="M34 126V83C34 0 176 0 176 83v43"
        fill="none"
        stroke="#303941"
        stroke-width="23"
      />
      <path
        d="M38 83C38 12 172 12 172 83"
        fill="none"
        stroke="#697780"
        stroke-width="9"
      />
      <rect x="14" y="99" width="48" height="85" rx="22" fill="#263139" />
      <rect x="21" y="104" width="33" height="75" rx="16" fill="#4b5963" />
      <rect x="151" y="99" width="48" height="85" rx="22" fill="#263139" />
      <rect x="156" y="103" width="35" height="77" rx="16" fill="#566570" />
      <path d="M166 118v40" stroke="#73838d" stroke-width="3" />
      <circle cx="174" cy="171" r="2" fill="#a4bfaa" />
    </g>
    <g v-else transform="translate(94 10) rotate(6 85 100)">
      <path
        d="M47 53V34C47 8 118 8 118 34v19"
        fill="none"
        stroke="#4c5e45"
        stroke-width="10"
      />
      <path
        d="M22 74Q23 45 48 43H124Q150 45 151 76L157 180Q157 197 140 198H27Q11 197 13 180Z"
        fill="#6d7b5a"
        stroke="#4f6044"
        stroke-width="2"
      />
      <path
        d="M29 71Q85 49 140 71"
        fill="none"
        stroke="#b4b997"
        stroke-width="3"
      />
      <rect
        x="32"
        y="109"
        width="105"
        height="68"
        rx="13"
        fill="#84916c"
        stroke="#566846"
        stroke-width="2"
      />
      <path d="M35 127h99" stroke="#4e6141" stroke-width="3" />
      <path d="M123 127v13" stroke="#d7cba9" stroke-width="4" />
      <rect x="67" y="86" width="36" height="15" rx="2" fill="#dbd5b6" />
      <path d="M23 77L18 178 M144 77l8 102" stroke="#a2aa88" stroke-width="2" />
    </g>
  </svg>
</template>
