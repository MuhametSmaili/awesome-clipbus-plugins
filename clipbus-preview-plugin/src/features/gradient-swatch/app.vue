<script setup lang="ts">
import { computed } from "vue";
import { ctx } from "@clipbus/plugin-sdk/view";
import { useCard, useCardButton } from "../../shared/composables/useCard";
import { attachment, decodeGradientPayload } from "./payload";

const card = useCard(attachment);
const payload = computed(() => decodeGradientPayload(card.attachment.value.payload));

useCardButton("copy-gradient", async () => {
  if (!payload.value) return;
  await ctx.system.copyText({ text: payload.value.gradient });
});
</script>

<template>
  <main class="shell">
    <section v-if="payload" class="content">
      <!-- Gradient swatch: background is data-driven via :style — not in the stylesheet -->
      <div class="swatch" :style="{ background: payload.gradient }" />

      <!-- Type label + angle/shape -->
      <div class="meta-row">
        <span class="type-badge">
          {{ payload.repeating ? "repeating-" : "" }}{{ payload.gradientType }}
        </span>
        <span v-if="payload.angleOrShape" class="angle-shape">
          {{ payload.angleOrShape }}
        </span>
      </div>

      <!-- Stop color chips -->
      <div v-if="payload.stops.length > 0" class="stops-row">
        <span class="stops-label">Stops</span>
        <div class="stops-chips">
          <span
            v-for="stop in payload.stops"
            :key="stop"
            class="stop-chip-wrap"
          >
            <!-- chip background is data, not chrome — safe via :style -->
            <span class="stop-chip" :style="{ background: stop }" />
            <span class="stop-value">{{ stop }}</span>
          </span>
        </div>
      </div>
    </section>
    <div v-else class="empty">No gradient detected</div>
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

/* Gradient swatch: background is set by data-driven inline :style, not here */
.swatch {
  height: 120px;
  border-radius: 8px;
}

.meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--clipbus-surface-elevated, #f8fafc);
  border: 1px solid var(--clipbus-border, #e2e8f0);
  border-radius: 6px;
  padding: 6px 12px;
}

.type-badge {
  font-family: "SF Mono", "Menlo", "Monaco", "Cascadia Code", monospace;
  font-size: 12px;
  font-weight: 600;
  color: var(--clipbus-accent, #7c3aed);
}

.angle-shape {
  font-family: "SF Mono", "Menlo", "Monaco", "Cascadia Code", monospace;
  font-size: 12px;
  color: var(--clipbus-text-secondary, #64748b);
}

.stops-row {
  background: var(--clipbus-surface-elevated, #f8fafc);
  border: 1px solid var(--clipbus-border, #e2e8f0);
  border-radius: 6px;
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.stops-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--clipbus-text-secondary, #64748b);
}

.stops-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.stop-chip-wrap {
  display: flex;
  align-items: center;
  gap: 4px;
}

.stop-chip {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  border: 1px solid var(--clipbus-border, #e2e8f0);
  display: inline-block;
  flex-shrink: 0;
}

.stop-value {
  font-family: "SF Mono", "Menlo", "Monaco", "Cascadia Code", monospace;
  font-size: 11px;
  color: var(--clipbus-text-primary, #0f172a);
}

.empty {
  padding: 20px;
  text-align: center;
  color: var(--clipbus-text-tertiary, #94a3b8);
  font-size: 13px;
}
</style>
