import { result } from "@clipbus/plugin-sdk/runtime";
import type { ActionHandler } from "@clipbus/plugin-sdk/runtime";
import { reverseLines } from "./transforms.ts";

export function createReverseLinesAction(): ActionHandler {
  return async ({ content }) => {
    if (content.kind !== "text" || !content.text.trim()) {
      return result.none("Nothing to process");
    }
    return result.text(reverseLines(content.text), "Done");
  };
}
