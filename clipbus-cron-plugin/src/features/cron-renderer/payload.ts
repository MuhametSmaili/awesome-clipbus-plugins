// payload.ts — UI-safe single source of truth for the Cron preview attachment.
// NO `import … from "node:*"` here: this file is imported by app.vue (browser) too.

import { defineAttachment } from "@clipbus/plugin-sdk";

export const ATTACHMENT_TYPE = "plugin.cron.schedule";

export interface CronField {
  name: string;
  raw: string;
  description: string;
}

export interface CronPayload {
  kind: "cron_preview";
  version: 1;
  expression: string;
  fields: CronField[];
  summary: string;
}

// Field definitions for validation
const FIELD_DEFS = [
  { name: "Minute",  min: 0,  max: 59,  names: undefined as string[] | undefined },
  { name: "Hour",    min: 0,  max: 23,  names: undefined as string[] | undefined },
  { name: "Day",     min: 1,  max: 31,  names: undefined as string[] | undefined },
  { name: "Month",   min: 1,  max: 12,  names: ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"] },
  { name: "Weekday", min: 0,  max: 7,   names: ["SUN","MON","TUE","WED","THU","FRI","SAT"] },
];

const WEEKDAY_NAMES_EN = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const WEEKDAY_MAP: Record<string, number> = {
  SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6,
};

function validateSingleValue(token: string, min: number, max: number, names?: string[]): boolean {
  if (names && names.includes(token.toUpperCase())) return true;
  if (!/^\d+$/.test(token)) return false;
  const n = parseInt(token, 10);
  return n >= min && n <= max;
}

function validateToken(token: string, min: number, max: number, names?: string[]): boolean {
  if (token === "*") return true;

  // Step: */n  or  value/n  or  range/n
  const slashIdx = token.indexOf("/");
  if (slashIdx >= 0) {
    const base    = token.slice(0, slashIdx);
    const stepStr = token.slice(slashIdx + 1);
    if (!/^\d+$/.test(stepStr)) return false;
    const step = parseInt(stepStr, 10);
    if (step < 1) return false;
    if (base === "*") return true;
    return validateToken(base, min, max, names);
  }

  // List: a,b,c
  if (token.includes(",")) {
    return token.split(",").every((t) => validateToken(t, min, max, names));
  }

  // Range: a-b  (dash must not be at position 0 to avoid confusing negative numbers)
  const dashIdx = token.indexOf("-");
  if (dashIdx > 0) {
    const a = token.slice(0, dashIdx);
    const b = token.slice(dashIdx + 1);
    return validateSingleValue(a, min, max, names) && validateSingleValue(b, min, max, names);
  }

  return validateSingleValue(token, min, max, names);
}

// Guard: at least one field must contain a cron special character (* / , -)
function hasSpecialChars(token: string): boolean {
  return /[*/,-]/.test(token);
}

function resolveWeekday(token: string): number | null {
  const upper = token.toUpperCase();
  if (upper in WEEKDAY_MAP) return WEEKDAY_MAP[upper]!;
  if (/^\d+$/.test(token)) {
    const n = parseInt(token, 10);
    if (n >= 0 && n <= 7) return n % 7;
  }
  return null;
}

const MONTH_NAMES_EN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_MAP_EN: Record<string, string> = {
  JAN:"Jan", FEB:"Feb", MAR:"Mar", APR:"Apr", MAY:"May", JUN:"Jun",
  JUL:"Jul", AUG:"Aug", SEP:"Sep", OCT:"Oct", NOV:"Nov", DEC:"Dec",
};

function describeValue(token: string, fieldIdx: number): string {
  const upper = token.toUpperCase();
  if (fieldIdx === 4) {
    const wn = resolveWeekday(token);
    if (wn !== null) return WEEKDAY_NAMES_EN[wn] ?? token;
  }
  if (fieldIdx === 3) {
    if (upper in MONTH_MAP_EN) return MONTH_MAP_EN[upper]!;
    if (/^\d+$/.test(token)) {
      const n = parseInt(token, 10);
      if (n >= 1 && n <= 12) return MONTH_NAMES_EN[n - 1]!;
    }
  }
  const UNIT_NAMES = ["minute", "hour", "day", "month", "weekday"];
  return `${UNIT_NAMES[fieldIdx] ?? ""} ${token}`;
}

function describeToken(token: string, fieldIdx: number, unitName: string): string {
  if (token === "*") return `every ${unitName}`;

  // Step
  const slashIdx = token.indexOf("/");
  if (slashIdx >= 0) {
    const base = token.slice(0, slashIdx);
    const step = token.slice(slashIdx + 1);
    if (base === "*") return `every ${step} ${unitName}s`;
    return `every ${step} ${unitName}s from ${describeValue(base, fieldIdx)}`;
  }

  // List
  if (token.includes(",")) {
    return token.split(",").map((t) => describeValue(t, fieldIdx)).join(", ");
  }

  // Range
  const dashIdx = token.indexOf("-");
  if (dashIdx > 0) {
    const a = token.slice(0, dashIdx);
    const b = token.slice(dashIdx + 1);
    if (fieldIdx === 4) {
      const aNum = resolveWeekday(a);
      const bNum = resolveWeekday(b);
      if (aNum !== null && bNum !== null) {
        return `${WEEKDAY_NAMES_EN[aNum] ?? a} through ${WEEKDAY_NAMES_EN[bNum] ?? b}`;
      }
    }
    return `${describeValue(a, fieldIdx)} through ${describeValue(b, fieldIdx)}`;
  }

  return describeValue(token, fieldIdx);
}

function buildSummary(fields: CronField[]): string {
  const [minField, hourField, dayField, monthField, weekdayField] = fields as [
    CronField, CronField, CronField, CronField, CronField,
  ];
  const parts: string[] = [];

  if (monthField.raw !== "*")   parts.push(monthField.description);
  if (weekdayField.raw !== "*") parts.push(weekdayField.description);
  if (dayField.raw !== "*")     parts.push(`on the ${dayField.description} of the month`);

  if (hourField.raw === "*" && minField.raw === "*") {
    parts.push("every minute");
  } else if (hourField.raw === "*") {
    parts.push(minField.description);
  } else if (minField.raw === "0" || minField.raw === "00") {
    parts.push(`${hourField.description} on the hour`);
  } else {
    parts.push(`${hourField.description} ${minField.description}`);
  }

  return parts.join(", ");
}

export function createCronPayload(input: unknown): CronPayload | null {
  const content = (input as { content?: { kind?: string; text?: string } } | null)?.content;
  if (content?.kind !== "text" || typeof content.text !== "string") return null;

  const raw    = content.text.trim();
  const tokens = raw.split(/\s+/);
  if (tokens.length !== 5) return null;

  // Guard: at least one field must carry a cron special character
  if (!tokens.some(hasSpecialChars)) return null;

  // Validate each token against its field's domain
  for (let i = 0; i < 5; i++) {
    const def = FIELD_DEFS[i]!;
    if (!validateToken(tokens[i]!, def.min, def.max, def.names)) return null;
  }

  const UNIT_NAMES = ["minute", "hour", "day", "month", "weekday"];
  const fields: CronField[] = tokens.map((token, i) => ({
    name:        FIELD_DEFS[i]!.name,
    raw:         token,
    description: describeToken(token, i, UNIT_NAMES[i]!),
  }));

  return {
    kind:       "cron_preview",
    version:    1,
    expression: raw,
    fields,
    summary:    buildSummary(fields),
  };
}

export function decodeCronPayload(value: unknown): CronPayload | null {
  try {
    const parsed = (typeof value === "string" ? JSON.parse(value) : value ?? {}) as { kind?: string };
    if (parsed.kind !== "cron_preview") return null;
    return parsed as CronPayload;
  } catch {
    return null;
  }
}

// ── Next-run computation ─────────────────────────────────────────────────────
// Pure JS / UI-safe: no node:* imports. Both functions are used by app.vue.

/**
 * Expand a single cron field token into the sorted unique list of matching
 * integer values within [min, max].
 *
 * Handles: * | a,b,c | a-b | *\/n | a-b/n | a/n (a..max step n) | name tokens.
 * For the Weekday field (max === 7) the value 7 is normalised to 0 so the
 * returned set always uses 0..6 (Sunday = 0).
 */
export function expandField(
  raw: string,
  min: number,
  max: number,
  names?: string[],
): number[] {
  /** Resolve a single token to its integer, honouring name arrays. */
  function resolveVal(token: string): number | null {
    if (names) {
      const idx = names.indexOf(token.toUpperCase());
      if (idx >= 0) return min + idx; // month: min=1 → JAN=1; weekday: min=0 → SUN=0
    }
    if (/^\d+$/.test(token)) return parseInt(token, 10);
    return null;
  }

  function inBounds(n: number): boolean {
    return n >= min && n <= max;
  }

  let values: number[];

  if (raw.includes(",")) {
    // List: a,b,c — recurse for each part and union the sets
    const set = new Set<number>();
    for (const part of raw.split(",")) {
      for (const n of expandField(part, min, max, names)) set.add(n);
    }
    values = [...set].sort((a, b) => a - b);
  } else {
    const slashIdx = raw.indexOf("/");
    if (slashIdx >= 0) {
      // Step: */n | value/n | range/n
      const base = raw.slice(0, slashIdx);
      const step = parseInt(raw.slice(slashIdx + 1), 10);
      let rangeStart = min;
      let rangeEnd = max;
      if (base !== "*") {
        const dashIdx = base.indexOf("-");
        if (dashIdx > 0) {
          const a = resolveVal(base.slice(0, dashIdx));
          const b = resolveVal(base.slice(dashIdx + 1));
          if (a !== null) rangeStart = a;
          if (b !== null) rangeEnd = b;
        } else {
          const v = resolveVal(base);
          if (v !== null) rangeStart = v; // a/n → a..max step n
        }
      }
      values = [];
      for (let v = rangeStart; v <= rangeEnd; v += step) {
        if (inBounds(v)) values.push(v);
      }
    } else {
      const dashIdx = raw.indexOf("-");
      if (dashIdx > 0) {
        // Range: a-b
        const a = resolveVal(raw.slice(0, dashIdx));
        const b = resolveVal(raw.slice(dashIdx + 1));
        if (a === null || b === null) return [];
        values = [];
        for (let v = a; v <= b; v++) {
          if (inBounds(v)) values.push(v);
        }
      } else if (raw === "*") {
        // Wildcard
        values = [];
        for (let v = min; v <= max; v++) values.push(v);
      } else {
        // Single value
        const n = resolveVal(raw);
        values = n !== null && inBounds(n) ? [n] : [];
      }
    }
  }

  // Weekday field only: normalise 7 → 0 (both represent Sunday), deduplicate.
  if (max === 7) {
    const set = new Set<number>();
    for (const v of values) set.add(v === 7 ? 0 : v);
    return [...set].sort((a, b) => a - b);
  }

  return values;
}

/**
 * Return the next `count` fire-time timestamps (ms) strictly after `fromMs`,
 * computed in LOCAL time using the 5-field cron spec in `fields`.
 *
 * DOM/DOW OR rule: when both Day and Weekday are restricted (neither is "*"),
 * a candidate matches if EITHER condition is satisfied.
 *
 * Returns fewer than `count` entries — possibly [] — when the expression never
 * fires within ~3 years (e.g. "0 0 30 2 *").
 */
export function computeNextRuns(
  fields: CronField[],
  fromMs: number,
  count: number,
): number[] {
  const defByName = new Map(FIELD_DEFS.map((d) => [d.name, d]));

  function getSet(name: string): Set<number> {
    const field = fields.find((f) => f.name === name);
    const def = defByName.get(name);
    if (!field || !def) return new Set();
    return new Set(expandField(field.raw, def.min, def.max, def.names));
  }

  function getRaw(name: string): string {
    return fields.find((f) => f.name === name)?.raw ?? "*";
  }

  const minuteSet = getSet("Minute");
  const hourSet = getSet("Hour");
  const daySet = getSet("Day");
  const monthSet = getSet("Month");
  const weekdaySet = getSet("Weekday"); // already normalised: 0..6

  const domRestricted = getRaw("Day") !== "*";
  const dowRestricted = getRaw("Weekday") !== "*";

  // Start strictly after fromMs: zero seconds/ms, then advance one full minute.
  const current = new Date(fromMs);
  current.setSeconds(0, 0);
  current.setTime(current.getTime() + 60_000);

  // Hard cap: ~1,600,000 minutes ≈ 3 years expressed as a timestamp limit.
  const limitTs = fromMs + 1_600_000 * 60_000;

  const results: number[] = [];

  while (current.getTime() <= limitTs && results.length < count) {
    const month = current.getMonth() + 1; // 1-based to match cron convention

    // Month-skip optimisation: when the current month is not in monthSet, jump
    // directly to the first minute of the next calendar month instead of
    // iterating minute by minute through it.
    if (!monthSet.has(month)) {
      current.setDate(1);
      current.setHours(0, 0, 0, 0);
      current.setMonth(current.getMonth() + 1); // JS Date handles Dec→Jan wrap
      continue;
    }

    const minute = current.getMinutes();
    const hour = current.getHours();
    const date = current.getDate();
    const weekday = current.getDay(); // 0 = Sunday, matches normalised weekdaySet

    // DOM/DOW OR rule (POSIX cron): both restricted → either condition suffices.
    let dayOK: boolean;
    if (domRestricted && dowRestricted) {
      dayOK = daySet.has(date) || weekdaySet.has(weekday);
    } else if (domRestricted) {
      dayOK = daySet.has(date);
    } else if (dowRestricted) {
      dayOK = weekdaySet.has(weekday);
    } else {
      dayOK = true;
    }

    if (minuteSet.has(minute) && hourSet.has(hour) && dayOK) {
      results.push(current.getTime());
    }

    current.setTime(current.getTime() + 60_000);
  }

  return results;
}

export const attachment = defineAttachment<CronPayload>(ATTACHMENT_TYPE);
