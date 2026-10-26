<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { ctx } from "@clipbus/plugin-sdk/view";
import { autoFit } from "@clipbus/plugin-sdk/dom";
import { useCard } from "../../shared/composables/useCard";
import { attachment, decodeUuidPayload } from "./payload";
import type { UuidPayload } from "./payload";

// autoFit must observe this renderer's own root (content-sized), not document.body —
// in the dev preview workbench document.body is the whole page, so without a target
// autoFit never converges and spams height updates every frame.
const rootEl = ref<HTMLElement | null>(null);

const { attachment: currentAttachment } = useCard(attachment);
const payload = computed<UuidPayload | null>(() =>
  decodeUuidPayload(currentAttachment.value.payload)
);

// ── Copy state ────────────────────────────────────────────────────────────────

const copiedKey = ref<string | null>(null);
let copyTimer: ReturnType<typeof setTimeout> | null = null;

async function copyText(key: string, text: string) {
  await ctx.system.copyText({ text });
  copiedKey.value = key;
  if (copyTimer) clearTimeout(copyTimer);
  copyTimer = setTimeout(() => {
    copiedKey.value = null;
  }, 1500);
}

// ── Toolbar (toolbar Copy button) ──────────────────────────────────

let unsub: (() => void) | null = null;
let stopAutoFit: (() => void) | null = null;

onMounted(() => {
  stopAutoFit = autoFit({ min: 120, max: 360, target: rootEl.value ?? undefined });

  unsub = ctx.renderer.onButton(async (d) => {
    if (d.id === "copy-canonical" && payload.value) {
      await ctx.system.copyText({ text: payload.value.canonical });
    }
  });
});

onUnmounted(() => {
  unsub?.();
  stopAutoFit?.();
  if (copyTimer) clearTimeout(copyTimer);
});

// ── Display helpers ───────────────────────────────────────────────────────────

const versionBadge = computed(() => {
  if (!payload.value) return "";
  return `v${payload.value.uuidVersion}`;
});
</script>

<template>
  <main ref="rootEl" class="shell">
    <section v-if="payload" class="content">

      <!-- ── Header badge ──────────────────────────────────────────────────── -->
      <div class="header-row">
        <span class="version-badge">{{ versionBadge }}</span>
        <span v-if="payload.special" class="special-label">{{ payload.special }}</span>
      </div>

      <!-- ── Facts grid ────────────────────────────────────────────────────── -->
      <div class="facts-grid">
        <span class="fact-label">Canonical</span>
        <span class="fact-value with-copy">
          <span class="mono-sm">{{ payload.canonical }}</span>
          <button
            class="copy-btn"
            :class="{ copied: copiedKey === 'canonical' }"
            @click="copyText('canonical', payload.canonical)"
          >{{ copiedKey === 'canonical' ? '✓' : 'Copy' }}</button>
        </span>

        <span class="fact-label">URN</span>
        <span class="fact-value with-copy">
          <span class="mono-sm">{{ payload.urn }}</span>
          <button
            class="copy-btn"
            :class="{ copied: copiedKey === 'urn' }"
            @click="copyText('urn', payload.urn)"
          >{{ copiedKey === 'urn' ? '✓' : 'Copy' }}</button>
        </span>

        <span class="fact-label">Version</span>
        <span class="fact-value">{{ payload.uuidVersion }} — {{ payload.versionLabel }}</span>

        <span class="fact-label">Variant</span>
        <span class="fact-value">{{ payload.variant }}</span>

        <template v-if="payload.timestamp !== null">
          <span class="fact-label">Timestamp</span>
          <span class="fact-value mono-sm">{{ payload.timestamp }}</span>
        </template>

        <template v-if="payload.node !== null">
          <span class="fact-label">Node</span>
          <span class="fact-value with-copy">
            <span class="mono-sm">{{ payload.node }}</span>
            <button
              class="copy-btn"
              :class="{ copied: copiedKey === 'node' }"
              @click="copyText('node', payload.node!)"
            >{{ copiedKey === 'node' ? '✓' : 'Copy' }}</button>
          </span>
        </template>
      </div>

    </section>
    <div v-else class="empty">Waiting for a UUID…</div>
  </main>
</template>

<style scoped>
.shell {
  padding: 0;
  display: flex;
  flex-direction: column;
  color: var(--clipbus-text-primary, #0f172a);
  font-size: 13px;
}

.content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* ── Header ────────────────────────────────────────────────────────────────── */

.header-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.version-badge {
  display: inline-block;
  padding: 1px 7px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  background: var(--clipbus-accent, #7c3aed);
  color: var(--clipbus-on-accent, #ffffff);
}

.special-label {
  font-size: 11px;
  color: var(--clipbus-text-secondary, #64748b);
  font-style: italic;
}

/* ── Facts grid ────────────────────────────────────────────────────────────── */

.facts-grid {
  background: var(--clipbus-surface-elevated, #f8fafc);
  border: 1px solid var(--clipbus-border, #e2e8f0);
  border-radius: 6px;
  padding: 8px 12px;
  display: grid;
  grid-template-columns: 6.5rem 1fr;
  row-gap: 5px;
  column-gap: 8px;
  align-items: center;
}

.fact-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--clipbus-text-secondary, #64748b);
  white-space: nowrap;
}

.fact-value {
  font-family: "SF Mono", "Menlo", "Monaco", "Cascadia Code", monospace;
  font-size: 12px;
  color: var(--clipbus-text-primary, #0f172a);
  word-break: break-all;
}

.mono-sm {
  font-size: 11px;
}

/* ── Copy button ───────────────────────────────────────────────────────────── */

.with-copy {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.copy-btn {
  flex-shrink: 0;
  padding: 1px 7px;
  border-radius: 4px;
  border: 1px solid var(--clipbus-border, #e2e8f0);
  background: var(--clipbus-surface, #ffffff);
  color: var(--clipbus-text-secondary, #64748b);
  font-size: 10px;
  font-weight: 500;
  cursor: pointer;
  line-height: 1.6;
  transition: background 0.1s, color 0.1s;
}

.copy-btn:hover {
  background: var(--clipbus-surface-elevated, #f8fafc);
  color: var(--clipbus-text-primary, #0f172a);
}

.copy-btn.copied {
  background: var(--clipbus-accent, #7c3aed);
  color: var(--clipbus-on-accent, #ffffff);
  border-color: var(--clipbus-accent, #7c3aed);
}

/* ── Empty state ───────────────────────────────────────────────────────────── */

.empty {
  padding: 20px;
  text-align: center;
  color: var(--clipbus-text-tertiary, #94a3b8);
  font-size: 13px;
}
</style>
