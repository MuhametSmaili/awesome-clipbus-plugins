// payload.ts — UI-safe single source of truth for the duration preview attachment.
// NO `import … from "node:*"` here: this file is imported by app.vue (browser) too.

import { defineAttachment } from "@clipbus/plugin-sdk";

export const ATTACHMENT_TYPE = "plugin.converter.duration";

export interface DurationComponents {
  years?: number;
  months?: number;
  weeks?: number;
  days?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
}

export interface DurationPayload {
  kind: "duration_preview";
  version: 1;
  original: string;
  components: DurationComponents;
  humanBreakdown: string;
  totalSeconds: number;
  approximate: boolean;
}

// ISO 8601 duration regex.
// Lookaheads ensure:
//   (?=\d|T) — at least a digit or 'T' follows 'P' (rejects bare "P")
//   (?=\d)   — at least a digit follows 'T' (rejects bare "PT")
// Anchored so extra trailing text fails (rejects "PT4M13S extra").
const ISO_DURATION_RE =
  /^P(?=\d|T)(?:(\d+(?:\.\d+)?)Y)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)W)?(?:(\d+(?:\.\d+)?)D)?(?:T(?=\d)(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/;

// Nominal seconds per unit. Y/M use calendar averages (approximate).
const SECONDS_PER = {
  years: 31557600, // 365.25 * 86400
  months: 2629800, // 30.4375 * 86400
  weeks: 604800, // 7 * 86400
  days: 86400,
  hours: 3600,
  minutes: 60,
  seconds: 1,
};

function pluralize(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? "" : "s"}`;
}

function buildHumanBreakdown(c: DurationComponents): string {
  const parts: string[] = [];
  if (c.years !== undefined) parts.push(pluralize(c.years, "year"));
  if (c.months !== undefined) parts.push(pluralize(c.months, "month"));
  if (c.weeks !== undefined) parts.push(pluralize(c.weeks, "week"));
  if (c.days !== undefined) parts.push(pluralize(c.days, "day"));
  if (c.hours !== undefined) parts.push(pluralize(c.hours, "hour"));
  if (c.minutes !== undefined) parts.push(pluralize(c.minutes, "minute"));
  if (c.seconds !== undefined) parts.push(pluralize(c.seconds, "second"));
  return parts.length > 0 ? parts.join(", ") : "0 seconds";
}

export function createDurationPayload(input: unknown): DurationPayload | null {
  const content = (input as { content?: { kind?: string; text?: string } } | null)?.content;
  if (content?.kind !== "text" || typeof content.text !== "string") return null;

  const original = content.text.trim();
  const match = ISO_DURATION_RE.exec(original);
  if (!match) return null;

  const [, rawYears, rawMonths, rawWeeks, rawDays, rawHours, rawMinutes, rawSeconds] = match;

  // Guard: require at least one captured component (safety net beyond lookaheads).
  if (
    rawYears === undefined &&
    rawMonths === undefined &&
    rawWeeks === undefined &&
    rawDays === undefined &&
    rawHours === undefined &&
    rawMinutes === undefined &&
    rawSeconds === undefined
  ) {
    return null;
  }

  const components: DurationComponents = {};
  if (rawYears !== undefined) components.years = parseFloat(rawYears);
  if (rawMonths !== undefined) components.months = parseFloat(rawMonths);
  if (rawWeeks !== undefined) components.weeks = parseFloat(rawWeeks);
  if (rawDays !== undefined) components.days = parseFloat(rawDays);
  if (rawHours !== undefined) components.hours = parseFloat(rawHours);
  if (rawMinutes !== undefined) components.minutes = parseFloat(rawMinutes);
  if (rawSeconds !== undefined) components.seconds = parseFloat(rawSeconds);

  const humanBreakdown = buildHumanBreakdown(components);

  // Y or M use nominal values, so the total is approximate.
  const approximate = components.years !== undefined || components.months !== undefined;

  const totalSeconds =
    (components.years ?? 0) * SECONDS_PER.years +
    (components.months ?? 0) * SECONDS_PER.months +
    (components.weeks ?? 0) * SECONDS_PER.weeks +
    (components.days ?? 0) * SECONDS_PER.days +
    (components.hours ?? 0) * SECONDS_PER.hours +
    (components.minutes ?? 0) * SECONDS_PER.minutes +
    (components.seconds ?? 0) * SECONDS_PER.seconds;

  return {
    kind: "duration_preview",
    version: 1,
    original,
    components,
    humanBreakdown,
    totalSeconds,
    approximate,
  };
}

export function decodeDurationPayload(
  value: unknown
): DurationPayload | null {
  try {
    const p = (typeof value === "string" ? JSON.parse(value) : value ?? {}) as { kind?: string };
    if (p.kind !== "duration_preview") return null;
    return p as DurationPayload;
  } catch {
    return null;
  }
}

export const attachment = defineAttachment<DurationPayload>(ATTACHMENT_TYPE);
