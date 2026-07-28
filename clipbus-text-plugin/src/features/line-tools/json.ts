import { actionResult } from "@clipbus/plugin-sdk/runtime";
import type {
  PluginAutoRunActionHandler,
  PluginAutoRunActionInput,
  PluginActionOperationResult,
  PluginActionResolveResult,
} from "@clipbus/plugin-sdk/runtime";

const resolveStub = async (): Promise<PluginActionResolveResult> => ({
  buttons: [],
  initialDraft: {},
});

function createJsonAction(indent?: number): PluginAutoRunActionHandler {
  return {
    resolveSession: resolveStub,
    async runAutoAction(
      input: PluginAutoRunActionInput
    ): Promise<PluginActionOperationResult> {
      const { content } = input;
      if (content.kind !== "text" || !content.text.trim()) {
        return actionResult.none({ userMessage: "Nothing to process" });
      }

      try {
        const output = JSON.stringify(JSON.parse(content.text), null, indent);
        return output === undefined
          ? actionResult.none({ userMessage: "Invalid JSON" })
          : actionResult.text(output, { userMessage: "Done" });
      } catch {
        return actionResult.none({ userMessage: "Invalid JSON" });
      }
    },
  };
}

export function createPrettyJsonAction(): PluginAutoRunActionHandler {
  return createJsonAction(2);
}

export function createMinifyJsonAction(): PluginAutoRunActionHandler {
  return createJsonAction();
}
