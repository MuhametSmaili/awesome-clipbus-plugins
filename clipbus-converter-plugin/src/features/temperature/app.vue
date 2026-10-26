<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { ctx } from "@clipbus/plugin-sdk/view";
import { autoFit } from "@clipbus/plugin-sdk/dom";
import { useCard } from "../../shared/composables/useCard";
import { attachment, decodeTemperaturePayload } from "./payload";

// autoFit must observe this renderer's own root (content-sized), not document.body —
// in the dev preview workbench document.body is the whole page, so without a target
// autoFit never converges and spams setHeight every frame.
const rootEl = ref<HTMLElement | null>(null);

const card = useCard(attachment);
const payload = computed(() =>
  decodeTemperaturePayload(card.attachment.value.payload)
);

const sourceDisplay = computed(() => {
  if (!payload.value) return "";
  const { sourceValue, sourceScale } = payload.value;
  if (sourceScale === "K") return `${sourceValue} K`;
  return `${sourceValue}°${sourceScale}`;
});

const scaleLabel = computed(() => {
  if (!payload.value) return "";
  const map = { C: "Celsius", F: "Fahrenheit", K: "Kelvin" } as const;
  return map[payload.value.sourceScale];
});

const rows = computed(() => {
  if (!payload.value) return [];
  return [
    { scale: "C" as const, label: "Celsius", value: payload.value.celsius, unit: "°C" },
    { scale: "F" as const, label: "Fahrenheit", value: payload.value.fahrenheit, unit: "°F" },
    { scale: "K" as const, label: "Kelvin", value: payload.value.kelvin, unit: " K" },
  ];
});

async function copy(text: string) {
  await ctx.system.copyText({ text });
}

let stopAutoFit: (() => void) | null = null;

onMounted(() => {
  stopAutoFit = autoFit({ min: 140, max: 300, target: rootEl.value ?? undefined });
});

onUnmounted(() => {
  stopAutoFit?.();
});
</script>

<template>
  <main ref="rootEl" class="shell">
    <section v-if="payload" class="content">
      <div class="meta-row">
        <span class="badge">Temperature</span>
      </div>
      <div class="source-display">
        {{ sourceDisplay }}
        <span class="source-label">{{ scaleLabel }}</span>
      </div>
      <div class="facts">
        <div
          v-for="row in rows"
          :key="row.scale"
          class="fact-row"
          :class="{ 'fact-row--source': row.scale === payload!.sourceScale }"
        >
          <span class="fact-label">{{ row.label }}</span>
          <span class="fact-value mono">{{ row.value }}{{ row.unit }}</span>
          <button class="copy-btn" @click="copy(String(row.value))">Copy</button>
        </div>
        <div v-if="payload.belowAbsoluteZero" class="fact-row warning-row">
          <span class="fact-label"></span>
          <span class="fact-note">Below absolute zero — physically impossible</span>
        </div>
      </div>
    </section>
    <div v-else class="empty">Waiting for temperature value</div>
  </main>
</template>

<style scoped>
.shell {
  /* root container: no background, no padding — host already provides spacing */
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  color: var(--clipbus-text-primary, #0f172a);
  font-size: 13px;
}

.content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.meta-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.badge {
  background: var(--clipbus-accent, #7c3aed);
  color: var(--clipbus-accent-contrast, #ffffff);
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.source-display {
  font-size: 15px;
  font-weight: 600;
  color: var(--clipbus-text-primary, #0f172a);
  line-height: 1.4;
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.source-label {
  font-size: 12px;
  font-weight: 400;
  color: var(--clipbus-text-secondary, #64748b);
}

.facts {
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: var(--clipbus-surface-elevated, #f8fafc);
  border: 1px solid var(--clipbus-border, #e2e8f0);
  border-radius: 6px;
  padding: 8px 12px;
}

.fact-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.fact-label {
  font-size: 11px;
  color: var(--clipbus-text-tertiary, #94a3b8);
  font-weight: 500;
  min-width: 84px;
  flex-shrink: 0;
}

.fact-row--source .fact-label {
  color: var(--clipbus-accent, #7c3aed);
  font-weight: 600;
}

.fact-value {
  font-size: 12px;
  color: var(--clipbus-text-primary, #0f172a);
  flex: 1;
}

.fact-value.mono {
  font-family: "SF Mono", "Menlo", "Monaco", "Cascadia Code", monospace;
}

.fact-row--source .fact-value {
  color: var(--clipbus-accent, #7c3aed);
  font-weight: 600;
}

.copy-btn {
  background: var(--clipbus-surface, #ffffff);
  border: 1px solid var(--clipbus-border, #e2e8f0);
  border-radius: 4px;
  color: var(--clipbus-text-secondary, #64748b);
  cursor: pointer;
  font-size: 10px;
  padding: 1px 6px;
  flex-shrink: 0;
}

.copy-btn:hover {
  background: var(--clipbus-surface-elevated, #f8fafc);
  color: var(--clipbus-text-primary, #0f172a);
}

.warning-row {
  margin-top: 2px;
  padding-top: 4px;
  border-top: 1px solid var(--clipbus-divider, #f1f5f9);
}

.fact-note {
  font-size: 11px;
  color: var(--clipbus-warning, #f59e0b);
  font-style: italic;
}

.empty {
  padding: 20px;
  text-align: center;
  color: var(--clipbus-text-tertiary, #94a3b8);
  font-size: 13px;
}
</style>
