<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { autoFit } from "@clipbus/plugin-sdk/dom";
import { useCard } from "../../shared/composables/useCard";
import { attachment, decodeFilesizePayload } from "./payload";

const rootEl = ref<HTMLElement | null>(null);

const card = useCard(attachment);
const payload = computed(() =>
  decodeFilesizePayload(card.attachment.value.payload)
);

let stopAutoFit: (() => void) | null = null;

onMounted(() => {
  stopAutoFit = autoFit({ min: 180, max: 420, target: rootEl.value ?? undefined });
});

onUnmounted(() => {
  stopAutoFit?.();
});
</script>

<template>
  <main ref="rootEl" class="shell">
    <section v-if="payload" class="content">
      <div class="meta-row">
        <span class="badge">Data Size</span>
        <span class="input-chip">{{ payload.input }}</span>
      </div>

      <div class="exact-row">
        <span class="exact-label">Exact bytes</span>
        <span class="exact-value mono">{{ payload.bytesFormatted }} B</span>
      </div>

      <div class="units-grid">
        <div class="unit-section">
          <div class="section-header">
            <span class="section-title">Decimal (SI)</span>
            <span class="section-sub">1 KB = 1,000 B</span>
          </div>
          <div class="natural-row">
            <span class="natural-value mono">{{ payload.naturalSI.value }}</span>
            <span class="natural-unit">{{ payload.naturalSI.unit }}</span>
          </div>
          <div class="ladder">
            <div v-for="u in payload.siUnits" :key="u.unit" class="ladder-row">
              <span class="ladder-unit">{{ u.unit }}</span>
              <span class="ladder-value mono">{{ u.value }}</span>
            </div>
          </div>
        </div>

        <div class="divider" />

        <div class="unit-section">
          <div class="section-header">
            <span class="section-title">Binary (IEC)</span>
            <span class="section-sub">1 KiB = 1,024 B</span>
          </div>
          <div class="natural-row">
            <span class="natural-value mono">{{ payload.naturalIEC.value }}</span>
            <span class="natural-unit">{{ payload.naturalIEC.unit }}</span>
          </div>
          <div class="ladder">
            <div v-for="u in payload.iecUnits" :key="u.unit" class="ladder-row">
              <span class="ladder-unit">{{ u.unit }}</span>
              <span class="ladder-value mono">{{ u.value }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
    <div v-else class="empty">Waiting for a data size (e.g. 1.5 GB, 500 MiB)</div>
  </main>
</template>

<style scoped>
.shell {
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
  flex-wrap: wrap;
}

.badge {
  background: var(--clipbus-accent, #0369a1);
  color: var(--clipbus-accent-contrast, #ffffff);
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  flex-shrink: 0;
}

.input-chip {
  background: var(--clipbus-surface-elevated, #f8fafc);
  border: 1px solid var(--clipbus-border, #e2e8f0);
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 11px;
  color: var(--clipbus-text-secondary, #64748b);
  font-family: "SF Mono", "Menlo", "Monaco", "Cascadia Code", monospace;
}

.exact-row {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--clipbus-surface-elevated, #f8fafc);
  border: 1px solid var(--clipbus-border, #e2e8f0);
  border-radius: 6px;
  padding: 6px 10px;
}

.exact-label {
  font-size: 11px;
  color: var(--clipbus-text-tertiary, #94a3b8);
  font-weight: 500;
  flex-shrink: 0;
}

.exact-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--clipbus-text-primary, #0f172a);
  font-family: "SF Mono", "Menlo", "Monaco", "Cascadia Code", monospace;
}

.units-grid {
  display: flex;
  gap: 0;
  background: var(--clipbus-surface-elevated, #f8fafc);
  border: 1px solid var(--clipbus-border, #e2e8f0);
  border-radius: 6px;
  overflow: hidden;
}

.unit-section {
  flex: 1;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.divider {
  width: 1px;
  background: var(--clipbus-border, #e2e8f0);
  flex-shrink: 0;
}

.section-header {
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin-bottom: 4px;
}

.section-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--clipbus-text-secondary, #64748b);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.section-sub {
  font-size: 10px;
  color: var(--clipbus-text-tertiary, #94a3b8);
}

.natural-row {
  display: flex;
  align-items: baseline;
  gap: 3px;
  margin-bottom: 4px;
}

.natural-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--clipbus-text-primary, #0f172a);
  font-family: "SF Mono", "Menlo", "Monaco", "Cascadia Code", monospace;
  line-height: 1.1;
}

.natural-unit {
  font-size: 12px;
  font-weight: 600;
  color: var(--clipbus-text-secondary, #64748b);
}

.ladder {
  display: flex;
  flex-direction: column;
  gap: 2px;
  border-top: 1px solid var(--clipbus-border, #e2e8f0);
  padding-top: 4px;
}

.ladder-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
}

.ladder-unit {
  font-size: 10px;
  color: var(--clipbus-text-tertiary, #94a3b8);
  min-width: 28px;
  flex-shrink: 0;
}

.ladder-value {
  font-size: 10px;
  color: var(--clipbus-text-secondary, #64748b);
  font-family: "SF Mono", "Menlo", "Monaco", "Cascadia Code", monospace;
  text-align: right;
}

.mono {
  font-family: "SF Mono", "Menlo", "Monaco", "Cascadia Code", monospace;
}

.empty {
  padding: 20px;
  text-align: center;
  color: var(--clipbus-text-tertiary, #94a3b8);
  font-size: 13px;
}
</style>
