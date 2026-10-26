<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { ctx } from "@clipbus/plugin-sdk/view";
import { autoFit } from "@clipbus/plugin-sdk/dom";
import { useCard, useCardButton } from "../../shared/composables/useCard";
import { attachment, decodeCsvPayload, buildMarkdownTable, buildCsvJson } from "./payload";

// autoFit must observe this renderer's own root (content-sized), not document.body —
// in the preview workbench document.body is the whole page, so without a target autoFit
// never converges and spams height updates every frame.
const rootEl = ref<HTMLElement | null>(null);

const MAX_DISPLAY_ROWS = 50;

const card = useCard(attachment);
const payload = computed(() =>
  decodeCsvPayload(card.attachment.value.payload)
);

const displayRows = computed(() =>
  payload.value ? payload.value.rows.slice(0, MAX_DISPLAY_ROWS) : []
);

const hiddenRowCount = computed(() =>
  payload.value ? Math.max(0, payload.value.rowCount - MAX_DISPLAY_ROWS) : 0
);

type ViewMode = "table" | "json";
const activeView = ref<ViewMode>("table");

let stopAutoFit: (() => void) | null = null;

async function syncCopyButton(): Promise<void> {
  try {
    const title =
      activeView.value === "json" ? "Copy JSON" : "Copy as Markdown Table";
    await ctx.renderer.update({
      buttons: [{ id: "copy", title }],
    });
  } catch (error) {
    ctx.log.warn("Could not update copy button", error);
  }
}

useCardButton("copy", async () => {
  if (payload.value) {
    const text =
      activeView.value === "json"
        ? buildCsvJson(payload.value)
        : buildMarkdownTable(payload.value);
    await ctx.system.copyText({ text });
  }
});

onMounted(() => {
  stopAutoFit = autoFit({ min: 160, max: 460, target: rootEl.value ?? undefined });

  void syncCopyButton();
});

watch(activeView, syncCopyButton);

onUnmounted(() => {
  stopAutoFit?.();
});
</script>

<template>
  <main ref="rootEl" class="shell">
    <section v-if="payload" class="content">
      <div class="meta-row">
        <span class="badge">{{ payload.display.typeLabel }}</span>
        <span class="headline">{{ payload.display.headline }}</span>
        <span class="delimiter-hint">{{ payload.display.facts[2].value }}</span>
      </div>
      <div class="view-toggle">
        <button
          :class="['toggle-btn', { active: activeView === 'table' }]"
          @click="activeView = 'table'"
        >Table</button>
        <button
          :class="['toggle-btn', { active: activeView === 'json' }]"
          @click="activeView = 'json'"
        >JSON</button>
      </div>
      <div v-if="activeView === 'table'" class="table-wrap">
        <table class="csv-table">
          <thead>
            <tr>
              <th v-for="header in payload.headers" :key="header" class="th">
                {{ header }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, rIdx) in displayRows"
              :key="rIdx"
              :class="rIdx % 2 === 0 ? 'row-even' : 'row-odd'"
            >
              <td
                v-for="(cell, cIdx) in row"
                :key="cIdx"
                class="td"
                :title="cell"
              >
                {{ cell }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="activeView === 'table' && hiddenRowCount > 0" class="more-rows">
        +{{ hiddenRowCount }} more rows
      </div>
      <div v-if="activeView === 'json'" class="code-block">
        <pre class="json-text">{{ buildCsvJson(payload) }}</pre>
      </div>
    </section>
    <div v-else class="empty">Waiting for CSV content</div>
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
  gap: 6px;
}

.meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
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

.headline {
  color: var(--clipbus-text-secondary, #64748b);
  font-size: 12px;
  font-weight: 500;
}

.delimiter-hint {
  color: var(--clipbus-text-tertiary, #94a3b8);
  font-size: 11px;
  margin-left: auto;
}

.view-toggle {
  display: flex;
  gap: 2px;
  background: var(--clipbus-surface-elevated, #f1f5f9);
  border: 1px solid var(--clipbus-border, #e2e8f0);
  border-radius: 6px;
  padding: 2px;
  align-self: flex-start;
}

.toggle-btn {
  background: transparent;
  border: none;
  border-radius: 4px;
  padding: 3px 10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--clipbus-text-secondary, #64748b);
  cursor: pointer;
  line-height: 1.5;
}

.toggle-btn.active {
  background: var(--clipbus-surface, #ffffff);
  color: var(--clipbus-text-primary, #0f172a);
}

.table-wrap {
  overflow-x: auto;
  overflow-y: auto;
  max-height: 360px;
  border: 1px solid var(--clipbus-border, #e2e8f0);
  border-radius: 6px;
}

.csv-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  line-height: 1.4;
}

.th {
  background: var(--clipbus-surface-elevated, #f8fafc);
  color: var(--clipbus-text-secondary, #64748b);
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 6px 10px;
  text-align: left;
  border-bottom: 1px solid var(--clipbus-border, #e2e8f0);
  white-space: nowrap;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.row-even {
  background: var(--clipbus-surface, #ffffff);
}

.row-odd {
  background: var(--clipbus-surface-elevated, #f8fafc);
}

.td {
  padding: 5px 10px;
  color: var(--clipbus-text-primary, #0f172a);
  border-bottom: 1px solid var(--clipbus-divider, #f1f5f9);
  white-space: nowrap;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.more-rows {
  text-align: center;
  font-size: 11px;
  color: var(--clipbus-text-tertiary, #94a3b8);
  padding: 4px 0 2px;
}

.code-block {
  background: var(--clipbus-surface-elevated, #f8fafc);
  border: 1px solid var(--clipbus-border, #e2e8f0);
  border-radius: 6px;
  padding: 10px 12px;
}

.json-text {
  margin: 0;
  font-family: "SF Mono", "Menlo", "Monaco", "Cascadia Code", monospace;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
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
