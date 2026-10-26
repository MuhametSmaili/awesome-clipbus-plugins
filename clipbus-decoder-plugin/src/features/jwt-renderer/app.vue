<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { ctx } from "@clipbus/plugin-sdk/view";
import { autoFit } from "@clipbus/plugin-sdk/dom";
import { useCard } from "../../shared/composables/useCard";
import { attachment, decodeJwtPayload } from "./payload";

// autoFit must observe this renderer's own root (content-sized), not document.body —
// in the dev preview workbench document.body is the whole page, so without a target
// autoFit never converges and spams setHeight every frame.
const rootEl = ref<HTMLElement | null>(null);

const card = useCard(attachment);
const payload = computed(() =>
  decodeJwtPayload(card.attachment.value.payload)
);

let unsub: (() => void) | null = null;
let stopAutoFit: (() => void) | null = null;

onMounted(async () => {
  stopAutoFit = autoFit({ min: 140, max: 440, target: rootEl.value ?? undefined });

  unsub = ctx.renderer.onButton(async (d) => {
    if (d.id === "copy" && payload.value) {
      await ctx.system.copyText({ text: payload.value.payloadPretty });
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
        <span class="badge badge--alg">{{ payload.alg }}</span>
        <span class="badge badge--typ">{{ payload.typ }}</span>
        <span
          v-if="payload.isExpired !== null"
          class="pill"
          :class="payload.isExpired ? 'pill--expired' : 'pill--valid'"
        >{{ payload.relativeLabel }}</span>
        <span v-if="!payload.signaturePresent" class="pill pill--warn">No signature</span>
      </div>

      <dl v-if="payload.claimFacts.length" class="facts">
        <div v-for="fact in payload.claimFacts" :key="fact.label" class="fact">
          <dt class="fact-label">{{ fact.label }}</dt>
          <dd class="fact-value">{{ fact.value }}</dd>
        </div>
      </dl>

      <div class="code-block">
        <div class="code-label">Payload</div>
        <pre class="code-text">{{ payload.payloadPretty }}</pre>
      </div>
    </section>
    <div v-else class="empty">Waiting for JWT content</div>
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

.meta-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.badge {
  border-radius: 4px;
  padding: 2px 7px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.badge--alg {
  background: var(--clipbus-accent, #7c3aed);
  color: var(--clipbus-accent-contrast, #ffffff);
}

.badge--typ {
  background: var(--clipbus-surface-elevated, #f1f5f9);
  color: var(--clipbus-text-secondary, #64748b);
  border: 1px solid var(--clipbus-border, #e2e8f0);
}

.pill {
  border-radius: 999px;
  padding: 2px 9px;
  font-size: 11px;
  font-weight: 600;
}

.pill--valid {
  background: color-mix(in srgb, var(--clipbus-success, #16a34a) 16%, transparent);
  color: var(--clipbus-success, #16a34a);
}

.pill--expired {
  background: color-mix(in srgb, var(--clipbus-danger, #dc2626) 16%, transparent);
  color: var(--clipbus-danger, #dc2626);
}

.pill--warn {
  background: color-mix(in srgb, var(--clipbus-warning, #d97706) 16%, transparent);
  color: var(--clipbus-warning, #d97706);
}

.facts {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.fact {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.fact-label {
  flex: 0 0 36%;
  font-size: 11px;
  color: var(--clipbus-text-secondary, #64748b);
  font-weight: 500;
}

.fact-value {
  margin: 0;
  flex: 1;
  font-family: "SF Mono", "Menlo", "Monaco", "Cascadia Code", monospace;
  font-size: 12px;
  color: var(--clipbus-text-primary, #0f172a);
  word-break: break-all;
}

.code-block {
  background: var(--clipbus-surface-elevated, #f8fafc);
  border: 1px solid var(--clipbus-border, #e2e8f0);
  border-radius: 6px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.code-label {
  font-size: 10px;
  color: var(--clipbus-text-tertiary, #94a3b8);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.code-text {
  margin: 0;
  font-family: "SF Mono", "Menlo", "Monaco", "Cascadia Code", monospace;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--clipbus-text-primary, #0f172a);
  max-height: 240px;
  overflow-y: auto;
}

.empty {
  padding: 20px;
  text-align: center;
  color: var(--clipbus-text-tertiary, #94a3b8);
  font-size: 13px;
}
</style>
