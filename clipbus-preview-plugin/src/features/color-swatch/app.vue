<script setup lang="ts">
import { computed } from "vue";
import { ctx } from "@clipbus/plugin-sdk/view";
import { useCard, useCardButton } from "../../shared/composables/useCard";
import { attachment, decodeColorPayload } from "./payload";

const card = useCard(attachment);
const payload = computed(() => decodeColorPayload(card.attachment.value.payload));

function wcagLevel(ratio: number): string {
  if (ratio >= 7) return "AAA";
  if (ratio >= 4.5) return "AA";
  return "—";
}

useCardButton("copy", async () => {
  if (!payload.value) return;
  const { hex, rgbString, hslString } = payload.value;
  await ctx.system.copyText({ text: `${hex}\n${rgbString}\n${hslString}` });
});
</script>

<template>
  <main class="shell">
    <section v-if="payload" class="content">
      <!-- Swatch block: background and label color are data-driven inline styles -->
      <div
        class="swatch"
        :style="{ background: payload.hex, color: payload.bestTextColor }"
      >
        <span class="swatch-label">{{ payload.hex }}</span>
      </div>

      <!-- Facts grid: HEX / RGB / HSL in monospace -->
      <div class="facts-grid">
        <template v-for="fact in payload.display.facts" :key="fact.label">
          <span class="fact-label">{{ fact.label }}</span>
          <span class="fact-value">{{ fact.value }}</span>
        </template>
      </div>

      <!-- Contrast row -->
      <div class="contrast-row">
        <div class="contrast-item">
          <span class="contrast-bg contrast-bg--white">White</span>
          <span class="contrast-ratio">{{ payload.contrastWhite.toFixed(1) }}:1</span>
          <span
            class="contrast-badge"
            :class="{
              'contrast-badge--pass': payload.contrastWhite >= 4.5,
              'contrast-badge--fail': payload.contrastWhite < 4.5,
            }"
          >{{ wcagLevel(payload.contrastWhite) }}</span>
        </div>
        <div class="contrast-item">
          <span class="contrast-bg contrast-bg--black">Black</span>
          <span class="contrast-ratio">{{ payload.contrastBlack.toFixed(1) }}:1</span>
          <span
            class="contrast-badge"
            :class="{
              'contrast-badge--pass': payload.contrastBlack >= 4.5,
              'contrast-badge--fail': payload.contrastBlack < 4.5,
            }"
          >{{ wcagLevel(payload.contrastBlack) }}</span>
        </div>
      </div>
    </section>
    <div v-else class="empty">No color detected</div>
  </main>
</template>

<style scoped>
.shell {
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: var(--clipbus-text-primary, #0f172a);
  font-size: 13px;
}

.content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Swatch: background and text color set by inline :style — those are data, not chrome */
.swatch {
  height: 120px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.swatch-label {
  font-family: "SF Mono", "Menlo", "Monaco", "Cascadia Code", monospace;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.facts-grid {
  background: var(--clipbus-surface-elevated, #f8fafc);
  border: 1px solid var(--clipbus-border, #e2e8f0);
  border-radius: 6px;
  padding: 8px 12px;
  display: grid;
  grid-template-columns: 3rem 1fr;
  row-gap: 4px;
  column-gap: 8px;
  align-items: baseline;
}

.fact-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--clipbus-text-secondary, #64748b);
}

.fact-value {
  font-family: "SF Mono", "Menlo", "Monaco", "Cascadia Code", monospace;
  font-size: 12px;
  color: var(--clipbus-text-primary, #0f172a);
}

.contrast-row {
  display: flex;
  gap: 8px;
}

.contrast-item {
  flex: 1;
  background: var(--clipbus-surface-elevated, #f8fafc);
  border: 1px solid var(--clipbus-border, #e2e8f0);
  border-radius: 6px;
  padding: 6px 10px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.contrast-bg {
  font-size: 11px;
  font-weight: 600;
  color: var(--clipbus-text-secondary, #64748b);
}

.contrast-ratio {
  font-family: "SF Mono", "Menlo", "Monaco", "Cascadia Code", monospace;
  font-size: 12px;
  color: var(--clipbus-text-primary, #0f172a);
  flex: 1;
}

.contrast-badge {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  border-radius: 3px;
  padding: 1px 5px;
}

.contrast-badge--pass {
  background: var(--clipbus-accent, #7c3aed);
  color: var(--clipbus-accent-contrast, #ffffff);
}

.contrast-badge--fail {
  background: var(--clipbus-surface, #ffffff);
  border: 1px solid var(--clipbus-border, #e2e8f0);
  color: var(--clipbus-text-tertiary, #94a3b8);
}

.empty {
  padding: 20px;
  text-align: center;
  color: var(--clipbus-text-tertiary, #94a3b8);
  font-size: 13px;
}
</style>
