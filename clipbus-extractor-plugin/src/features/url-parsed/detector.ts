import type { DetectorHandler } from "@clipbus/plugin-sdk/runtime";
import { PLUGIN_WRITE_LIMITS } from "@clipbus/plugin-sdk/runtime";
import { attachment, createUrlPayload, createUrlCard } from "./payload.ts";

export function createUrlDetector(): DetectorHandler {
  return async (input, ctx) => {
    const payload = createUrlPayload(input);
    if (payload === null) return;
    if (Buffer.byteLength(JSON.stringify(payload)) > PLUGIN_WRITE_LIMITS.maximumPayloadBytes) return;
    await attachment.set(ctx, [{ key: "primary", payload, card: createUrlCard(payload) }]);
    const searchText = (payload.inputType === "url" ? payload.host : payload.query.map(({ key, value }) => `${key} ${value}`).join(" ")).slice(0, 1000);
    await ctx.item.setSearchExtension({
      scope: payload.inputType,
      entries: [{ key: "primary", text: searchText, label: payload.inputType === "url" ? "URL" : "Query String" }],
    });
  };
}
