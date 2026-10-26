import type { DetectorHandler } from "@clipbus/plugin-sdk/runtime";
import { attachment, createUuidPayload } from "./payload.ts";

export function createUuidDetector(): DetectorHandler {
  return async (input, ctx) => {
    const payload = createUuidPayload(input);
    if (payload === null) return;
    await attachment.set(ctx, [{ key: "primary", payload }]);
    const searchText = `uuid ${payload.canonical} v${payload.uuidVersion}`;
    await ctx.item.setSearchExtension({
      scope: "extractor",
      entries: [{ key: "primary", text: searchText, label: "UUID" }],
    });
  };
}
