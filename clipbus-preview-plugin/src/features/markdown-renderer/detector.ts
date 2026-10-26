import { PLUGIN_WRITE_LIMITS, type DetectorHandler } from "@clipbus/plugin-sdk/runtime";
import { attachment, detectMarkdownPayload } from "./payload.ts";

export function createMarkdownDetector(): DetectorHandler {
  return async (input, ctx) => {
    const payload = detectMarkdownPayload(input);
    if (payload === null) return;
    if (Buffer.byteLength(JSON.stringify(payload)) > PLUGIN_WRITE_LIMITS.maximumPayloadBytes) return;
    await attachment.set(ctx, [{ key: "primary", payload }]);
    await ctx.item.setSearchExtension({
      scope: "markdown",
      entries: [{ key: "primary", text: input.content.kind === "text" ? input.content.text.trim().slice(0, 200) : "", label: "Markdown" }],
    });
  };
}
