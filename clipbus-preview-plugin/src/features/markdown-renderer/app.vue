<script setup lang="ts">
import { computed } from "vue";
import { useCard } from "../../shared/composables/useCard";
import { attachment, decodeMarkdownPayload } from "./payload";

const card = useCard(attachment);
const payload = computed(() => decodeMarkdownPayload(card.attachment.value.payload));
</script>

<template>
  <div class="viewport">
    <main class="shell">
      <section v-if="payload" class="content">
        <div class="meta-row">
          <span class="meta-item">{{ payload.sourceChars }} chars</span>
          <span class="meta-sep">·</span>
          <span class="meta-item">{{ payload.lineCount }} lines</span>
          <span v-if="payload.headingCount > 0" class="meta-sep">·</span>
          <span v-if="payload.headingCount > 0" class="meta-item">{{ payload.headingCount }} headings</span>
        </div>
        <div class="md-body" v-html="payload.html"></div>
      </section>
      <div v-else class="empty">Awaiting Markdown content</div>
    </main>
  </div>
</template>

<style scoped>
.viewport { height: 100%; overflow: auto; }
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

.meta-row {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--clipbus-text-tertiary, #94a3b8);
  font-weight: 500;
}

.meta-sep {
  color: var(--clipbus-border, #e2e8f0);
}

.md-body {
  color: var(--clipbus-text-primary, #0f172a);
  font-size: 13px;
  line-height: 1.6;
  overflow-wrap: break-word;
}

.md-body :deep(h1),
.md-body :deep(h2),
.md-body :deep(h3),
.md-body :deep(h4),
.md-body :deep(h5),
.md-body :deep(h6) {
  margin: 0 0 6px;
  font-weight: 600;
  line-height: 1.3;
  color: var(--clipbus-text-primary, #0f172a);
}

.md-body :deep(h1) { font-size: 17px; }
.md-body :deep(h2) { font-size: 15px; }
.md-body :deep(h3),
.md-body :deep(h4),
.md-body :deep(h5),
.md-body :deep(h6) { font-size: 13px; }

.md-body :deep(p) {
  margin: 0 0 8px;
  color: var(--clipbus-text-primary, #0f172a);
}

.md-body :deep(p:last-child) {
  margin-bottom: 0;
}

.md-body :deep(strong) {
  font-weight: 600;
  color: var(--clipbus-text-primary, #0f172a);
}

.md-body :deep(em) {
  font-style: italic;
  color: var(--clipbus-text-secondary, #64748b);
}

.md-body :deep(code) {
  font-family: "SF Mono", "Menlo", "Monaco", "Cascadia Code", monospace;
  font-size: 11px;
  background: var(--clipbus-surface-elevated, #f1f5f9);
  border: 1px solid var(--clipbus-border, #e2e8f0);
  border-radius: 3px;
  padding: 1px 4px;
  color: var(--clipbus-text-primary, #0f172a);
}

.md-body :deep(pre) {
  background: var(--clipbus-surface-elevated, #f8fafc);
  border: 1px solid var(--clipbus-border, #e2e8f0);
  border-radius: 6px;
  padding: 8px 10px;
  overflow-x: auto;
  margin: 0 0 8px;
}

.md-body :deep(pre code) {
  background: none;
  border: none;
  padding: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--clipbus-text-primary, #0f172a);
}

.md-body :deep(ul),
.md-body :deep(ol) {
  margin: 0 0 8px;
  padding-left: 20px;
  color: var(--clipbus-text-primary, #0f172a);
}

.md-body :deep(li) {
  margin-bottom: 3px;
  line-height: 1.5;
}

.md-body :deep(blockquote) {
  margin: 0 0 8px;
  padding: 4px 10px;
  border-left: 3px solid var(--clipbus-accent, #0ea5e9);
  color: var(--clipbus-text-secondary, #64748b);
  font-style: italic;
}

.md-body :deep(a) {
  color: var(--clipbus-accent, #0ea5e9);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.empty {
  padding: 20px;
  text-align: center;
  color: var(--clipbus-text-tertiary, #94a3b8);
  font-size: 13px;
}
</style>
