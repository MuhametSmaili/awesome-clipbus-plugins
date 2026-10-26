import { createPreviewWorkbench } from "@clipbus/plugin-sdk/preview";
import { createApp, type Component } from "vue";
import "../../shared/base.css";
import { attachmentScenarios } from "../scenarios/attachmentScenarios";

// PER-PLUGIN: import every renderer feature component.
import Base64Renderer from "../../features/base64-renderer/app.vue";
import DataUri from "../../features/data-uri/app.vue";
import JwtRenderer from "../../features/jwt-renderer/app.vue";

// PER-PLUGIN: map scenario.view (feature id) → its component.
const COMPONENTS: Record<string, Component> = {
  "base64-renderer": Base64Renderer,
  "data-uri": DataUri,
  "jwt-renderer": JwtRenderer,
};

createPreviewWorkbench(document.getElementById("app")!, {
  scenarios: attachmentScenarios,
  mount(slotEl, { scenario }) {
    const Comp = COMPONENTS[scenario.view ?? ""] ?? Base64Renderer;
    const app = createApp(Comp);
    app.mount(slotEl);
    return () => app.unmount();
  },
});
