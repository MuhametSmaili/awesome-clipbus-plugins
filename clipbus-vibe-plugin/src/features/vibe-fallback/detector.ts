import type { DetectorHandler } from "@clipbus/plugin-sdk/runtime";
import { createVibePayload, vibeAttachment } from "./payload.ts";

export const vibeDetector: DetectorHandler = async (input, ctx) => {
  // Other plugins take priority. Our own refs must still allow a full recopy write.
  if (input.item.attachments.some((reference) => !reference.own)) return;
  const payload = createVibePayload(input);
  if (!payload) return;
  await vibeAttachment.set(ctx, [{ key: "primary", payload }]);
};
