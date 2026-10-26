import { result } from "@clipbus/plugin-sdk/runtime";
import type { ActionHandler } from "@clipbus/plugin-sdk/runtime";
import {
  toCamel,
  toConstant,
  toDot,
  toKebab,
  toLowercase,
  toPascal,
  toSentence,
  toSnake,
  toTitle,
  toUppercase,
} from "./payload.ts";

export function createCaseAction(
  transform: (text: string) => string,
  message: string,
): ActionHandler {
  return async (input) => {
    if (input.content.kind !== "text" || input.content.text.length === 0) {
      return result.none("Nothing to convert");
    }
    return result.text(transform(input.content.text), message);
  };
}

export const caseActions: Record<string, ActionHandler> = {
  uppercase: createCaseAction(toUppercase, "Converted to uppercase"),
  lowercase: createCaseAction(toLowercase, "Converted to lowercase"),
  camelCase: createCaseAction(toCamel, "Converted to camelCase"),
  pascalCase: createCaseAction(toPascal, "Converted to PascalCase"),
  snakeCase: createCaseAction(toSnake, "Converted to snake_case"),
  kebabCase: createCaseAction(toKebab, "Converted to kebab-case"),
  constantCase: createCaseAction(toConstant, "Converted to CONSTANT_CASE"),
  titleCase: createCaseAction(toTitle, "Converted to Title Case"),
  sentenceCase: createCaseAction(toSentence, "Converted to Sentence case"),
  dotCase: createCaseAction(toDot, "Converted to dot.case"),
};
