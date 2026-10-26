import { PLUGIN_WRITE_LIMITS, type DetectorHandler } from "@clipbus/plugin-sdk/runtime";
import { attachment, createGradientPayload } from "./payload.ts";

export function createGradientDetector(): DetectorHandler {
  return async (input, ctx) => {
    const payload = createGradientPayload(input);
    if (payload === null) return;
    if (Buffer.byteLength(JSON.stringify(payload)) > PLUGIN_WRITE_LIMITS.maximumPayloadBytes) return;
    await attachment.set(ctx, [{ key: "primary", payload }]);
    await ctx.item.setSearchExtension({
      scope: "preview",
      entries: [{ key: "primary", text: `gradient ${payload.gradientType} ${payload.stops.join(" ")}`.slice(0, 200), label: "Gradient" }],
    });
  };
}
