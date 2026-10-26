import type { DetectorHandler } from "@clipbus/plugin-sdk/runtime";
import { attachment, createDurationPayload } from "./payload.ts";

export function createDurationDetector(): DetectorHandler {
  return async (input, ctx) => {
    const payload = createDurationPayload(input);
    if (payload === null) return;
    await attachment.set(ctx, [{ key: "primary", payload }]);
    await ctx.item.setSearchExtension({
      scope: "converter",
      entries: [{ key: "primary", text: `${payload.original} ${payload.humanBreakdown}`.slice(0, 200), label: "Duration" }],
    });
  };
}
