import { result } from "@clipbus/plugin-sdk/runtime";
import type { ActionHandler } from "@clipbus/plugin-sdk/runtime";
import {
  base64Decode,
  base64Encode,
  htmlDecode,
  htmlEncode,
  jsonDecode,
  jsonEncode,
  unicodeDecode,
  unicodeEncode,
  urlDecode,
  urlEncode,
} from "./payload.ts";

function createTransformAction(
  transform: (text: string) => string | null,
  userMessage: string,
): ActionHandler {
  return async (input) => {
    if (input.content.kind !== "text") {
      return result.none("Text input required");
    }
    try {
      const output = transform(input.content.text);
      if (output === null) {
        return result.none("Invalid encoded input");
      }
      return result.text(output, userMessage);
    } catch {
      return result.none("Invalid encoded input");
    }
  };
}

export const escapeActions: Record<string, ActionHandler> = {
  "url-encode": createTransformAction(urlEncode, "URL encoded"),
  "url-decode": createTransformAction(urlDecode, "URL decoded"),
  "html-encode": createTransformAction(htmlEncode, "HTML encoded"),
  "html-decode": createTransformAction(htmlDecode, "HTML decoded"),
  "base64-encode": createTransformAction(base64Encode, "Base64 encoded"),
  "base64-decode": createTransformAction(base64Decode, "Base64 decoded"),
  "unicode-escape": createTransformAction(unicodeEncode, "Unicode escaped"),
  "unicode-unescape": createTransformAction(unicodeDecode, "Unicode unescaped"),
  "json-escape": createTransformAction(jsonEncode, "JSON escaped"),
  "json-unescape": createTransformAction(jsonDecode, "JSON unescaped"),
};
