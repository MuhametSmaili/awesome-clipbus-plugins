import type { DetectorHandler } from "@clipbus/plugin-sdk/runtime";
import { attachment, createJsonPayload } from "./payload.ts";

export function createJsonDetector(): DetectorHandler {
  return async (input, ctx) => {
    const payload = createJsonPayload(input);
    if (payload === null) return;
    await attachment.set(ctx, [{ key: "primary", payload, card: { title: payload.display.typeLabel } }]);
    await ctx.item.setSearchExtension({
      scope: "formatter",
      entries: [{ key: "primary", text: Array.from(payload.formatted).slice(0, 200).join(""), label: payload.display.typeLabel }],
    });
  };
}
