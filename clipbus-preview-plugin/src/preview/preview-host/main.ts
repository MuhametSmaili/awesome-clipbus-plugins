import { createPreviewWorkbench } from "@clipbus/plugin-sdk/preview";
import { createApp, type Component } from "vue";
import { autoFit } from "@clipbus/plugin-sdk/dom";
import "../../shared/base.css";
import { attachmentScenarios } from "../scenarios/attachmentScenarios";

// PER-PLUGIN: import every renderer feature component.
import ColorSwatch from "../../features/color-swatch/app.vue";
import GradientSwatch from "../../features/gradient-swatch/app.vue";
import MarkdownRenderer from "../../features/markdown-renderer/app.vue";

// PER-PLUGIN: map scenario.view (feature id) → its component.
const COMPONENTS: Record<string, Component> = {
  "color-swatch": ColorSwatch,
  "gradient-swatch": GradientSwatch,
  "markdown-renderer": MarkdownRenderer,
};

createPreviewWorkbench(document.getElementById("app")!, {
  scenarios: attachmentScenarios,
  mount(slotEl, { scenario }) {
    const Comp = COMPONENTS[scenario.view ?? ""] ?? ColorSwatch;
    const app = createApp(Comp);
    app.mount(slotEl);
    const stopAutoFit = scenario.view === "markdown-renderer"
      ? autoFit({ min: scenario.height?.min, max: scenario.height?.max, target: slotEl.querySelector<HTMLElement>(".shell") ?? slotEl })
      : () => {};
    return () => { stopAutoFit(); app.unmount(); };
  },
});
