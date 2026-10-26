import { Buffer } from "node:buffer";
import { PLUGIN_WRITE_LIMITS } from "@clipbus/plugin-sdk";
import type { DetectorHandler } from "@clipbus/plugin-sdk/runtime";
import { attachment, createXmlPayload } from "./payload.ts";

export function createXmlDetector(): DetectorHandler {
  return async (input, ctx) => {
    const payload = createXmlPayload(input);
    if (payload === null) return;
    if (Buffer.byteLength(JSON.stringify(payload)) > PLUGIN_WRITE_LIMITS.maximumPayloadBytes) return;
    await attachment.set(ctx, [{ key: "primary", payload }]);
    await ctx.item.setSearchExtension({
      scope: "xml",
      entries: [{ key: "primary", text: Array.from(payload.formatted).slice(0, 200).join(""), label: "XML" }],
    });
  };
}
