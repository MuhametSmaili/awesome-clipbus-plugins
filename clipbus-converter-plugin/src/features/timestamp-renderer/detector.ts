import type { DetectorHandler } from "@clipbus/plugin-sdk/runtime";
import { attachment, createTimestampPayload } from "./payload.ts";

export function createTimestampDetector(): DetectorHandler {
  return async (input, ctx) => {
    const payload = createTimestampPayload(input);
    if (payload === null) return;
    await attachment.set(ctx, [{ key: "primary", payload }]);
    await ctx.item.setSearchExtension({
      scope: "converter",
      entries: [{ key: "primary", text: payload.iso, label: "Unix Timestamp" }],
    });
  };
}
