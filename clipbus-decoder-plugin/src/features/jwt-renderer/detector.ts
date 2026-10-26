import type { DetectorHandler } from "@clipbus/plugin-sdk/runtime";
import { PLUGIN_WRITE_LIMITS } from "@clipbus/plugin-sdk";
import { attachment, createJwtPayload } from "./payload.ts";

export function createJwtDetector(): DetectorHandler {
  return async (input, ctx) => {
    const payload = createJwtPayload(input);
    if (payload === null) return;
    // Pretty-printed nested claims can exceed the payload limit even for valid input.
    if (Buffer.byteLength(JSON.stringify(payload)) > PLUGIN_WRITE_LIMITS.maximumPayloadBytes) return;
    await attachment.set(ctx, [{ key: "primary", payload }]);
    await ctx.item.setSearchExtension({
      scope: "jwt",
      entries: [{ key: "primary", text: payload.payloadPretty.slice(0, 200), label: "JWT" }],
    });
  };
}
