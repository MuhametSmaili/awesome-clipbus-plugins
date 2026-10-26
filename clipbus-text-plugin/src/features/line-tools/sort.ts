import { result } from "@clipbus/plugin-sdk/runtime";
import type { ActionHandler } from "@clipbus/plugin-sdk/runtime";
import { sortLines } from "./transforms.ts";

export function createSortAction(): ActionHandler {
  return async ({ content }) => {
    if (content.kind !== "text" || !content.text.trim()) {
      return result.none("Nothing to process");
    }
    return result.text(sortLines(content.text), "Done");
  };
}
