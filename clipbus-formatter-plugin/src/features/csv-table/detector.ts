import { Buffer } from "node:buffer";
import { PLUGIN_WRITE_LIMITS } from "@clipbus/plugin-sdk";
import type { DetectorHandler } from "@clipbus/plugin-sdk/runtime";
import { attachment, createCsvPayload } from "./payload.ts";

export function createCsvDetector(): DetectorHandler {
  return async (input, ctx) => {
    const payload = createCsvPayload(input);
    if (payload === null) return;
    if (Buffer.byteLength(JSON.stringify(payload)) > PLUGIN_WRITE_LIMITS.maximumPayloadBytes) return;
    let text = "";
    let bytes = 0;
    for (const char of payload.headers.join(" ")) {
      bytes += Buffer.byteLength(char);
      if (bytes > PLUGIN_WRITE_LIMITS.maximumSearchTextBytes) break;
      text += char;
    }
    await attachment.set(ctx, [{ key: "primary", payload }]);
    await ctx.item.setSearchExtension({
      scope: "csv",
      entries: [{ key: "primary", text: text, label: "CSV" }],
    });
  };
}
