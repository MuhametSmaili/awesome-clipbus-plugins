import { result } from "@clipbus/plugin-sdk/runtime";
import type { ActionHandler } from "@clipbus/plugin-sdk/runtime";
import { reverseCharacters } from "./transforms.ts";

export function createReverseCharactersAction(): ActionHandler {
  return async ({ content }) => {
    if (content.kind !== "text" || !content.text.trim()) {
      return result.none("Nothing to process");
    }
    return result.text(reverseCharacters(content.text), "Done");
  };
}
