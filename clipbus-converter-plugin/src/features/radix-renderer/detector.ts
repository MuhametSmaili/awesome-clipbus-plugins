import type { DetectorHandler } from "@clipbus/plugin-sdk/runtime";
import { attachment, createRadixPayload } from "./payload.ts";

export function createRadixDetector(): DetectorHandler {
  return async (input, ctx) => {
    const payload = createRadixPayload(input);
    if (payload === null) return;
    await attachment.set(ctx, [{ key: "primary", payload }]);
    await ctx.item.setSearchExtension({
      scope: "radix",
      entries: [{ key: "primary", text: `${payload.decimal} ${payload.hex} ${payload.binary}`.slice(0, 200), label: "Radix Conversion" }],
    });
  };
}
