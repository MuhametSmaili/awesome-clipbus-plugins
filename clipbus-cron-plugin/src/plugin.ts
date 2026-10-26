import { definePlugin } from "@clipbus/plugin-sdk/runtime";
import { createCronDetector } from "./features/cron-renderer/detector.ts";

export default definePlugin({
  detectors: {
    "cron-detector": createCronDetector(),
  },
});
