<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { ctx } from "@clipbus/plugin-sdk/view";
import { autoFit } from "@clipbus/plugin-sdk/dom";
import { useCard } from "../../shared/composables/useCard";
import { attachment, decodeRadixPayload } from "./payload";

// autoFit must observe this renderer's own root (content-sized), not document.body —
// in the dev preview workbench document.body is the whole page, so without a target
// autoFit never converges and spams setHeight every frame.
const rootEl = ref<HTMLElement | null>(null);

const card = useCard(attachment);
const payload = computed(() =>
  decodeRadixPayload(card.attachment.value.payload)
);

let unsub: (() => void) | null = null;
let stopAutoFit: (() => void) | null = null;

async function copyRow(value: string) {
  await ctx.system.copyText({ text: value });
}

onMounted(async () => {
  stopAutoFit = autoFit({ min: 120, max: 300, target: rootEl.value ?? undefined });


  unsub = ctx.renderer.onButton(async (d) => {
    if (d.id === "copy-all" && payload.value) {
      const p = payload.value;
      await ctx.system.copyText({
        text: `DEC: ${p.decimal}\nHEX: ${p.hex}\nOCT: ${p.octal}\nBIN: ${p.binary}`,
      });
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
      <div class="rows">
        <div class="row">
          <span class="row-label">DEC</span>
          <code class="row-value">{{ payload.decimal }}</code>
          <button class="copy-btn" @click="copyRow(payload!.decimal)">Copy</button>
        </div>
        <div class="row">
          <span class="row-label">HEX</span>
          <code class="row-value">{{ payload.hex }}</code>
          <button class="copy-btn" @click="copyRow(payload!.hex)">Copy</button>
        </div>
        <div class="row">
          <span class="row-label">OCT</span>
          <code class="row-value">{{ payload.octal }}</code>
          <button class="copy-btn" @click="copyRow(payload!.octal)">Copy</button>
        </div>
        <div class="row">
          <span class="row-label">BIN</span>
          <code class="row-value bin-value">{{ payload.binary }}</code>
          <button class="copy-btn" @click="copyRow(payload!.binary)">Copy</button>
        </div>
      </div>

      <div class="meta-row">
        <span class="meta-item">
          <span class="meta-label">Bits</span>
          <span class="meta-value">{{ payload.bits }}</span>
        </span>
        <span v-if="payload.asciiChar" class="meta-item">
          <span class="meta-label">ASCII</span>
          <code class="meta-value">{{ payload.asciiChar }}</code>
        </span>
        <span v-if="payload.isNegative" class="badge badge--neg">Negative</span>
      </div>
    </section>
    <div v-else class="empty">Waiting for integer</div>
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

.rows {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 0;
  border-bottom: 1px solid var(--clipbus-border, #e2e8f0);
}

.row:last-child {
  border-bottom: none;
}

.row-label {
  flex: 0 0 36px;
  font-size: 11px;
  font-weight: 600;
  color: var(--clipbus-text-secondary, #64748b);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.row-value {
  flex: 1;
  font-family: "SF Mono", "Menlo", "Monaco", "Cascadia Code", monospace;
  font-size: 12px;
  color: var(--clipbus-text-primary, #0f172a);
  word-break: break-all;
}

.bin-value {
  font-size: 11px;
}

.copy-btn {
  flex: 0 0 auto;
  padding: 2px 8px;
  font-size: 11px;
  border-radius: 4px;
  border: 1px solid var(--clipbus-border, #e2e8f0);
  background: var(--clipbus-surface-elevated, #f1f5f9);
  color: var(--clipbus-text-secondary, #64748b);
  cursor: pointer;
}

.copy-btn:hover {
  background: var(--clipbus-accent, #4f46e5);
  color: var(--clipbus-accent-contrast, #ffffff);
  border-color: var(--clipbus-accent, #4f46e5);
}

.meta-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.meta-label {
  font-size: 11px;
  color: var(--clipbus-text-tertiary, #94a3b8);
  font-weight: 500;
}

.meta-value {
  font-size: 12px;
  font-family: "SF Mono", "Menlo", "Monaco", "Cascadia Code", monospace;
  color: var(--clipbus-text-primary, #0f172a);
}

.badge {
  border-radius: 4px;
  padding: 2px 7px;
  font-size: 11px;
  font-weight: 600;
}

.badge--neg {
  background: color-mix(in srgb, var(--clipbus-warning, #d97706) 16%, transparent);
  color: var(--clipbus-warning, #d97706);
}

.empty {
  padding: 20px;
  text-align: center;
  color: var(--clipbus-text-tertiary, #94a3b8);
  font-size: 13px;
}
</style>
