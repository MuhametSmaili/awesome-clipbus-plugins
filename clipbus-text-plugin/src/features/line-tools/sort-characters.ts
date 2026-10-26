import { result } from "@clipbus/plugin-sdk/runtime";
import type { ActionHandler } from "@clipbus/plugin-sdk/runtime";
import { sortCharacters } from "./transforms.ts";

export function createSortCharactersAction(): ActionHandler {
  return async ({ content }) => {
    if (content.kind !== "text" || !content.text.trim()) {
      return result.none("Nothing to process");
    }
    return result.text(sortCharacters(content.text), "Done");
  };
}
