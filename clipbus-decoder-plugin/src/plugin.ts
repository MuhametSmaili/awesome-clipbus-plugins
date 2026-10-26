import { definePlugin } from "@clipbus/plugin-sdk/runtime";
import { createBase64Detector } from "./features/base64-renderer/detector.ts";
import { createJwtDetector } from "./features/jwt-renderer/detector.ts";
import { createDataUriDetector } from "./features/data-uri/detector.ts";
import { escapeActions } from "./features/escape-tool/action.ts";

export default definePlugin({
  detectors: {
    "base64-detector": createBase64Detector(),
    "jwt-detector": createJwtDetector(),
    "data-uri-detector": createDataUriDetector(),
  },
  actions: escapeActions,
});
