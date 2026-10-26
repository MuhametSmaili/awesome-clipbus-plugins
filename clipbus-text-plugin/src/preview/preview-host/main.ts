import { createApp, h } from "vue";
import manifest from "../../../manifest.json";
import "../../shared/base.css";

// Actions have no card pages or preview scenarios.
createApp({
  render() {
    return h(
      "main",
      {
        style:
          "max-width:520px;margin:48px auto;padding:24px;border-radius:12px;" +
          "font:13px/1.6 system-ui,sans-serif;" +
          "color:var(--clipbus-text-secondary,#475569);" +
          "background:var(--clipbus-surface,#ffffff);" +
          "border:1px solid var(--clipbus-border,#e2e8f0);",
      },
      [
        h(
          "strong",
          {
            style:
              "display:block;margin-bottom:8px;font-size:14px;" +
              "color:var(--clipbus-text-primary,#0f172a);",
          },
          manifest.plugin.title + " — no previewable UI"
        ),
        h(
          "p",
          { style: "margin:0;" },
          "These nine Actions transform the current text value directly. " +
            "Select a text item in Clipbus and run an Action to see its result."
        ),
        h("ul", { style: "margin:16px 0 0;padding-left:20px;" },
          manifest.actions.map(({ id, title }) => h("li", { key: id }, title))
        ),
      ]
    );
  },
}).mount("#app");
