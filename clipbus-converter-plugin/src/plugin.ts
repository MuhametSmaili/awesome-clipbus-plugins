import { definePlugin } from "@clipbus/plugin-sdk/runtime";
import { createTimestampDetector } from "./features/timestamp-renderer/detector.ts";
import { createRadixDetector } from "./features/radix-renderer/detector.ts";
import { caseActions } from "./features/case-tool/action.ts";
import { createDurationDetector } from "./features/duration/detector.ts";
import { createTemperatureDetector } from "./features/temperature/detector.ts";
import { createFilesizeDetector } from "./features/filesize-renderer/detector.ts";
import { createChmodDetector } from "./features/chmod-renderer/detector.ts";

export default definePlugin({
  setup() {
    return {
      detectors: {
        "timestamp-detector": createTimestampDetector(),
        "radix-detector": createRadixDetector(),
        "duration-detector": createDurationDetector(),
        "temperature-detector": createTemperatureDetector(),
        "filesize-detector": createFilesizeDetector(),
        "chmod-detector": createChmodDetector(),
      },
      actions: caseActions,
      messages: [],
    };
  },
});
