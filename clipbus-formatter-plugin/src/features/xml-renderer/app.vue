<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { ctx } from "@clipbus/plugin-sdk/view";
import { autoFit } from "@clipbus/plugin-sdk/dom";
import { useCard, useCardButton } from "../../shared/composables/useCard";
import { attachment, decodeXmlPayload } from "./payload";

// autoFit must observe this renderer's own root (content-sized), not document.body —
// in the preview workbench document.body is the whole page, so without a target autoFit
// never converges and spams height updates every frame.
const rootEl = ref<HTMLElement | null>(null);

const card = useCard(attachment);
const payload = computed(() =>
  decodeXmlPayload(card.attachment.value.payload)
);

let stopAutoFit: (() => void) | null = null;

useCardButton("copy-xml", async () => {
  if (payload.value) {
    await ctx.system.copyText({ text: payload.value.formatted });
  }
});

onMounted(() => {
  stopAutoFit = autoFit({ min: 140, max: 480, target: rootEl.value ?? undefined });
});

onUnmounted(() => {
  stopAutoFit?.();
});
</script>

<template>
  <main ref="rootEl" class="shell">
    <section v-if="payload" class="content">
      <div class="stats-row">
        <span class="stat">Elements {{ payload.elementCount }}</span>
        <span class="sep">·</span>
        <span class="stat">Attrs {{ payload.attributeCount }}</span>
        <span class="sep">·</span>
        <span class="stat">Depth {{ payload.maxDepth }}</span>
      </div>
      <div class="code-block">
        <pre class="code-text">{{ payload.formatted }}</pre>
      </div>
    </section>
    <div v-else class="empty">Waiting for XML content</div>
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

.stats-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.stat {
  font-size: 12px;
  font-weight: 600;
  color: var(--clipbus-accent, #7c3aed);
}

.sep {
  font-size: 12px;
  color: var(--clipbus-text-tertiary, #94a3b8);
}

.code-block {
  background: var(--clipbus-surface-elevated, #f8fafc);
  border: 1px solid var(--clipbus-border, #e2e8f0);
  border-radius: 6px;
  padding: 8px 10px;
  overflow: hidden;
}

.code-text {
  margin: 0;
  font-family: "SF Mono", "Menlo", "Monaco", "Cascadia Code", monospace;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre;
  word-break: normal;
  overflow-x: auto;
  color: var(--clipbus-text-primary, #0f172a);
  max-height: 360px;
  overflow-y: auto;
}

.empty {
  padding: 20px;
  text-align: center;
  color: var(--clipbus-text-tertiary, #94a3b8);
  font-size: 13px;
}
</style>
