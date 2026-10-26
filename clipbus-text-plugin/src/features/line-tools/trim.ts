import { result } from "@clipbus/plugin-sdk/runtime";
import type { ActionHandler } from "@clipbus/plugin-sdk/runtime";
import { tidyWhitespace } from "./transforms.ts";

export function createTrimAction(): ActionHandler {
  return async ({ content }) => {
    if (content.kind !== "text" || !content.text.trim()) {
      return result.none("Nothing to process");
    }
    return result.text(tidyWhitespace(content.text), "Done");
  };
}
