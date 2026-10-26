import { PLUGIN_WRITE_LIMITS, type DetectorHandler } from "@clipbus/plugin-sdk/runtime";
import { attachment, createColorPayload } from "./payload.ts";

export function createColorDetector(): DetectorHandler {
  return async (input, ctx) => {
    const payload = createColorPayload(input);
    if (payload === null) return;
    if (Buffer.byteLength(JSON.stringify(payload)) > PLUGIN_WRITE_LIMITS.maximumPayloadBytes) return;
    await attachment.set(ctx, [{ key: "primary", payload, card: { tint: payload.hex } }]);
    await ctx.item.setSearchExtension({
      scope: "color",
      entries: [{ key: "primary", text: payload.hex, label: "Color" }],
    });
  };
}
