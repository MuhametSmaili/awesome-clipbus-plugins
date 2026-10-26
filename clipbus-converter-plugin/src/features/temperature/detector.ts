import type { DetectorHandler } from "@clipbus/plugin-sdk/runtime";
import { attachment, createTemperaturePayload } from "./payload.ts";

export function createTemperatureDetector(): DetectorHandler {
  return async (input, ctx) => {
    const payload = createTemperaturePayload(input);
    if (payload === null) return;
    await attachment.set(ctx, [{ key: "primary", payload }]);
    await ctx.item.setSearchExtension({
      scope: "converter",
      entries: [{ key: "primary", text: `temperature ${payload.sourceValue} ${payload.sourceScale}`, label: "Temperature" }],
    });
  };
}
