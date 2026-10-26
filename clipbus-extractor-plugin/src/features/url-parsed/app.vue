<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { ctx } from "@clipbus/plugin-sdk/view";
import { autoFit } from "@clipbus/plugin-sdk/dom";
import { useCard } from "../../shared/composables/useCard";
import { attachment, decodeUrlPayload } from "./payload";

// autoFit must observe this renderer's own root (content-sized), not document.body —
// in the dev preview workbench document.body is the whole page, so without a target
// autoFit never converges and spams height updates every frame.
const rootEl = ref<HTMLElement | null>(null);

const { attachment: currentAttachment } = useCard(attachment);
const payload = computed(() =>
  decodeUrlPayload(currentAttachment.value.payload)
);

const queryJson = computed(() => {
  if (!payload.value || payload.value.query.length === 0) return null;
  return payload.value.queryJson;
});

const trackingKeySet = computed(() => {
  if (!payload.value) return new Set<string>();
  return new Set(payload.value.trackingParams.map((p) => p.key));
});

const hasTracking = computed(
  () => (payload.value?.trackingParams.length ?? 0) > 0
);

let unsub: (() => void) | null = null;
let stopAutoFit: (() => void) | null = null;

onMounted(() => {
  stopAutoFit = autoFit({ min: 140, max: 500, target: rootEl.value ?? undefined });

  unsub = ctx.renderer.onButton(async (d) => {
    if (!payload.value) return;
    if (d.id === "copy-clean") {
      await ctx.system.copyText({ text: payload.value.cleanHref });
    } else if (d.id === "copy") {
      const text = queryJson.value ?? payload.value.href;
      await ctx.system.copyText({ text });
    }
  });
});

onUnmounted(() => {
  unsub?.();
  stopAutoFit?.();
});
</script>

<template>
  <main ref="rootEl" class="shell">
    <section v-if="payload" class="content">
      <!-- Tracking cleaner banner -->
      <div v-if="hasTracking" class="tracking-banner">
        <span class="tracking-icon">🛡</span>
        <div class="tracking-body">
          <span class="tracking-title"
            >{{ payload.trackingParams.length }} tracking parameter{{
              payload.trackingParams.length === 1 ? "" : "s"
            }} removed</span
          >
          <span class="tracking-clean-url">{{ payload.cleanHref }}</span>
        </div>
      </div>

      <!-- Facts grid: Scheme / Host / Port / Path / Hash -->
      <div class="facts-grid">
        <template v-for="fact in payload.display.facts" :key="fact.label">
          <span class="fact-label">{{ fact.label }}</span>
          <span class="fact-value">{{ fact.value }}</span>
        </template>
      </div>

      <!-- Query params table -->
      <div class="query-section">
        <div class="section-label">Query params</div>
        <div class="query-scroll">
          <table v-if="payload.query.length > 0" class="query-table">
            <thead>
              <tr>
                <th class="col-key">Key</th>
                <th class="col-value">Value</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(q, i) in payload.query"
                :key="i"
                :class="[
                  i % 2 === 0 ? 'row-even' : 'row-odd',
                  trackingKeySet.has(q.key) ? 'row-tracker' : '',
                ]"
              >
                <td class="cell cell-key">
                  {{ q.key }}
                  <span v-if="trackingKeySet.has(q.key)" class="tracker-badge"
                    >tracker</span
                  >
                </td>
                <td class="cell cell-value">{{ q.value }}</td>
              </tr>
            </tbody>
          </table>
          <div v-else class="no-query">No query params</div>
        </div>
      </div>
    </section>
    <div v-else class="empty">Waiting for a URL or query string…</div>
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

.facts-grid {
  background: var(--clipbus-surface-elevated, #f8fafc);
  border: 1px solid var(--clipbus-border, #e2e8f0);
  border-radius: 6px;
  padding: 8px 12px;
  display: grid;
  grid-template-columns: 4rem 1fr;
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
  word-break: break-all;
}

.query-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.query-scroll {
  max-height: 240px;
  overflow-y: auto;
}

.section-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--clipbus-text-secondary, #64748b);
}

.query-table {
  width: 100%;
  border-collapse: collapse;
  border: 1px solid var(--clipbus-border, #e2e8f0);
  border-radius: 6px;
  overflow: hidden;
  font-size: 12px;
}

.query-table th {
  background: var(--clipbus-surface-elevated, #f8fafc);
  color: var(--clipbus-text-secondary, #64748b);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 5px 10px;
  text-align: left;
  border-bottom: 1px solid var(--clipbus-border, #e2e8f0);
}

.col-key {
  width: 40%;
}

.col-value {
  width: 60%;
}

.row-even {
  background: var(--clipbus-surface, #ffffff);
}

.row-odd {
  background: var(--clipbus-surface-elevated, #f8fafc);
}

.cell {
  padding: 5px 10px;
  font-family: "SF Mono", "Menlo", "Monaco", "Cascadia Code", monospace;
  color: var(--clipbus-text-primary, #0f172a);
  word-break: break-all;
}

.cell-key {
  color: var(--clipbus-accent, #2563eb);
  font-weight: 500;
}

.no-query {
  padding: 10px 12px;
  background: var(--clipbus-surface-elevated, #f8fafc);
  border: 1px solid var(--clipbus-border, #e2e8f0);
  border-radius: 6px;
  color: var(--clipbus-text-tertiary, #94a3b8);
  font-size: 12px;
}

.empty {
  padding: 20px;
  text-align: center;
  color: var(--clipbus-text-tertiary, #94a3b8);
  font-size: 13px;
}

.tracking-banner {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: var(--clipbus-accent-tint, #eff6ff);
  border: 1px solid var(--clipbus-accent-border, #bfdbfe);
  border-radius: 6px;
  padding: 8px 12px;
}

.tracking-icon {
  font-size: 14px;
  line-height: 1.4;
  flex-shrink: 0;
}

.tracking-body {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.tracking-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--clipbus-accent, #2563eb);
}

.tracking-clean-url {
  font-family: "SF Mono", "Menlo", "Monaco", "Cascadia Code", monospace;
  font-size: 11px;
  color: var(--clipbus-text-secondary, #64748b);
  word-break: break-all;
}

.row-tracker {
  opacity: 0.6;
}

.tracker-badge {
  display: inline-block;
  margin-left: 5px;
  padding: 1px 4px;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  background: var(--clipbus-accent-tint, #eff6ff);
  color: var(--clipbus-accent, #2563eb);
  border: 1px solid var(--clipbus-accent-border, #bfdbfe);
  border-radius: 3px;
  vertical-align: middle;
}
</style>
