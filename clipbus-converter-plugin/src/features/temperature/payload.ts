// payload.ts — UI-safe single source of truth for the temperature conversion attachment.
// NO `import … from "node:*"` here: this file is imported by app.vue (browser) too.

import { defineAttachment } from "@clipbus/plugin-sdk";

export const ATTACHMENT_TYPE = "plugin.converter.temperature";

export interface TemperaturePayload {
  kind: "temperature_preview";
  version: 1;
  sourceScale: "C" | "F" | "K";
  sourceValue: number;
  celsius: number;
  fahrenheit: number;
  kelvin: number;
  belowAbsoluteZero: boolean;
}

/** Round to at most 2 decimal places; trailing zeros are shed by JS naturally. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Parse a temperature string and return a TemperaturePayload, or null if the
 * input is not a recognised single-temperature value.
 *
 * False-positive rule: a bare single-letter unit (C / F / K) that is directly
 * glued to the number with no degree sign (° ℃ ℉) and no whitespace between
 * them is rejected — e.g. "300K" and "37C" return null.
 *
 * Accepted forms (number = optional -, digits, optional .digits):
 *   °C / °F / °K        — degree sign then letter (optional leading spaces)
 *   ℃ / ℉               — Unicode temperature symbols (optional leading spaces)
 *   <space(s)> C/F/K    — whitespace-separated single letter
 *   <opt-spaces> Celsius / Fahrenheit / Kelvin   — word form (case-insensitive)
 */
export function createTemperaturePayload(input: unknown): TemperaturePayload | null {
  const content = (input as { content?: { kind?: string; text?: string } } | null)?.content;
  if (content?.kind !== "text" || typeof content.text !== "string") return null;

  const trimmed = content.text.trim();
  if (trimmed === "") return null;

  // Extract the leading numeric part and the remainder (unit) in one pass.
  const numMatch = /^(-?\d+(?:\.\d+)?)(.*)$/.exec(trimmed);
  if (!numMatch) return null;

  const [, numStr, rest] = numMatch;
  const sourceValue = parseFloat(numStr);
  if (isNaN(sourceValue)) return null;

  // Identify the temperature scale from the remainder.
  let sourceScale: "C" | "F" | "K" | null = null;

  // Degree sign (U+00B0) followed by a recognised scale letter.
  if (/^\s*°C$/.test(rest)) {
    sourceScale = "C";
  } else if (/^\s*°F$/.test(rest)) {
    sourceScale = "F";
  } else if (/^\s*°K$/.test(rest)) {
    sourceScale = "K";
  }
  // Unicode combination characters: ℃ (U+2103) and ℉ (U+2109).
  else if (/^\s*℃$/.test(rest)) {
    sourceScale = "C";
  } else if (/^\s*℉$/.test(rest)) {
    sourceScale = "F";
  }
  // Whitespace-separated single letter (whitespace REQUIRED — bare letter rejected).
  else if (/^\s+C$/.test(rest)) {
    sourceScale = "C";
  } else if (/^\s+F$/.test(rest)) {
    sourceScale = "F";
  } else if (/^\s+K$/.test(rest)) {
    sourceScale = "K";
  }
  // Word-form scale names (case-insensitive); optional leading whitespace.
  else if (/^\s*celsius$/i.test(rest)) {
    sourceScale = "C";
  } else if (/^\s*fahrenheit$/i.test(rest)) {
    sourceScale = "F";
  } else if (/^\s*kelvin$/i.test(rest)) {
    sourceScale = "K";
  }

  if (!sourceScale) return null;

  // Convert source to Celsius first, then to all three scales.
  let celsius: number;
  if (sourceScale === "C") {
    celsius = sourceValue;
  } else if (sourceScale === "F") {
    celsius = ((sourceValue - 32) * 5) / 9;
  } else {
    celsius = sourceValue - 273.15;
  }

  const fahrenheit = round2(celsius * (9 / 5) + 32);
  const kelvin = round2(celsius + 273.15);
  celsius = round2(celsius);

  const belowAbsoluteZero = kelvin < 0;

  return {
    kind: "temperature_preview",
    version: 1,
    sourceScale,
    sourceValue,
    celsius,
    fahrenheit,
    kelvin,
    belowAbsoluteZero,
  };
}

export function decodeTemperaturePayload(
  value: unknown
): TemperaturePayload | null {
  try {
    const p = (typeof value === "string" ? JSON.parse(value) : value ?? {}) as { kind?: string };
    if (p.kind !== "temperature_preview") return null;
    return p as TemperaturePayload;
  } catch {
    return null;
  }
}

export const attachment = defineAttachment<TemperaturePayload>(ATTACHMENT_TYPE);
