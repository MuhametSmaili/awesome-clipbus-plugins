import type { DetectorHandler } from "@clipbus/plugin-sdk/runtime";
import { PLUGIN_WRITE_LIMITS } from "@clipbus/plugin-sdk";
import { attachment, createDataUriPayload } from "./payload.ts";

export function createDataUriDetector(): DetectorHandler {
  return async (input, ctx) => {
    const payload = createDataUriPayload(input);
    if (payload === null) return;
    if (Buffer.byteLength(JSON.stringify(payload)) > PLUGIN_WRITE_LIMITS.maximumPayloadBytes) return;
    await attachment.set(ctx, [{ key: "primary", payload }]);
    await ctx.item.setSearchExtension({
      scope: "decoder",
      entries: [{ key: "primary", text: `data uri ${payload.mediaType} ${payload.encodingLabel}`.slice(0, 1000), label: "Data URI" }],
    });
  };
}
