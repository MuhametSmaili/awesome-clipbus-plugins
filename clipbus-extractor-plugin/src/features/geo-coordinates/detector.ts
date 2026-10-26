import type { DetectorHandler } from "@clipbus/plugin-sdk/runtime";
import { attachment, createGeoPayload } from "./payload.ts";

export function createGeoDetector(): DetectorHandler {
  return async (input, ctx) => {
    const payload = createGeoPayload(input);
    if (payload === null) return;
    await attachment.set(ctx, [{ key: "primary", payload }]);
    const searchText = `${payload.lat},${payload.lng} coordinates geo`;
    await ctx.item.setSearchExtension({
      scope: "extractor",
      entries: [{ key: "primary", text: searchText, label: "Coordinates" }],
    });
  };
}
