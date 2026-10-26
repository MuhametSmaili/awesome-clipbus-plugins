<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { autoFit } from "@clipbus/plugin-sdk/dom";
import { useCard } from "../../shared/composables/useCard";
import { attachment, decodeChmodPayload } from "./payload";

const rootEl = ref<HTMLElement | null>(null);

const card = useCard(attachment);
const payload = computed(() =>
  decodeChmodPayload(card.attachment.value.payload)
);

let stopAutoFit: (() => void) | null = null;

onMounted(() => {
  stopAutoFit = autoFit({ min: 180, max: 380, target: rootEl.value ?? undefined });
});

onUnmounted(() => {
  stopAutoFit?.();
});
</script>

<template>
  <main ref="rootEl" class="shell">
    <section v-if="payload" class="content">
      <div class="meta-row">
        <span class="badge">File Permissions</span>
        <span class="input-chip mono">{{ payload.input }}</span>
        <span v-if="payload.fileType" class="type-chip">{{ payload.fileType }}</span>
      </div>

      <div class="primary-row">
        <div class="octal-block">
          <span class="octal-value mono">{{ payload.octal }}</span>
          <span class="value-label">octal</span>
        </div>
        <div class="symbolic-block">
          <span class="symbolic-value mono">{{ payload.symbolic }}</span>
          <span class="value-label">symbolic</span>
        </div>
      </div>

      <div class="perm-table">
        <div class="perm-header">
          <span></span>
          <span class="col-head">Read</span>
          <span class="col-head">Write</span>
          <span class="col-head">Execute</span>
        </div>
        <div v-for="cls in payload.classes" :key="cls.label" class="perm-row">
          <span class="class-label">{{ cls.label }}</span>
          <span :class="['bit', cls.read ? 'bit-on' : 'bit-off']">{{ cls.read ? 'r' : '—' }}</span>
          <span :class="['bit', cls.write ? 'bit-on' : 'bit-off']">{{ cls.write ? 'w' : '—' }}</span>
          <span :class="['bit', cls.execute ? 'bit-on' : 'bit-off']">{{ cls.execute ? 'x' : '—' }}</span>
        </div>
      </div>

      <div v-if="payload.setuid || payload.setgid || payload.sticky" class="special-row">
        <span v-if="payload.setuid" class="special-badge">setuid</span>
        <span v-if="payload.setgid" class="special-badge">setgid</span>
        <span v-if="payload.sticky" class="special-badge">sticky</span>
      </div>
    </section>
    <div v-else class="empty">Waiting for a permission string (e.g. rwxr-xr-x)</div>
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

.meta-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.badge {
  background: var(--clipbus-accent, #475569);
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
}

.type-chip {
  background: var(--clipbus-surface-elevated, #f8fafc);
  border: 1px solid var(--clipbus-border, #e2e8f0);
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 10px;
  color: var(--clipbus-text-tertiary, #94a3b8);
}

.primary-row {
  display: flex;
  align-items: flex-end;
  gap: 16px;
  background: var(--clipbus-surface-elevated, #f8fafc);
  border: 1px solid var(--clipbus-border, #e2e8f0);
  border-radius: 6px;
  padding: 8px 12px;
}

.octal-block,
.symbolic-block {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.octal-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--clipbus-text-primary, #0f172a);
  line-height: 1;
}

.symbolic-value {
  font-size: 15px;
  font-weight: 600;
  color: var(--clipbus-text-secondary, #64748b);
  line-height: 1;
}

.value-label {
  font-size: 10px;
  color: var(--clipbus-text-tertiary, #94a3b8);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.perm-table {
  background: var(--clipbus-surface-elevated, #f8fafc);
  border: 1px solid var(--clipbus-border, #e2e8f0);
  border-radius: 6px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.perm-header,
.perm-row {
  display: grid;
  grid-template-columns: 56px 1fr 1fr 1fr;
}

.perm-header {
  border-bottom: 1px solid var(--clipbus-border, #e2e8f0);
  padding: 4px 10px;
}

.col-head {
  font-size: 10px;
  font-weight: 600;
  color: var(--clipbus-text-tertiary, #94a3b8);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  text-align: center;
}

.perm-row {
  padding: 5px 10px;
  border-bottom: 1px solid var(--clipbus-border, #e2e8f0);
}

.perm-row:last-child {
  border-bottom: none;
}

.class-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--clipbus-text-secondary, #64748b);
  display: flex;
  align-items: center;
}

.bit {
  font-size: 12px;
  font-weight: 700;
  text-align: center;
  font-family: "SF Mono", "Menlo", "Monaco", "Cascadia Code", monospace;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bit-on {
  color: var(--clipbus-accent, #475569);
}

.bit-off {
  color: var(--clipbus-text-tertiary, #94a3b8);
}

.special-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.special-badge {
  background: var(--clipbus-surface-elevated, #f8fafc);
  border: 1px solid var(--clipbus-border, #e2e8f0);
  color: var(--clipbus-text-secondary, #64748b);
  border-radius: 4px;
  padding: 2px 7px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
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
