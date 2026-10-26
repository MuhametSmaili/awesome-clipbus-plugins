import { createPreviewWorkbench } from "@clipbus/plugin-sdk/preview";
import { createApp, type Component } from "vue";
import "../../shared/base.css";
import { attachmentScenarios } from "../scenarios/attachmentScenarios";
import VibeFallback from "../../features/vibe-fallback/app.vue";

const COMPONENTS: Record<string, Component> = {
  "vibe-fallback": VibeFallback,
};

createPreviewWorkbench(document.getElementById("app")!, {
  scenarios: attachmentScenarios,
  mount(slotEl, { scenario }) {
    const app = createApp(COMPONENTS[scenario.view ?? "vibe-fallback"]);
    app.mount(slotEl);
    return () => app.unmount();
  },
});
