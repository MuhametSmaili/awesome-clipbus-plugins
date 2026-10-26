import type { DetectorHandler } from "@clipbus/plugin-sdk/runtime";
import { attachment, createChmodPayload } from "./payload.ts";

export function createChmodDetector(): DetectorHandler {
  return async (input, ctx) => {
    const payload = createChmodPayload(input);
    if (payload === null) return;
    await attachment.set(ctx, [{ key: "primary", payload }]);
    await ctx.item.setSearchExtension({
      scope: "converter",
      entries: [{ key: "primary", text: `chmod ${payload.octal} ${payload.symbolic}`, label: "File Permissions" }],
    });
  };
}
