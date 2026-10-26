<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { ctx } from "@clipbus/plugin-sdk/view";
import { autoFit } from "@clipbus/plugin-sdk/dom";
import { useCard } from "../../shared/composables/useCard";
import { attachment, decodeIpPayload } from "./payload";
import type { IpPayload } from "./payload";

// autoFit must observe this renderer's own root (content-sized), not document.body —
// in the dev preview workbench document.body is the whole page, so without a target
// autoFit never converges and spams height updates every frame.
const rootEl = ref<HTMLElement | null>(null);

const { attachment: currentAttachment } = useCard(attachment);
const payload = computed<IpPayload | null>(() =>
  decodeIpPayload(currentAttachment.value.payload)
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

// ── Toolbar (optional: toolbar Copy button) ───────────────────────

let unsub: (() => void) | null = null;
let stopAutoFit: (() => void) | null = null;

onMounted(() => {
  stopAutoFit = autoFit({ min: 140, max: 380, target: rootEl.value ?? undefined });

  unsub = ctx.renderer.onButton(async (d) => {
    if (d.id === "copy-input" && payload.value) {
      await ctx.system.copyText({ text: payload.value.input });
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
  return `IPv${payload.value.ipVersion}`;
});

const isCidr = computed(
  () =>
    payload.value?.inputType === "ipv4cidr" ||
    payload.value?.inputType === "ipv6cidr"
);
</script>

<template>
  <main ref="rootEl" class="shell">
    <section v-if="payload" class="content">

      <!-- ── Header badge ──────────────────────────────────────────────────── -->
      <div class="header-row">
        <span class="version-badge">{{ versionBadge }}</span>
        <span v-if="isCidr" class="cidr-badge">CIDR</span>
        <span class="scope-label">{{ payload.scope }}</span>
      </div>

      <!-- ── IPv4 plain ────────────────────────────────────────────────────── -->
      <template v-if="payload.inputType === 'ipv4'">
        <div class="facts-grid">
          <span class="fact-label">Integer</span>
          <span class="fact-value with-copy">
            <span>{{ payload.integer }}</span>
            <button
              class="copy-btn"
              :class="{ copied: copiedKey === 'integer' }"
              @click="copyText('integer', String(payload.integer))"
            >{{ copiedKey === 'integer' ? '✓' : 'Copy' }}</button>
          </span>

          <span class="fact-label">Hex</span>
          <span class="fact-value">{{ payload.hex }}</span>

          <span class="fact-label">Binary</span>
          <span class="fact-value mono-sm">{{ payload.binary }}</span>

          <span class="fact-label">Reverse DNS</span>
          <span class="fact-value with-copy">
            <span class="mono-sm">{{ payload.reverseDns }}</span>
            <button
              class="copy-btn"
              :class="{ copied: copiedKey === 'rdns' }"
              @click="copyText('rdns', payload.reverseDns)"
            >{{ copiedKey === 'rdns' ? '✓' : 'Copy' }}</button>
          </span>

          <span class="fact-label">Class</span>
          <span class="fact-value">Class {{ payload.legacyClass }}</span>
        </div>
      </template>

      <!-- ── IPv4 CIDR ─────────────────────────────────────────────────────── -->
      <template v-else-if="payload.inputType === 'ipv4cidr'">
        <div class="facts-grid">
          <span class="fact-label">Prefix</span>
          <span class="fact-value">/{{ payload.prefix }}</span>

          <span class="fact-label">Netmask</span>
          <span class="fact-value">{{ payload.netmask }}</span>

          <span class="fact-label">Wildcard</span>
          <span class="fact-value">{{ payload.wildcardMask }}</span>

          <span class="fact-label">Network</span>
          <span class="fact-value with-copy">
            <span>{{ payload.networkAddress }}</span>
            <button
              class="copy-btn"
              :class="{ copied: copiedKey === 'network' }"
              @click="copyText('network', payload.networkAddress)"
            >{{ copiedKey === 'network' ? '✓' : 'Copy' }}</button>
          </span>

          <span class="fact-label">Broadcast</span>
          <span class="fact-value with-copy">
            <span>{{ payload.broadcastAddress }}</span>
            <button
              class="copy-btn"
              :class="{ copied: copiedKey === 'broadcast' }"
              @click="copyText('broadcast', payload.broadcastAddress)"
            >{{ copiedKey === 'broadcast' ? '✓' : 'Copy' }}</button>
          </span>

          <span class="fact-label">First Host</span>
          <span class="fact-value">{{ payload.firstUsable }}</span>

          <span class="fact-label">Last Host</span>
          <span class="fact-value">{{ payload.lastUsable }}</span>

          <span class="fact-label">Total</span>
          <span class="fact-value">{{ payload.totalAddresses.toLocaleString() }} addresses</span>

          <span class="fact-label">Usable</span>
          <span class="fact-value">{{ payload.usableHostCount.toLocaleString() }} hosts</span>

          <span class="fact-label">Class</span>
          <span class="fact-value">Class {{ payload.legacyClass }}</span>
        </div>
      </template>

      <!-- ── IPv6 plain ────────────────────────────────────────────────────── -->
      <template v-else-if="payload.inputType === 'ipv6'">
        <div class="facts-grid">
          <span class="fact-label">Expanded</span>
          <span class="fact-value mono-sm">{{ payload.expanded }}</span>

          <span class="fact-label">Compressed</span>
          <span class="fact-value mono-sm">{{ payload.compressed }}</span>
        </div>
      </template>

      <!-- ── IPv6 CIDR ─────────────────────────────────────────────────────── -->
      <template v-else-if="payload.inputType === 'ipv6cidr'">
        <div class="facts-grid">
          <span class="fact-label">Prefix</span>
          <span class="fact-value">/{{ payload.prefix }}</span>

          <span class="fact-label">Expanded</span>
          <span class="fact-value mono-sm">{{ payload.expanded }}</span>

          <span class="fact-label">Network</span>
          <span class="fact-value with-copy mono-sm">
            <span>{{ payload.networkPrefix }}</span>
            <button
              class="copy-btn"
              :class="{ copied: copiedKey === 'network' }"
              @click="copyText('network', payload.networkPrefix)"
            >{{ copiedKey === 'network' ? '✓' : 'Copy' }}</button>
          </span>

          <span class="fact-label">Total</span>
          <span class="fact-value">{{ payload.totalAddresses }} addresses</span>
        </div>
      </template>

    </section>
    <div v-else class="empty">Waiting for an IP address…</div>
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

.version-badge,
.cidr-badge {
  display: inline-block;
  padding: 1px 7px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  background: var(--clipbus-accent, #0891b2);
  color: var(--clipbus-on-accent, #ffffff);
}

.cidr-badge {
  background: var(--clipbus-surface-elevated, #f0f9ff);
  color: var(--clipbus-accent, #0891b2);
  border: 1px solid var(--clipbus-accent, #0891b2);
}

.scope-label {
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
  background: var(--clipbus-accent, #0891b2);
  color: var(--clipbus-on-accent, #ffffff);
  border-color: var(--clipbus-accent, #0891b2);
}

/* ── Empty state ───────────────────────────────────────────────────────────── */

.empty {
  padding: 20px;
  text-align: center;
  color: var(--clipbus-text-tertiary, #94a3b8);
  font-size: 13px;
}
</style>
