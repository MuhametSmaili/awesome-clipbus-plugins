import { definePlugin } from "@clipbus/plugin-sdk/runtime";
import { createEntitiesDetector } from "./features/entities-renderer/detector.ts";
import { createUrlDetector } from "./features/url-parsed/detector.ts";
import { createIpDetector } from "./features/ip-details/detector.ts";
import { createGeoDetector } from "./features/geo-coordinates/detector.ts";
import { createMacDetector } from "./features/mac-address/detector.ts";
import { createUuidDetector } from "./features/uuid-details/detector.ts";

export default definePlugin({
  detectors: {
    "entities-detector": createEntitiesDetector(),
    "url-detector": createUrlDetector(),
    "ip-detector": createIpDetector(),
    "geo-detector": createGeoDetector(),
    "mac-detector": createMacDetector(),
    "uuid-detector": createUuidDetector(),
  },
});
