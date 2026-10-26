import type { DetectorHandler } from "@clipbus/plugin-sdk/runtime";
import { attachment, createBase64Payload } from "./payload.ts";

export function createBase64Detector(): DetectorHandler {
  return async (input, ctx) => {
    const payload = createBase64Payload(input);
    if (payload === null) return;
    await attachment.set(ctx, [{ key: "primary", payload }]);
    await ctx.item.setSearchExtension({
      scope: "decoder",
      entries: [{ key: "primary", text: payload.decoded.slice(0, 200), label: "Base64 Decoded" }],
    });
  };
}
