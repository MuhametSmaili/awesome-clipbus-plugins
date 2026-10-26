import { definePlugin } from "@clipbus/plugin-sdk/runtime";
import { createColorDetector } from "./features/color-swatch/detector.ts";
import { createMarkdownDetector } from "./features/markdown-renderer/detector.ts";
import { createGradientDetector } from "./features/gradient-swatch/detector.ts";

export default definePlugin({
  detectors: {
    "color-detector": createColorDetector(),
    "markdown-detector": createMarkdownDetector(),
    "gradient-detector": createGradientDetector(),
  },
  actions: {},
  messages: [],
});
