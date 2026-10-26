import type { DetectorHandler } from "@clipbus/plugin-sdk/runtime";
import { PLUGIN_WRITE_LIMITS } from "@clipbus/plugin-sdk/runtime";
import { attachment, createEntitiesPayload } from "./payload.ts";

export function createEntitiesDetector(): DetectorHandler {
  return async (input, ctx) => {
    const payload = createEntitiesPayload(input);
    if (payload === null) return;
    if (Buffer.byteLength(JSON.stringify(payload)) > PLUGIN_WRITE_LIMITS.maximumPayloadBytes) return;
    await attachment.set(ctx, [{ key: "primary", payload }]);
    const searchText = [...payload.urls, ...payload.emails, ...payload.ips].join(" ").slice(0, 200);
    await ctx.item.setSearchExtension({
      scope: "extractor",
      entries: [{ key: "primary", text: searchText, label: "Extracted Entities" }],
    });
  };
}
