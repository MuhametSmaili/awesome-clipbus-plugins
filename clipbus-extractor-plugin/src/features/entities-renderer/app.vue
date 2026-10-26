<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { ctx } from "@clipbus/plugin-sdk/view";
import { autoFit } from "@clipbus/plugin-sdk/dom";
import { useCard } from "../../shared/composables/useCard";
import { attachment, decodeEntitiesPayload } from "./payload";

// autoFit must observe this renderer's own root (content-sized), not document.body —
// in the dev preview workbench document.body is the whole page, so without a target
// autoFit never converges and spams height updates every frame.
const rootEl = ref<HTMLElement | null>(null);

const { attachment: currentAttachment } = useCard(attachment);
const payload = computed(() =>
  decodeEntitiesPayload(currentAttachment.value.payload)
);

const groups = computed(() => {
  if (!payload.value) return [];
  const p = payload.value;
  const result: { label: string; items: string[] }[] = [];
  if (p.urls.length > 0) result.push({ label: "URLs", items: p.urls });
  if (p.emails.length > 0) result.push({ label: "Emails", items: p.emails });
  if (p.ips.length > 0) result.push({ label: "IP Addresses", items: p.ips });
  return result;
});

let unsub: (() => void) | null = null;
let stopAutoFit: (() => void) | null = null;

onMounted(() => {
  stopAutoFit = autoFit({ min: 140, max: 420, target: rootEl.value ?? undefined });


  unsub = ctx.renderer.onButton(async (d) => {
    if (d.id === "copy-all" && payload.value) {
      const allItems = [
        ...payload.value.urls,
        ...payload.value.emails,
        ...payload.value.ips,
      ];
      await ctx.system.copyText({ text: allItems.join("\n") });
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
      <div class="header-row">
        <span class="title">Extracted Entities</span>
        <span class="badge">{{ payload.totalCount }}</span>
      </div>
      <div v-for="group in groups" :key="group.label" class="group">
        <div class="group-header">
          <span class="group-label">{{ group.label }}</span>
          <span class="group-count">{{ group.items.length }}</span>
        </div>
        <ul class="item-list">
          <li v-for="item in group.items" :key="item" class="item">
            {{ item }}
          </li>
        </ul>
      </div>
    </section>
    <div v-else class="empty">Waiting for text with URLs, emails, or IPs</div>
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
  gap: 10px;
}

.header-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.title {
  font-weight: 600;
  font-size: 13px;
  color: var(--clipbus-text-primary, #0f172a);
}

.badge {
  background: var(--clipbus-accent, #2563eb);
  color: var(--clipbus-accent-contrast, #ffffff);
  border-radius: 10px;
  padding: 1px 7px;
  font-size: 11px;
  font-weight: 600;
  min-width: 20px;
  text-align: center;
}

.group {
  background: var(--clipbus-surface-elevated, #f8fafc);
  border: 1px solid var(--clipbus-border, #e2e8f0);
  border-radius: 6px;
  overflow: hidden;
}

.group-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: var(--clipbus-surface, #f1f5f9);
  border-bottom: 1px solid var(--clipbus-border, #e2e8f0);
}

.group-label {
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--clipbus-text-secondary, #64748b);
}

.group-count {
  font-size: 11px;
  color: var(--clipbus-text-tertiary, #94a3b8);
}

.item-list {
  margin: 0;
  padding: 6px 0;
  list-style: none;
  max-height: 120px;
  overflow-y: auto;
}

.item {
  padding: 3px 10px;
  font-family: "SF Mono", "Menlo", "Monaco", "Cascadia Code", monospace;
  font-size: 11px;
  line-height: 1.5;
  word-break: break-all;
  color: var(--clipbus-text-primary, #0f172a);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item:hover {
  background: var(--clipbus-surface, #f1f5f9);
}

.empty {
  padding: 20px;
  text-align: center;
  color: var(--clipbus-text-tertiary, #94a3b8);
  font-size: 13px;
}
</style>
