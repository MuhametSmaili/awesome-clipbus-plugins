import { result } from "@clipbus/plugin-sdk/runtime";
import type { ActionHandler } from "@clipbus/plugin-sdk/runtime";

function createJsonAction(indent?: number): ActionHandler {
  return async ({ content }) => {
    if (content.kind !== "text" || !content.text.trim()) {
      return result.none("Nothing to process");
    }
    try {
      const output = JSON.stringify(JSON.parse(content.text), null, indent);
      return output === undefined
        ? result.none("Invalid JSON")
        : result.text(output, "Done");
    } catch {
      return result.none("Invalid JSON");
    }
  };
}

export function createPrettyJsonAction(): ActionHandler {
  return createJsonAction(2);
}

export function createMinifyJsonAction(): ActionHandler {
  return createJsonAction();
}
