<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { autoFit } from "@clipbus/plugin-sdk/dom";
import { useCard } from "../../shared/composables/useCard";
import { attachment, decodeCronPayload, computeNextRuns } from "./payload";

// autoFit must observe this renderer's own root (content-sized), not document.body —
// in the dev preview workbench document.body is the whole page, so without a target
// autoFit never converges and spams setHeight every frame.
const rootEl = ref<HTMLElement | null>(null);

const card = useCard(attachment);
const payload = computed(() =>
  decodeCronPayload(card.attachment.value.payload)
);

// Refreshed every 30 s so "Next runs" stays accurate without a full reload.
const now = ref(Date.now());
let refreshTimer: ReturnType<typeof setInterval> | null = null;
let stopAutoFit: (() => void) | null = null;

onMounted(() => {
  stopAutoFit = autoFit({ min: 120, max: 560, target: rootEl.value ?? undefined });
  refreshTimer = setInterval(() => { now.value = Date.now(); }, 30_000);
});

onUnmounted(() => {
  stopAutoFit?.();
  if (refreshTimer !== null) clearInterval(refreshTimer);
});

const nextRuns = computed(() => {
  if (!payload.value) return [];
  return computeNextRuns(payload.value.fields, now.value, 5);
});

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatRunTime(ms: number): string {
  const d = new Date(ms);
  const wd = WEEKDAY_SHORT[d.getDay()] ?? "";
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const dy = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${wd}, ${yr}-${mo}-${dy} ${hh}:${mm}`;
}
</script>

<template>
  <main ref="rootEl" class="shell">
    <section v-if="payload" class="content">
      <div class="expression">{{ payload.expression }}</div>

      <table class="fields-table">
        <thead>
          <tr>
            <th class="col-name">Field</th>
            <th class="col-raw">Value</th>
            <th class="col-desc">Description</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="field in payload.fields" :key="field.name">
            <td class="col-name cell-name">{{ field.name }}</td>
            <td class="col-raw cell-raw">{{ field.raw }}</td>
            <td class="col-desc cell-desc">{{ field.description }}</td>
          </tr>
        </tbody>
      </table>

      <div class="summary">{{ payload.summary }}</div>

      <section class="next-runs">
        <div class="next-runs-label">Next runs</div>
        <ul v-if="nextRuns.length" class="runs-list">
          <li v-for="(ms, i) in nextRuns" :key="i" class="run-item">
            {{ formatRunTime(ms) }}
          </li>
        </ul>
        <div v-else class="runs-empty">No upcoming runs in the next few years.</div>
      </section>
    </section>
    <div v-else class="empty">Waiting for cron expression</div>
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
  gap: 10px;
}

.expression {
  font-family: "SF Mono", "Menlo", "Monaco", "Cascadia Code", monospace;
  font-size: 14px;
  font-weight: 600;
  color: var(--clipbus-accent, #b45309);
  background: color-mix(in srgb, var(--clipbus-accent, #b45309) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--clipbus-accent, #b45309) 24%, transparent);
  border-radius: 6px;
  padding: 6px 10px;
  letter-spacing: 0.06em;
}

.fields-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.fields-table th {
  text-align: left;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--clipbus-text-tertiary, #94a3b8);
  padding: 0 6px 4px 0;
  border-bottom: 1px solid var(--clipbus-border, #e2e8f0);
}

.fields-table td {
  padding: 5px 6px 5px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--clipbus-border, #e2e8f0) 60%, transparent);
  vertical-align: middle;
}

.fields-table tr:last-child td {
  border-bottom: none;
}

.col-name {
  width: 14%;
}

.col-raw {
  width: 22%;
}

.col-desc {
  width: 64%;
}

.cell-name {
  color: var(--clipbus-text-secondary, #64748b);
  font-weight: 500;
}

.cell-raw {
  font-family: "SF Mono", "Menlo", "Monaco", "Cascadia Code", monospace;
  color: var(--clipbus-text-primary, #0f172a);
}

.cell-desc {
  color: var(--clipbus-text-primary, #0f172a);
}

.summary {
  background: var(--clipbus-surface-elevated, #f8fafc);
  border: 1px solid var(--clipbus-border, #e2e8f0);
  border-radius: 6px;
  padding: 7px 10px;
  font-size: 12px;
  color: var(--clipbus-text-secondary, #64748b);
  line-height: 1.5;
}

.empty {
  padding: 20px;
  text-align: center;
  color: var(--clipbus-text-tertiary, #94a3b8);
  font-size: 13px;
}

.next-runs {
  background: var(--clipbus-surface-elevated, #f8fafc);
  border: 1px solid var(--clipbus-border, #e2e8f0);
  border-radius: 6px;
  padding: 7px 10px;
}

.next-runs-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--clipbus-text-tertiary, #94a3b8);
  margin-bottom: 5px;
}

.runs-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
  max-height: 140px;
  overflow-y: auto;
}

.run-item {
  font-family: "SF Mono", "Menlo", "Monaco", "Cascadia Code", monospace;
  font-size: 12px;
  color: var(--clipbus-text-primary, #0f172a);
}

.runs-empty {
  font-size: 12px;
  color: var(--clipbus-text-tertiary, #94a3b8);
  font-style: italic;
}
</style>
