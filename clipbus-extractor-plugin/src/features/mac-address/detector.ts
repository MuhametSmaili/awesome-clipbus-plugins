import type { DetectorHandler } from "@clipbus/plugin-sdk/runtime";
import { attachment, createMacPayload } from "./payload.ts";

export function createMacDetector(): DetectorHandler {
  return async (input, ctx) => {
    const payload = createMacPayload(input);
    if (payload === null) return;
    await attachment.set(ctx, [{ key: "primary", payload }]);
    const searchText = `${payload.colonLower} mac address ${payload.oui}`;
    await ctx.item.setSearchExtension({
      scope: "extractor",
      entries: [{ key: "primary", text: searchText, label: "MAC Address" }],
    });
  };
}
