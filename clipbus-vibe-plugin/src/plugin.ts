import { definePlugin } from "@clipbus/plugin-sdk/runtime";
import { vibeDetector } from "./features/vibe-fallback/detector";

export default definePlugin({
  detectors: { "vibe-detector": vibeDetector },
  actions: {},
  messages: [],
});
