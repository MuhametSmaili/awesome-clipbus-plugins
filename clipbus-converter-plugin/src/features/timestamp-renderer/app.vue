<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { ctx } from "@clipbus/plugin-sdk/view";
import { autoFit } from "@clipbus/plugin-sdk/dom";
import { useCard } from "../../shared/composables/useCard";
import { attachment, decodeTimestampPayload } from "./payload";

// autoFit must observe this renderer's own root (content-sized), not document.body —
// in the dev preview workbench document.body is the whole page, so without a target
// autoFit never converges and spams setHeight every frame.
const rootEl = ref<HTMLElement | null>(null);

const card = useCard(attachment);
const payload = computed(() =>
  decodeTimestampPayload(card.attachment.value.payload)
);

const relativeTime = computed(() => {
  if (!payload.value) return "";
  const diffMs = payload.value.epochMs - Date.now();
  const absSec = Math.abs(Math.floor(diffMs / 1000));
  const absMin = Math.floor(absSec / 60);
  const absHour = Math.floor(absMin / 60);
  const absDay = Math.floor(absHour / 24);

  if (absSec < 60) return "just now";
  if (absMin < 60) return diffMs < 0 ? `${absMin}m ago` : `in ${absMin}m`;
  if (absHour < 24) return diffMs < 0 ? `${absHour}h ago` : `in ${absHour}h`;
  return diffMs < 0 ? `${absDay}d ago` : `in ${absDay}d`;
});

let unsub: (() => void) | null = null;
let stopAutoFit: (() => void) | null = null;

onMounted(async () => {
  stopAutoFit = autoFit({ min: 140, max: 460, target: rootEl.value ?? undefined });


  unsub = ctx.renderer.onButton(async (d) => {
    if (d.id === "copy-iso" && payload.value) {
      await ctx.system.copyText({ text: payload.value.iso });
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
      <div class="meta-row">
        <span class="badge">Unix Timestamp</span>
        <span class="unit-chip">{{ payload.unit === "seconds" ? "sec" : "ms" }}</span>
      </div>
      <div class="local-time">{{ payload.local }}</div>
      <div class="facts">
        <div class="fact-row">
          <span class="fact-label">ISO 8601</span>
          <span class="fact-value mono">{{ payload.iso }}</span>
        </div>
        <div class="fact-row">
          <span class="fact-label">UTC</span>
          <span class="fact-value mono">{{ payload.utc }}</span>
        </div>
        <div class="fact-row">
          <span class="fact-label">Weekday</span>
          <span class="fact-value">{{ payload.weekday }}</span>
        </div>
        <div class="fact-row">
          <span class="fact-label">Relative</span>
          <span class="fact-value">{{ relativeTime }}</span>
        </div>
      </div>
      <div v-if="payload.zones && payload.zones.length > 0" class="world-clock">
        <div class="wc-header">World clock</div>
        <div class="wc-list">
          <div v-for="zone in payload.zones" :key="zone.label" class="wc-row">
            <span class="wc-label">{{ zone.label }}</span>
            <span class="wc-time mono">{{ zone.time }}</span>
            <span class="wc-offset mono">{{ zone.offset }}</span>
          </div>
        </div>
      </div>
    </section>
    <div v-else class="empty">Waiting for Unix timestamp</div>
  </main>
</template>

<style scoped>
.shell {
  /* 复用 native 卡片自身 padding，根容器不再叠加内距，避免双层内距 */
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
  background: var(--clipbus-accent, #0f766e);
  color: var(--clipbus-accent-contrast, #ffffff);
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.unit-chip {
  background: var(--clipbus-surface-elevated, #f8fafc);
  border: 1px solid var(--clipbus-border, #e2e8f0);
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 11px;
  color: var(--clipbus-text-secondary, #64748b);
}

.local-time {
  font-size: 16px;
  font-weight: 600;
  color: var(--clipbus-text-primary, #0f172a);
  line-height: 1.3;
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
  align-items: flex-start;
  gap: 8px;
}

.fact-label {
  font-size: 11px;
  color: var(--clipbus-text-tertiary, #94a3b8);
  font-weight: 500;
  min-width: 60px;
  padding-top: 1px;
  flex-shrink: 0;
}

.fact-value {
  font-size: 12px;
  color: var(--clipbus-text-primary, #0f172a);
  word-break: break-all;
}

.fact-value.mono {
  font-family: "SF Mono", "Menlo", "Monaco", "Cascadia Code", monospace;
}

.empty {
  padding: 20px;
  text-align: center;
  color: var(--clipbus-text-tertiary, #94a3b8);
  font-size: 13px;
}

.world-clock {
  background: var(--clipbus-surface-elevated, #f8fafc);
  border: 1px solid var(--clipbus-border, #e2e8f0);
  border-radius: 6px;
  overflow: hidden;
}

.wc-header {
  font-size: 11px;
  font-weight: 600;
  color: var(--clipbus-text-tertiary, #94a3b8);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 6px 12px 4px;
}

.wc-list {
  max-height: 200px;
  overflow-y: auto;
}

.wc-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 12px;
  border-top: 1px solid var(--clipbus-border, #e2e8f0);
}

.wc-label {
  font-size: 11px;
  color: var(--clipbus-text-secondary, #64748b);
  min-width: 80px;
  flex-shrink: 0;
}

.wc-time {
  font-size: 11px;
  color: var(--clipbus-text-primary, #0f172a);
  flex: 1;
}

.wc-offset {
  font-size: 11px;
  color: var(--clipbus-text-tertiary, #94a3b8);
  flex-shrink: 0;
}
</style>
