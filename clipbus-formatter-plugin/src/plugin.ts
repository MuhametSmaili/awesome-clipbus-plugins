import { definePlugin } from "@clipbus/plugin-sdk/runtime";
import { createJsonDetector } from "./features/json-renderer/detector.ts";
import { createXmlDetector } from "./features/xml-renderer/detector.ts";
import { createCsvDetector } from "./features/csv-table/detector.ts";

export default definePlugin({
  setup() {
    return {
      detectors: {
        "json-detector": createJsonDetector(),
        "xml-detector": createXmlDetector(),
        "csv-detector": createCsvDetector(),
      },
      actions: {},
      messages: [],
    };
  },
});
