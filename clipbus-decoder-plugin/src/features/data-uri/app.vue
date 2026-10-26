<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { ctx } from "@clipbus/plugin-sdk/view";
import { autoFit } from "@clipbus/plugin-sdk/dom";
import { useCard } from "../../shared/composables/useCard";
import { attachment, decodeDataUriPayload } from "./payload";

// autoFit must observe this renderer's own root (content-sized), not document.body —
// in the dev preview workbench document.body is the whole page, so without a target
// autoFit never converges and spams setHeight every frame.
const rootEl = ref<HTMLElement | null>(null);

const card = useCard(attachment);
const payload = computed(() =>
  decodeDataUriPayload(card.attachment.value.payload)
);

let unsub: (() => void) | null = null;
let stopAutoFit: (() => void) | null = null;

onMounted(async () => {
  stopAutoFit = autoFit({ min: 120, max: 320, target: rootEl.value ?? undefined });

  unsub = ctx.renderer.onButton(async (d) => {
    if (d.id === "copy" && payload.value?.decodedTextPreview != null) {
      await ctx.system.copyText({ text: payload.value.decodedTextPreview });
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
      <div class="facts">
        <div class="fact">
          <span class="fact-label">Media type</span>
          <span class="fact-value">
            {{ payload.mediaType }}
            <span v-if="payload.isDefault" class="default-note">(default)</span>
          </span>
        </div>
        <div class="fact">
          <span class="fact-label">Encoding</span>
          <span class="fact-value">{{ payload.encodingLabel }}</span>
        </div>
        <div class="fact">
          <span class="fact-label">Decoded size</span>
          <span class="fact-value">{{ payload.decodedSize }}</span>
        </div>
      </div>

      <!-- Text preview -->
      <div v-if="payload.isText && payload.decodedTextPreview != null" class="preview-block">
        <div class="preview-label">
          Decoded
          <span v-if="payload.decodedTextTruncated" class="trunc-note">(truncated)</span>
        </div>
        <pre class="preview-text">{{ payload.decodedTextPreview }}</pre>
      </div>

      <!-- Decode error notice -->
      <div v-else-if="payload.decodeError" class="notice notice--warn">
        Could not decode content for preview.
      </div>

      <!-- Image note — do not attempt to render -->
      <div v-else-if="payload.isImage" class="notice">
        (image data — {{ payload.decodedSize }})
      </div>
    </section>
    <div v-else class="empty">Waiting for Data URI content</div>
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

.facts {
  display: flex;
  flex-direction: column;
  gap: 5px;
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
  flex: 1;
  font-family: "SF Mono", "Menlo", "Monaco", "Cascadia Code", monospace;
  font-size: 12px;
  color: var(--clipbus-text-primary, #0f172a);
  word-break: break-all;
}

.default-note {
  font-family: inherit;
  font-size: 11px;
  color: var(--clipbus-text-tertiary, #94a3b8);
  font-weight: 400;
  font-style: italic;
}

.preview-block {
  background: var(--clipbus-surface-elevated, #f8fafc);
  border: 1px solid var(--clipbus-border, #e2e8f0);
  border-radius: 6px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.preview-label {
  font-size: 11px;
  color: var(--clipbus-text-secondary, #64748b);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.trunc-note {
  font-size: 10px;
  color: var(--clipbus-text-tertiary, #94a3b8);
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  margin-left: 4px;
}

.preview-text {
  margin: 0;
  font-family: "SF Mono", "Menlo", "Monaco", "Cascadia Code", monospace;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--clipbus-text-primary, #0f172a);
  max-height: 200px;
  overflow-y: auto;
}

.notice {
  font-size: 12px;
  color: var(--clipbus-text-secondary, #64748b);
  padding: 6px 0;
}

.notice--warn {
  color: var(--clipbus-warning, #d97706);
}

.empty {
  padding: 20px;
  text-align: center;
  color: var(--clipbus-text-tertiary, #94a3b8);
  font-size: 13px;
}
</style>
