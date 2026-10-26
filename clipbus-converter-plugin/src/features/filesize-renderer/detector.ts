import type { DetectorHandler } from "@clipbus/plugin-sdk/runtime";
import { attachment, createFilesizePayload } from "./payload.ts";

export function createFilesizeDetector(): DetectorHandler {
  return async (input, ctx) => {
    const payload = createFilesizePayload(input);
    if (payload === null) return;
    await attachment.set(ctx, [{ key: "primary", payload }]);
    await ctx.item.setSearchExtension({
      scope: "converter",
      entries: [{ key: "primary", text: `${payload.bytesFormatted} bytes`, label: "Data Size" }],
    });
  };
}
